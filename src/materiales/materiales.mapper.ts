import { aTimestamp } from '../common/grpc/timestamp';
import { ArchivoGrpc, MaterialGrpc } from './materiales.grpc.types';
import { ArchivoInfo, Material } from './schemas/materiales.schema';

/** Datos públicos del archivo: nunca el gridfsId, que es un detalle interno. */
export function aArchivo(a: ArchivoInfo): ArchivoGrpc {
  return {
    nombre: a.nombre,
    tipoMime: a.tipoMime,
    tamanoBytes: a.tamanoBytes,
  };
}

export function aMaterial(m: Material): MaterialGrpc {
  return {
    id: m._id,
    tutorId: m.tutorId,
    ramoCodigo: m.ramoCodigo,
    tipo: m.tipo,
    titulo: m.titulo,
    texto: m.texto,
    archivo: m.archivo && aArchivo(m.archivo),
    creadoEn: aTimestamp(m.creadoEn),
  };
}
