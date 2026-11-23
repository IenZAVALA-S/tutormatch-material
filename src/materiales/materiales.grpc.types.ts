import { TimestampGrpc } from '../common/grpc/timestamp';
import { TipoMaterial } from './schemas/materiales.schema';

// Forma de los mensajes de material.proto tal como los entrega proto-loader
// (campos en camelCase; ver GRPC_OPCIONES_LOADER).

export interface ArchivoSubidoGrpc {
  nombre: string;
  tipoMime: string;
  datos: Buffer;
}

export interface SubirMaterialRequest {
  tutorId: string;
  ramoCodigo: string;
  titulo: string;
  /** Qué campo del oneof vino; undefined si no vino ninguno. */
  contenido?: 'texto' | 'archivo';
  texto?: string;
  archivo?: ArchivoSubidoGrpc;
}

export interface ListarMaterialRequest {
  usuarioId: string;
  tutorId: string;
  ramoCodigo: string;
}

export interface DescargarArchivoRequest {
  id: string;
  usuarioId: string;
}

export interface EliminarMaterialRequest {
  id: string;
  tutorId: string;
}

export interface ArchivoGrpc {
  nombre: string;
  tipoMime: string;
  tamanoBytes: number;
}

export interface MaterialGrpc {
  id: string;
  tutorId: string;
  ramoCodigo: string;
  tipo: TipoMaterial;
  titulo: string;
  texto?: string;
  archivo?: ArchivoGrpc;
  creadoEn: TimestampGrpc;
}

export interface ListarMaterialResponse {
  materiales: MaterialGrpc[];
}

export interface DescargarArchivoResponse {
  archivo: ArchivoGrpc;
  datos: Buffer;
}
