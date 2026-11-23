import { aTimestamp } from '../common/grpc/timestamp';
import {
  EvaluacionAnonimaGrpc,
  EvaluacionPropiaGrpc,
} from './evaluaciones.grpc.types';
import { Evaluacion } from './schemas/evaluaciones.schema';

export function aEvaluacionAnonima(e: Evaluacion): EvaluacionAnonimaGrpc {
  return {
    ramoCodigo: e.ramoCodigo,
    nota: e.nota,
    comentario: e.comentario,
    creadaEn: aTimestamp(e.creadaEn),
  };
}
export function aEvaluacionPropia(e: Evaluacion): EvaluacionPropiaGrpc {
  return {
    sesionId: e.sesionId,
    tutorId: e.tutorId,
    ramoCodigo: e.ramoCodigo,
    nota: e.nota,
    comentario: e.comentario,
    creadaEn: aTimestamp(e.creadaEn),
  };
}
