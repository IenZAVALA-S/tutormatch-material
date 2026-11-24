import {
  credentials,
  loadPackageDefinition,
  ServiceError,
  status,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Admin, Kafka, logLevel, Producer } from 'kafkajs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { Connection } from 'mongoose';
import { AppModule } from './app.module';
import { DEMO } from './clientes/datos-demo';
import { conectarGrpc } from './common/grpc/conectar-grpc';
import { ArchivosStorage } from './materiales/archivos.storage';
import {
  GRPC_OPCIONES_LOADER,
  GRPC_PROTO_MATERIAL,
  GRPC_TAMANO_MAXIMO_MENSAJE,
} from './common/grpc/grpc.constantes';
import {
  cerrar,
  conectarMongoDePrueba,
  MONGO_URI_PRUEBAS,
  PLAZO_PREPARACION_MS,
} from './common/testing/mongo-pruebas';
import { TOPICOS_SESION } from './sesiones/eventos-sesion.service';

/**
 * De punta a punta: levanta la app completa (como main.ts) contra el Mongo y el
 * Kafka del docker-compose, y la llama por gRPC tal como lo haría el BFF.
 * Usuarios y Sesiones son las versiones falsas (CLIENTES_FALSOS=true).
 */

const KAFKA = process.env.KAFKA_BROKERS ?? 'localhost:9192';

/** Un puerto libre, para no chocar con la app de desarrollo en 9090. */
const puertoLibre = () =>
  new Promise<number>((ok) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });

type Llamada = (req: object) => Promise<any>;

