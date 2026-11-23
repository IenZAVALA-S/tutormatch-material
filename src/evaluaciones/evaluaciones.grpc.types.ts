import { TimestampGrpc } from '../common/grpc/timestamp';

export interface EvaluarRequest {
  sesionId: string;
  estudianteId: string;
  nota: number;
  comentario: string;
}

export interface ListarEvaluacionesRequest {
  tutorId: string;
}

export interface ListarMisEvaluacionesRequest {
  estudianteId: string;
}

export interface ObtenerResumenTutoresRequest {
  tutorIds: string[];
}

export interface EvaluacionAnonimaGrpc {
  ramoCodigo: string;
  nota: number;
  comentario: string;
  creadaEn: TimestampGrpc;
}

export interface EvaluacionPropiaGrpc {
  sesionId: string;
  tutorId: string;
  ramoCodigo: string;
  nota: number;
  comentario: string;
  creadaEn: TimestampGrpc;
}

export interface ListarEvaluacionesResponse {
  evaluaciones: EvaluacionAnonimaGrpc[];
  promedio: number;
  cantidad: number;
}

export interface ListarMisEvaluacionesResponse {
  evaluaciones: EvaluacionPropiaGrpc[];
}

export interface ResumenTutorGrpc {
  tutorId: string;
  promedio: number;
  cantidad: number;
}

export interface ObtenerResumenTutoresResponse {
  resumenes: ResumenTutorGrpc[];
}
