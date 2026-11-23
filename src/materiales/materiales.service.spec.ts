import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { DEMO } from '../clientes/datos-demo';
import { UsuariosFake } from '../clientes/usuarios/usuarios.fake';
import {
  ArgumentoInvalidoError,
  NoEncontradoError,
  PermisoDenegadoError,
} from '../common/errores/errores-dominio';
import { EstadoSesion } from '../sesiones/schemas/sesiones.schema';
import { SesionesRepository, TutorRamo } from '../sesiones/sesiones.repository';
import { ArchivosStorage } from './archivos.storage';
import {
  FiltroMaterial,
  MaterialesRepository,
  NuevoMaterial,
} from './materiales.repository';
import {
  ArchivoSubido,
  MaterialesService,
  SubirMaterialComando,
} from './materiales.service';
import { Material, TipoMaterial } from './schemas/materiales.schema';

// ---- Versiones en memoria: se portan como las reales, sin necesitar Mongo ----

class MaterialesEnMemoria {
  readonly guardados: Material[] = [];
  private reloj = Date.parse('2026-11-20T18:00:00Z');

  crear(datos: NuevoMaterial): Promise<Material> {
    // Cada uno un segundo después del anterior, para probar el orden.
    const material = {
      ...datos,
      _id: randomUUID(),
      creadoEn: new Date((this.reloj += 1000)),
    };
    this.guardados.push(material);
    return Promise.resolve(material);
  }

  buscarPorId(id: string): Promise<Material | null> {
    return Promise.resolve(this.guardados.find((m) => m._id === id) ?? null);
  }

  listar(f: FiltroMaterial): Promise<Material[]> {
    const visible = (m: Material) =>
      m.tutorId === f.usuarioId ||
      f.visibles.some(
        (v) => v.tutorId === m.tutorId && v.ramoCodigo === m.ramoCodigo,
      );
    return Promise.resolve(
      this.guardados
        .filter(visible)
        .filter((m) => !f.tutorId || m.tutorId === f.tutorId)
        .filter((m) => !f.ramoCodigo || m.ramoCodigo === f.ramoCodigo)
        .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime()),
    );
  }

  eliminar(id: string): Promise<void> {
    const i = this.guardados.findIndex((m) => m._id === id);
    if (i >= 0) this.guardados.splice(i, 1);
    return Promise.resolve();
  }
}

class ArchivosEnMemoria {
  readonly archivos = new Map<string, Buffer>();

  guardar(_nombre: string, datos: Buffer): Promise<Types.ObjectId> {
    const id = new Types.ObjectId();
    this.archivos.set(id.toHexString(), datos);
    return Promise.resolve(id);
  }

  leer(id: Types.ObjectId): Promise<Buffer> {
    return Promise.resolve(this.archivos.get(id.toHexString())!);
  }

  borrar(id: Types.ObjectId): Promise<void> {
    this.archivos.delete(id.toHexString());
    return Promise.resolve();
  }
}

interface SesionCopia extends TutorRamo {
  estudianteId: string;
  estado: EstadoSesion;
}

class SesionesEnMemoria {
  readonly sesiones: SesionCopia[] = [];

  private vigentes(estudianteId: string) {
    return this.sesiones.filter(
      (s) =>
        s.estudianteId === estudianteId && s.estado !== EstadoSesion.CANCELADA,
    );
  }

  tieneSesionVigente(estudianteId: string, tr: TutorRamo): Promise<boolean> {
    return Promise.resolve(
      this.vigentes(estudianteId).some(
        (s) => s.tutorId === tr.tutorId && s.ramoCodigo === tr.ramoCodigo,
      ),
    );
  }

  tutoresRamosVisibles(estudianteId: string): Promise<TutorRamo[]> {
    return Promise.resolve(
      this.vigentes(estudianteId).map(({ tutorId, ramoCodigo }) => ({
        tutorId,
        ramoCodigo,
      })),
    );
  }
}

// ---- Datos de prueba ----

const PDF = Buffer.from('%PDF-1.7 contenido');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const archivoPdf: ArchivoSubido = {
  nombre: 'guia.pdf',
  tipoMime: 'application/pdf',
  datos: PDF,
};

