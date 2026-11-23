import { Controller, UseFilters } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GrpcExceptionFilter } from '../common/filtros/grpc-exception.filter';
import type {
  EvaluacionPropiaGrpc,
  EvaluarRequest,
  ListarEvaluacionesRequest,
  ListarEvaluacionesResponse,
  ListarMisEvaluacionesRequest,
  ListarMisEvaluacionesResponse,
  ObtenerResumenTutoresRequest,
  ObtenerResumenTutoresResponse,
} from './evaluaciones.grpc.types';
import { aEvaluacionAnonima, aEvaluacionPropia } from './evaluaciones.mapper';
import { EvaluacionesService } from './evaluaciones.service';

const SERVICIO = 'MaterialService';

// Con gRPC dentro de una app HTTP (híbrida), useGlobalFilters no llega a los
// controladores gRPC: el filtro se pone en cada uno. Probado contra gRPC real.
@Controller()
@UseFilters(GrpcExceptionFilter)
export class EvaluacionesGrpcController {
  constructor(private readonly servicio: EvaluacionesService) {}

  @GrpcMethod(SERVICIO, 'Evaluar')
  async evaluar(req: EvaluarRequest): Promise<EvaluacionPropiaGrpc> {
    const evaluacion = await this.servicio.evaluar(req);
    return aEvaluacionPropia(evaluacion);
  }

  @GrpcMethod(SERVICIO, 'ListarEvaluaciones')
  async listarEvaluaciones(
    req: ListarEvaluacionesRequest,
  ): Promise<ListarEvaluacionesResponse> {
    const r = await this.servicio.listarEvaluaciones(req.tutorId);
    return {
      evaluaciones: r.evaluaciones.map(aEvaluacionAnonima),
      promedio: r.promedio,
      cantidad: r.cantidad,
    };
  }

  @GrpcMethod(SERVICIO, 'ListarMisEvaluaciones')
  async listarMisEvaluaciones(
    req: ListarMisEvaluacionesRequest,
  ): Promise<ListarMisEvaluacionesResponse> {
    const evaluaciones = await this.servicio.listarMisEvaluaciones(
      req.estudianteId,
    );
    return { evaluaciones: evaluaciones.map(aEvaluacionPropia) };
  }

  @GrpcMethod(SERVICIO, 'ObtenerResumenTutores')
  async obtenerResumenTutores(
    req: ObtenerResumenTutoresRequest,
  ): Promise<ObtenerResumenTutoresResponse> {
    const resumenes = await this.servicio.obtenerResumenTutores(req.tutorIds);
    return { resumenes };
  }
}