describe('Material de punta a punta (gRPC + Kafka + Mongo)', () => {
  let app: INestApplication;
  let mongo: Connection;
  let admin: Admin;
  let productor: Producer;
  let grpc: Record<string, Llamada>;
  let cerrarCliente: () => void;
  let puertoHttp: number;

  beforeAll(async () => {
    mongo = await conectarMongoDePrueba();

    // La app lee su configuración de aquí: process.env gana sobre el .env.
    Object.assign(process.env, {
      MONGO_URI: MONGO_URI_PRUEBAS,
      KAFKA_BROKERS: KAFKA,
      KAFKA_GRUPO: `material-pruebas-${randomUUID()}`,
      CLIENTES_FALSOS: 'true',
    });

    const kafka = new Kafka({
      clientId: 'pruebas',
      brokers: KAFKA.split(','),
      logLevel: logLevel.NOTHING,
    });
    admin = kafka.admin();
    await admin.connect();
    // En el clúster los crea Sesiones; aquí, el test (si ya existen, no hace nada).
    await admin.createTopics({
      topics: TOPICOS_SESION.map((topic) => ({ topic })),
    });
    productor = kafka.producer();
    await productor.connect();

    const puerto = await puertoLibre();
    app = await NestFactory.create(AppModule, { logger: ['error'] });
    conectarGrpc(app, `127.0.0.1:${puerto}`);
    await app.startAllMicroservices();
    // HTTP también, como main.ts: ahí viven las sondas de Kubernetes.
    puertoHttp = await puertoLibre();
    await app.listen(puertoHttp, '127.0.0.1');

    // Espera a que existan las colecciones y sus índices antes de probar nada.
    // Solo la primera corrida tarda (ver mongo-pruebas.ts).
    const conexionApp = app.get<Connection>(getConnectionToken());
    await Promise.all(
      Object.values(conexionApp.models).map((modelo) => modelo.init()),
    );
    // GridFS crea sus colecciones e índices en la primera subida.
    const archivos = app.get(ArchivosStorage);
    await archivos.borrar(
      await archivos.guardar('preparacion', Buffer.from('x')),
    );

    const def = loadSync(GRPC_PROTO_MATERIAL, GRPC_OPCIONES_LOADER);
    const Servicio = (loadPackageDefinition(def) as any).tutorias.material.v1
      .MaterialService;
    const cliente = new Servicio(
      `127.0.0.1:${puerto}`,
      credentials.createInsecure(),
      {
        'grpc.max_receive_message_length': GRPC_TAMANO_MAXIMO_MENSAJE,
        'grpc.max_send_message_length': GRPC_TAMANO_MAXIMO_MENSAJE,
      },
    );
    cerrarCliente = () => cliente.close();
    grpc = new Proxy(
      {},
      {
        get:
          (_, metodo: string): Llamada =>
          (req) =>
            new Promise((ok, mal) =>
              cliente[metodo](req, (e: ServiceError | null, r: unknown) =>
                e ? mal(e) : ok(r),
              ),
            ),
      },
    );
  }, PLAZO_PREPARACION_MS);

  afterAll(async () => {
    cerrarCliente?.();
    await app?.close();
    await productor?.disconnect();
    await admin?.disconnect();
    await cerrar(mongo);
  });

  /** Lo que se espera de una llamada que falla: su código gRPC. */
  const codigo = (p: Promise<unknown>) =>
    p.then(
      () => 'OK',
      (e: ServiceError) => status[e.code],
    );

  /** Publica un evento con el formato de contracts/eventos/. */
  const publicar = (type: string, sesionId: string, estudianteId: string) =>
    productor.send({
      topic: type,
      messages: [
        {
          key: sesionId,
          value: JSON.stringify({
            eventId: randomUUID(),
            type,
            occurredAt: new Date().toISOString(),
            payload: {
              sesionId,
              tutorId: DEMO.tutorId,
              estudianteId,
              ramoCodigo: DEMO.ramoCodigo,
              inicio: '2026-11-19T18:00:00Z',
              fin: '2026-11-19T19:30:00Z',
            },
          }),
        },
      ],
    });

  /** Espera a que el consumidor deje la sesión en ese estado. */
  const esperarEstado = async (sesionId: string, estado: string) => {
    const sesiones = mongo.collection('sesiones');
    for (let i = 0; i < 120; i++) {
      const s = await sesiones.findOne({ _id: sesionId as never });
      if (s?.estado === estado) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`La sesión ${sesionId} nunca llegó a ${estado}`);
  };

  describe('material, con la visibilidad que dan los eventos de Kafka', () => {
    // Ids nuevos cada vez: los tópicos guardan los eventos de corridas anteriores.
    const alumno = randomUUID();
    const sesion = randomUUID();
    // Más de 4 MB: comprueba el límite de 11 MB del servidor gRPC.
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.7\n'),
      Buffer.alloc(6 * 1024 * 1024, 1),
    ]);
    let archivoId: string;

    const titulosQueVe = async (usuarioId: string) =>
      (await grpc.ListarMaterial({ usuarioId })).materiales.map(
        (m: { titulo: string }) => m.titulo,
      );

    it('el tutor sube un PDF de 6 MB y un aviso', async () => {
      const archivo = await grpc.SubirMaterial({
        tutorId: DEMO.tutorId,
        ramoCodigo: DEMO.ramoCodigo,
        titulo: 'Guía',
        archivo: {
          nombre: 'guia.pdf',
          tipoMime: 'application/pdf',
          datos: pdf,
        },
      });
      archivoId = archivo.id;
      await grpc.SubirMaterial({
        tutorId: DEMO.tutorId,
        ramoCodigo: DEMO.ramoCodigo,
        titulo: 'Jueves',
        texto: 'Traigan calculadora.',
      });

      expect(archivo).toMatchObject({
        tipo: 'ARCHIVO',
        archivo: { nombre: 'guia.pdf', tamanoBytes: pdf.length },
      });
      expect(await titulosQueVe(DEMO.tutorId)).toEqual(['Jueves', 'Guía']);
    });

    it('un alumno sin sesiones no ve nada ni puede descargar', async () => {
      expect(await titulosQueVe(alumno)).toEqual([]);
      expect(
        await codigo(
          grpc.DescargarArchivo({ id: archivoId, usuarioId: alumno }),
        ),
      ).toBe('NOT_FOUND');
    });

    it('con sesion.creada, el alumno ve el material y descarga los mismos bytes', async () => {
      await publicar('sesion.creada', sesion, alumno);
      await esperarEstado(sesion, 'CREADA');

      expect(await titulosQueVe(alumno)).toEqual(['Jueves', 'Guía']);
      const { datos } = await grpc.DescargarArchivo({
        id: archivoId,
        usuarioId: alumno,
      });
      expect(Buffer.compare(datos, pdf)).toBe(0);
    });

    it('un mensaje mal formado no traba la cola, y sesion.cancelada quita el acceso', async () => {
      await productor.send({
        topic: 'sesion.cancelada',
        messages: [{ key: sesion, value: 'esto no es JSON' }],
      });
      await publicar('sesion.cancelada', sesion, alumno);
      await esperarEstado(sesion, 'CANCELADA');

      expect(await titulosQueVe(alumno)).toEqual([]);
    });

    it('solo el dueño elimina, y se borra también el archivo de GridFS', async () => {
      expect(
        await codigo(grpc.EliminarMaterial({ id: archivoId, tutorId: alumno })),
      ).toBe('PERMISSION_DENIED');

      await grpc.EliminarMaterial({ id: archivoId, tutorId: DEMO.tutorId });

      expect(await titulosQueVe(DEMO.tutorId)).toEqual(['Jueves']);
      expect(await mongo.collection('archivos.files').countDocuments()).toBe(0);
      expect(await mongo.collection('archivos.chunks').countDocuments()).toBe(
        0,
      );
    });

    it.each([
      [
        'un GIF',
        {
          archivo: {
            nombre: 'a.gif',
            tipoMime: 'image/gif',
            datos: Buffer.from('GIF89a'),
          },
        },
      ],
      ['sin contenido', {}],
      [
        'a un ramo que el tutor no tiene',
        { ramoCodigo: 'FIS1514', texto: 'x' },
      ],
    ])('rechaza subir %s con el código del contrato', async (_caso, cambio) => {
      const esperado =
        _caso === 'a un ramo que el tutor no tiene'
          ? 'PERMISSION_DENIED'
          : 'INVALID_ARGUMENT';
      expect(
        await codigo(
          grpc.SubirMaterial({
            tutorId: DEMO.tutorId,
            ramoCodigo: DEMO.ramoCodigo,
            titulo: 'x',
            ...cambio,
          }),
        ),
      ).toBe(esperado);
    });
  });

  describe('evaluaciones', () => {
    const evaluar = {
      sesionId: DEMO.sesionFinalizadaId,
      estudianteId: DEMO.estudianteId,
      nota: 5,
      comentario: 'Explica muy bien.',
    };

    it('el alumno evalúa una sesión finalizada, una sola vez', async () => {
      const propia = await grpc.Evaluar(evaluar);

      expect(propia).toMatchObject({
        sesionId: DEMO.sesionFinalizadaId,
        tutorId: DEMO.tutorId,
        nota: 5,
      });
      expect(await codigo(grpc.Evaluar(evaluar))).toBe('ALREADY_EXISTS');
    });

    it('rechaza una sesión no finalizada y una nota fuera de rango', async () => {
      expect(
        await codigo(
          grpc.Evaluar({ ...evaluar, sesionId: DEMO.sesionPendienteId }),
        ),
      ).toBe('FAILED_PRECONDITION');
      expect(await codigo(grpc.Evaluar({ ...evaluar, nota: 9 }))).toBe(
        'INVALID_ARGUMENT',
      );
    });

    it('las vistas públicas son anónimas y el resumen incluye a los sin evaluaciones', async () => {
      const publicas = await grpc.ListarEvaluaciones({ tutorId: DEMO.tutorId });
      expect(publicas).toMatchObject({ promedio: 5, cantidad: 1 });
      expect(publicas.evaluaciones[0]).not.toHaveProperty('estudianteId');
      expect(publicas.evaluaciones[0]).not.toHaveProperty('sesionId');

      const mias = await grpc.ListarMisEvaluaciones({
        estudianteId: DEMO.estudianteId,
      });
      expect(mias.evaluaciones).toHaveLength(1);

      const sinEvaluaciones = randomUUID();
      const { resumenes } = await grpc.ObtenerResumenTutores({
        tutorIds: [DEMO.tutorId, sinEvaluaciones],
      });
      expect(resumenes).toEqual([
        { tutorId: DEMO.tutorId, promedio: 5, cantidad: 1 },
        { tutorId: sinEvaluaciones, promedio: 0, cantidad: 0 },
      ]);
    });
  });
  // Al final: para entonces el consumidor de Kafka ya procesó eventos.
  describe('sondas de Kubernetes (HTTP)', () => {
    const pedir = (ruta: string) =>
      fetch(`http://127.0.0.1:${puertoHttp}${ruta}`);

    it('/health/vivo responde 200', async () => {
      const r = await pedir('/health/vivo');
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ estado: 'ok' });
    });

    it('/health/listo informa Mongo y Kafka conectados', async () => {
      const r = await pedir('/health/listo');
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({
        estado: 'ok',
        mongo: 'conectado',
        kafka: 'conectado',
      });
    });
  });
});
