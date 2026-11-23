import { Injectable, Logger } from '@nestjs/common';
import { UsuariosPort } from '../clientes/usuarios/usuarios.port';
import {
  ArgumentoInvalidoError,
  NoEncontradoError,
  PermisoDenegadoError,
} from '../common/errores/errores-dominio';
import { exigirUuid } from '../common/validacion/validaciones';
import { SesionesRepository } from '../sesiones/sesiones.repository';
import { ArchivosStorage } from './archivos.storage';
import { MaterialesRepository } from './materiales.repository';
import {
  ArchivoInfo,
  Material,
  TAMANO_MAXIMO_BYTES,
  TipoMaterial,
} from './schemas/materiales.schema';

export const TITULO_MAXIMO = 200;
export const NOMBRE_ARCHIVO_MAXIMO = 255;

/**
 * Primeros bytes de cada tipo permitido. Se revisan además del tipo_mime que
 * declara el BFF, para no guardar, por ejemplo, un .exe renombrado a .pdf.
 */
const FIRMAS: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/png': [0x89, 0x50, 0x4e, 0x47], // \x89PNG
  'image/jpeg': [0xff, 0xd8, 0xff],
};

export interface ArchivoSubido {
  nombre: string;
  tipoMime: string;
  datos: Buffer;
}

export interface SubirMaterialComando {
  tutorId: string;
  ramoCodigo: string;
  titulo: string;
  /** Exactamente uno de los dos. */
  texto?: string;
  archivo?: ArchivoSubido;
}

export interface ListarMaterialComando {
  usuarioId: string;
  tutorId: string;
  ramoCodigo: string;
}

export interface ArchivoDescargado {
  archivo: ArchivoInfo;
  datos: Buffer;
}

@Injectable()
export class MaterialesService {
  private readonly logger = new Logger(MaterialesService.name);

  constructor(
    private readonly repositorio: MaterialesRepository,
    private readonly archivos: ArchivosStorage,
    private readonly sesiones: SesionesRepository,
    private readonly usuarios: UsuariosPort,
  ) {}

  async subir(comando: SubirMaterialComando): Promise<Material> {
    // 1. Validar todo lo que no necesita a nadie más.
    exigirUuid(comando.tutorId, 'tutor_id');
    const ramoCodigo = exigirTexto(comando.ramoCodigo, 'ramo_codigo');
    const titulo = exigirTexto(comando.titulo, 'titulo', TITULO_MAXIMO);
    const contenido = this.validarContenido(comando);

    // 2. Preguntar a Usuarios si es tutor activo de ese ramo.
    const esTutor = await this.usuarios.validarTutorRamo(
      comando.tutorId,
      ramoCodigo,
    );
    if (!esTutor) {
      throw new PermisoDenegadoError(
        `No eres tutor activo del ramo ${ramoCodigo}`,
      );
    }

    const base = { tutorId: comando.tutorId, ramoCodigo, titulo };
    if (contenido.tipo === TipoMaterial.AVISO) {
      return this.repositorio.crear({ ...base, ...contenido });
    }

    // 3. Archivo: primero los bytes en GridFS, después el documento.
    const { nombre, tipoMime, datos } = contenido.archivo;
    const gridfsId = await this.archivos.guardar(nombre, datos);
    try {
      return await this.repositorio.crear({
        ...base,
        tipo: TipoMaterial.ARCHIVO,
        archivo: { gridfsId, nombre, tipoMime, tamanoBytes: datos.length },
      });
    } catch (error) {
      // Sin documento nadie llegaría a esos bytes: se borran.
      await this.archivos.borrar(gridfsId).catch(() => undefined);
      throw error;
    }
  }

  async listar(comando: ListarMaterialComando): Promise<Material[]> {
    exigirUuid(comando.usuarioId, 'usuario_id');
    if (comando.tutorId) exigirUuid(comando.tutorId, 'tutor_id');

    const visibles = await this.sesiones.tutoresRamosVisibles(
      comando.usuarioId,
    );
    return this.repositorio.listar({
      visibles,
      usuarioId: comando.usuarioId,
      tutorId: comando.tutorId,
      ramoCodigo: comando.ramoCodigo.trim(),
    });
  }