describe('MaterialesService', () => {
  let materiales: MaterialesEnMemoria;
  let archivos: ArchivosEnMemoria;
  let sesiones: SesionesEnMemoria;
  let usuarios: UsuariosFake;
  let servicio: MaterialesService;

  const aviso: SubirMaterialComando = {
    tutorId: DEMO.tutorId,
    ramoCodigo: DEMO.ramoCodigo,
    titulo: '  Para el jueves  ',
    texto: 'Traigan calculadora.',
  };
  const conArchivo: SubirMaterialComando = {
    tutorId: DEMO.tutorId,
    ramoCodigo: DEMO.ramoCodigo,
    titulo: 'Guía de integrales',
    archivo: archivoPdf,
  };

  /** El alumno tiene una sesión con el tutor de demo en MAT1610. */
  const darSesion = (estado = EstadoSesion.CREADA) =>
    sesiones.sesiones.push({
      tutorId: DEMO.tutorId,
      estudianteId: DEMO.estudianteId,
      ramoCodigo: DEMO.ramoCodigo,
      estado,
    });

  beforeEach(() => {
    materiales = new MaterialesEnMemoria();
    archivos = new ArchivosEnMemoria();
    sesiones = new SesionesEnMemoria();
    usuarios = new UsuariosFake(); // DEMO.tutorId tiene MAT1610 activo
    servicio = new MaterialesService(
      materiales as unknown as MaterialesRepository,
      archivos as unknown as ArchivosStorage,
      sesiones as unknown as SesionesRepository,
      usuarios,
    );
  });

  describe('subir', () => {
    it('crea un aviso, con el título sin espacios sobrantes', async () => {
      const material = await servicio.subir(aviso);

      expect(material).toMatchObject({
        tipo: TipoMaterial.AVISO,
        titulo: 'Para el jueves',
        texto: 'Traigan calculadora.',
      });
      expect(material.archivo).toBeUndefined();
    });

    it('crea un archivo: guarda los bytes en GridFS y los datos en el documento', async () => {
      const material = await servicio.subir(conArchivo);

      expect(material.tipo).toBe(TipoMaterial.ARCHIVO);
      expect(material.archivo).toMatchObject({
        nombre: 'guia.pdf',
        tipoMime: 'application/pdf',
        tamanoBytes: PDF.length,
      });
      expect(archivos.archivos.size).toBe(1);
    });

    it('acepta PNG', async () => {
      const material = await servicio.subir({
        ...conArchivo,
        archivo: { nombre: 'a.png', tipoMime: 'image/png', datos: PNG },
      });
      expect(material.archivo?.tipoMime).toBe('image/png');
    });

    it('rechaza si no es tutor activo del ramo', async () => {
      usuarios.quitarRamo(DEMO.tutorId, DEMO.ramoCodigo);
      await expect(servicio.subir(aviso)).rejects.toThrow(PermisoDenegadoError);
    });

    it.each<[string, Partial<SubirMaterialComando>]>([
      ['sin contenido', { texto: undefined }],
      ['con texto y archivo a la vez', { archivo: archivoPdf }],
      ['un aviso sin texto', { texto: '   ' }],
      ['sin título', { titulo: '' }],
      ['un título de más de 200 caracteres', { titulo: 'a'.repeat(201) }],
      ['sin ramo', { ramoCodigo: '' }],
      ['un tutor_id que no es UUID', { tutorId: 'hola' }],
    ])('rechaza %s', async (_caso, cambio) => {
      await expect(servicio.subir({ ...aviso, ...cambio })).rejects.toThrow(
        ArgumentoInvalidoError,
      );
    });

    it.each<[string, Partial<ArchivoSubido>]>([
      ['un tipo no permitido', { tipoMime: 'image/gif' }],
      ['bytes que no son de un PDF', { datos: Buffer.from('MZ ejecutable') }],
      ['un PDF declarado como PNG', { tipoMime: 'image/png' }],
      ['un archivo vacío', { datos: Buffer.alloc(0) }],
      [
        'más de 10 MB',
        { datos: Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]) },
      ],
      ['un archivo sin nombre', { nombre: '' }],
    ])('rechaza %s', async (_caso, cambio) => {
      await expect(
        servicio.subir({
          ...conArchivo,
          archivo: { ...archivoPdf, ...cambio },
        }),
      ).rejects.toThrow(ArgumentoInvalidoError);
    });

    it('no guarda nada cuando la validación falla', async () => {
      await expect(
        servicio.subir({
          ...conArchivo,
          archivo: { ...archivoPdf, tipoMime: 'image/gif' },
        }),
      ).rejects.toThrow();
      expect(materiales.guardados).toHaveLength(0);
      expect(archivos.archivos.size).toBe(0);
    });

    it('borra los bytes si falla guardar el documento', async () => {
      jest
        .spyOn(materiales, 'crear')
        .mockRejectedValue(new Error('Mongo no responde'));

      await expect(servicio.subir(conArchivo)).rejects.toThrow(
        'Mongo no responde',
      );
      expect(archivos.archivos.size).toBe(0);
    });
  });

  describe('listar', () => {
    const listarComo = (usuarioId: string, filtros = {}) =>
      servicio.listar({ usuarioId, tutorId: '', ramoCodigo: '', ...filtros });

    beforeEach(async () => {
      await servicio.subir(aviso);
      await servicio.subir(conArchivo);
    });

    it('el tutor ve su propio material, del más nuevo al más antiguo', async () => {
      const lista = await listarComo(DEMO.tutorId);
      expect(lista.map((m) => m.titulo)).toEqual([
        'Guía de integrales',
        'Para el jueves',
      ]);
    });

    it('un alumno sin sesiones con el tutor no ve nada', async () => {
      expect(await listarComo(DEMO.estudianteId)).toEqual([]);
    });

    it('un alumno con una sesión no cancelada lo ve', async () => {
      darSesion(EstadoSesion.FINALIZADA);
      expect(await listarComo(DEMO.estudianteId)).toHaveLength(2);
    });

    it('una sesión cancelada no da acceso', async () => {
      darSesion(EstadoSesion.CANCELADA);
      expect(await listarComo(DEMO.estudianteId)).toEqual([]);
    });

    it('la sesión da acceso solo al material de ese ramo', async () => {
      darSesion();
      usuarios.agregarRamo(DEMO.tutorId, 'FIS1514');
      await servicio.subir({ ...aviso, ramoCodigo: 'FIS1514' });

      const lista = await listarComo(DEMO.estudianteId);
      expect(lista.every((m) => m.ramoCodigo === DEMO.ramoCodigo)).toBe(true);
    });

    it('si el tutor quita el ramo, su material sigue visible', async () => {
      darSesion();
      usuarios.quitarRamo(DEMO.tutorId, DEMO.ramoCodigo);
      expect(await listarComo(DEMO.estudianteId)).toHaveLength(2);
    });

    it('filtra por ramo', async () => {
      expect(await listarComo(DEMO.tutorId, { ramoCodigo: 'OTRO' })).toEqual(
        [],
      );
    });
  });

  describe('descargar', () => {
    it('el tutor descarga los bytes de su archivo', async () => {
      const { _id } = await servicio.subir(conArchivo);

      const { archivo, datos } = await servicio.descargar(_id, DEMO.tutorId);

      expect(archivo.nombre).toBe('guia.pdf');
      expect(datos.equals(PDF)).toBe(true);
    });

    it('un alumno con sesión puede descargar', async () => {
      const { _id } = await servicio.subir(conArchivo);
      darSesion();
      await expect(
        servicio.descargar(_id, DEMO.estudianteId),
      ).resolves.toBeDefined();
    });

    it('si no lo puede ver, responde igual que si no existiera', async () => {
      const { _id } = await servicio.subir(conArchivo);
      await expect(servicio.descargar(_id, DEMO.estudianteId)).rejects.toThrow(
        NoEncontradoError,
      );
    });

    it('rechaza un id que no existe', async () => {
      await expect(
        servicio.descargar(randomUUID(), DEMO.tutorId),
      ).rejects.toThrow(NoEncontradoError);
    });

    it('rechaza descargar un aviso', async () => {
      const { _id } = await servicio.subir(aviso);
      await expect(servicio.descargar(_id, DEMO.tutorId)).rejects.toThrow(
        ArgumentoInvalidoError,
      );
    });
  });

  describe('eliminar', () => {
    it('el dueño borra el documento y el archivo', async () => {
      const { _id } = await servicio.subir(conArchivo);

      await servicio.eliminar(_id, DEMO.tutorId);

      expect(materiales.guardados).toHaveLength(0);
      expect(archivos.archivos.size).toBe(0);
    });

    it('nadie más puede borrarlo', async () => {
      const { _id } = await servicio.subir(conArchivo);
      await expect(servicio.eliminar(_id, DEMO.estudianteId)).rejects.toThrow(
        PermisoDenegadoError,
      );
      expect(materiales.guardados).toHaveLength(1);
    });

    it('rechaza un id que no existe', async () => {
      await expect(
        servicio.eliminar(randomUUID(), DEMO.tutorId),
      ).rejects.toThrow(NoEncontradoError);
    });
  });
});
