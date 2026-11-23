import {
  loadPackageDefinition,
  Server,
  ServerCredentials,
  ServerUnaryCall,
  ServiceError,
  status,
  UntypedServiceImplementation,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import {
  NoEncontradoError,
  ServicioNoDisponibleError,
} from '../common/errores/errores-dominio';
import {
  GRPC_OPCIONES_LOADER,
  GRPC_PROTO_SESIONES,
  GRPC_PROTO_USUARIOS,
} from '../common/grpc/grpc.constantes';
import { SesionesGrpc } from './sesiones/sesiones.grpc';
import { UsuariosGrpc } from './usuarios/usuarios.grpc';

/**
 * Levanta Usuarios y Sesiones "de mentira", pero con sus .proto reales de
 * contracts/: si el cliente no habla exactamente ese contrato, falla aquí.
 */
type Respuesta = (req: Record<string, unknown>) => object | ServiceError | null;

function errorGrpc(code: status, details: string): ServiceError {
  return Object.assign(new Error(details), {
    code,
    details,
    metadata: undefined as never,
  });
}

function implementacion(
  responder: () => Respuesta,
): UntypedServiceImplementation {
  return new Proxy(
    {},
    {
      get:
        () =>
        (
          call: ServerUnaryCall<Record<string, unknown>, object>,
          cb: (e: unknown, r?: object) => void,
        ) => {
          const r = responder()(call.request);
          if (r === null) return; // nunca responde: para probar el plazo
          return r instanceof Error ? cb(r) : cb(null, r);
        },
    },
  ) as UntypedServiceImplementation;
}

describe('Clientes gRPC reales', () => {
  let servidor: Server;
  let url: string;
  let respuesta: Respuesta;
  let recibido: Record<string, unknown>;

  const responder = () => (req: Record<string, unknown>) => {
    recibido = req;
    return respuesta(req);
  };

  beforeAll(async () => {
    const servicio = (proto: string, ruta: string[]) =>
      ruta.reduce<any>(
        (nodo, parte) => nodo[parte],
        loadPackageDefinition(loadSync(proto, GRPC_OPCIONES_LOADER)),
      ).service;

    servidor = new Server();
    servidor.addService(
      servicio(GRPC_PROTO_USUARIOS, [
        'tutorias',
        'usuarios',
        'v1',
        'UsuariosService',
      ]),
      implementacion(responder),
    );
    servidor.addService(
      servicio(GRPC_PROTO_SESIONES, [
        'tutorias',
        'sesiones',
        'v1',
        'SesionesService',
      ]),
      implementacion(responder),
    );
    const puerto = await new Promise<number>((ok, mal) =>
      servidor.bindAsync(
        '127.0.0.1:0',
        ServerCredentials.createInsecure(),
        (e, p) => (e ? mal(e) : ok(p)),
      ),
    );
    url = `127.0.0.1:${puerto}`;
  });

  afterAll(() => servidor.forceShutdown());

  describe('UsuariosGrpc.validarTutorRamo', () => {
    let usuarios: UsuariosGrpc;
    beforeEach(() => (usuarios = new UsuariosGrpc(url, 300)));
    afterEach(() => usuarios.onModuleDestroy());

    it.each([true, false])(
      'devuelve valido=%p y envía tutor_id y ramo_codigo',
      async (valido) => {
        respuesta = () => ({ valido });

        expect(await usuarios.validarTutorRamo('tutor-1', 'MAT1610')).toBe(
          valido,
        );
        expect(recibido).toEqual({ tutorId: 'tutor-1', ramoCodigo: 'MAT1610' });
      },
    );

    it('si Usuarios tarda más que el plazo, lo da por caído', async () => {
      respuesta = () => null;
      await expect(usuarios.validarTutorRamo('t', 'r')).rejects.toThrow(
        ServicioNoDisponibleError,
      );
    });

    it('un error inesperado de Usuarios no se disfraza de otra cosa', async () => {
      respuesta = () =>
        errorGrpc(status.INVALID_ARGUMENT, 'tutor_id mal formado');
      await expect(usuarios.validarTutorRamo('t', 'r')).rejects.toThrow(
        'Usuarios.ValidarTutorRamo respondió INVALID_ARGUMENT: tutor_id mal formado',
      );
    });
  });

  describe('SesionesGrpc.verificarParticipacion', () => {
    let sesiones: SesionesGrpc;
    beforeEach(() => (sesiones = new SesionesGrpc(url, 300)));
    afterEach(() => sesiones.onModuleDestroy());

    it('devuelve la participación con el tutor y el ramo', async () => {
      respuesta = () => ({
        finalizada: true,
        participo: true,
        tutorId: 'tutor-1',
        ramoCodigo: 'MAT1610',
      });

      expect(
        await sesiones.verificarParticipacion('sesion-1', 'alumno-1'),
      ).toEqual({
        finalizada: true,
        participo: true,
        tutorId: 'tutor-1',
        ramoCodigo: 'MAT1610',
      });
      expect(recibido).toEqual({
        sesionId: 'sesion-1',
        estudianteId: 'alumno-1',
      });
    });

    it('NOT_FOUND de Sesiones se traduce a NoEncontradoError', async () => {
      respuesta = () => errorGrpc(status.NOT_FOUND, 'Sesión no encontrada');
      await expect(sesiones.verificarParticipacion('s', 'a')).rejects.toThrow(
        NoEncontradoError,
      );
    });
  });

  it('si el servicio no está levantado, lo da por caído', async () => {
    // Puerto donde no escucha nadie.
    const usuarios = new UsuariosGrpc('127.0.0.1:1', 1_000);
    await expect(usuarios.validarTutorRamo('t', 'r')).rejects.toThrow(
      ServicioNoDisponibleError,
    );
    usuarios.onModuleDestroy();
  });
});