  async descargar(id: string, usuarioId: string): Promise<ArchivoDescargado> {
    exigirUuid(id, 'id');
    exigirUuid(usuarioId, 'usuario_id');

    const material = await this.repositorio.buscarPorId(id);
    // Mismo error si no existe o si no lo puede ver: así no se revela que existe.
    if (!material || !(await this.puedeVer(usuarioId, material))) {
      throw new NoEncontradoError(`Material ${id} no encontrado`);
    }
    if (!material.archivo) {
      throw new ArgumentoInvalidoError(
        'Un aviso no tiene archivo que descargar',
      );
    }

    const datos = await this.archivos.leer(material.archivo.gridfsId);
    return { archivo: material.archivo, datos };
  }

  async eliminar(id: string, tutorId: string): Promise<void> {
    exigirUuid(id, 'id');
    exigirUuid(tutorId, 'tutor_id');

    const material = await this.repositorio.buscarPorId(id);
    if (!material) {
      throw new NoEncontradoError(`Material ${id} no encontrado`);
    }
    if (material.tutorId !== tutorId) {
      throw new PermisoDenegadoError(
        'Solo el dueño puede eliminar su material',
      );
    }

    // Primero el documento: si falla lo demás, el material ya no se ve.
    await this.repositorio.eliminar(id);
    if (material.archivo) {
      await this.archivos.borrar(material.archivo.gridfsId).catch((error) =>
        // Queda un archivo huérfano en GridFS, pero nadie puede llegar a él.
        this.logger.warn(`No se pudo borrar el archivo de ${id}`, error),
      );
    }
  }

  private puedeVer(usuarioId: string, material: Material): Promise<boolean> {
    if (material.tutorId === usuarioId) return Promise.resolve(true);
    return this.sesiones.tieneSesionVigente(usuarioId, material);
  }

  private validarContenido(
    comando: SubirMaterialComando,
  ):
    | { tipo: TipoMaterial.AVISO; texto: string }
    | { tipo: TipoMaterial.ARCHIVO; archivo: ArchivoSubido } {
    if (comando.texto !== undefined && comando.archivo !== undefined) {
      throw new ArgumentoInvalidoError('Envía texto o archivo, no ambos');
    }
    if (comando.texto !== undefined) {
      const texto = exigirTexto(comando.texto, 'texto');
      return { tipo: TipoMaterial.AVISO, texto };
    }
    if (comando.archivo !== undefined) {
      return {
        tipo: TipoMaterial.ARCHIVO,
        archivo: validarArchivo(comando.archivo),
      };
    }
    throw new ArgumentoInvalidoError('Falta el contenido: texto o archivo');
  }
}

function exigirTexto(valor: string, campo: string, maximo?: number): string {
  const limpio = (valor ?? '').trim();
  if (!limpio) {
    throw new ArgumentoInvalidoError(`Falta ${campo}`);
  }
  if (maximo !== undefined && limpio.length > maximo) {
    throw new ArgumentoInvalidoError(
      `${campo} no puede superar ${maximo} caracteres`,
    );
  }
  return limpio;
}

function validarArchivo(archivo: ArchivoSubido): ArchivoSubido {
  const nombre = exigirTexto(
    archivo.nombre,
    'archivo.nombre',
    NOMBRE_ARCHIVO_MAXIMO,
  );
  const datos = archivo.datos ?? Buffer.alloc(0);

  if (datos.length === 0) {
    throw new ArgumentoInvalidoError('El archivo está vacío');
  }
  if (datos.length > TAMANO_MAXIMO_BYTES) {
    throw new ArgumentoInvalidoError('El archivo supera los 10 MB');
  }
  const firma = FIRMAS[archivo.tipoMime];
  if (!firma) {
    throw new ArgumentoInvalidoError('Solo se aceptan PDF, PNG o JPEG');
  }
  if (!firma.every((byte, i) => datos[i] === byte)) {
    throw new ArgumentoInvalidoError(
      `El contenido del archivo no es un ${archivo.tipoMime} válido`,
    );
  }
  return { nombre, tipoMime: archivo.tipoMime, datos };
}
