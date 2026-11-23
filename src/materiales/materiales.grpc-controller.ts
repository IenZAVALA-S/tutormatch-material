import { Controller, UseFilters } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GrpcExceptionFilter } from '../common/filtros/grpc-exception.filter';
import type {
  DescargarArchivoRequest,
  DescargarArchivoResponse,
  EliminarMaterialRequest,
  ListarMaterialRequest,
  ListarMaterialResponse,
  MaterialGrpc,
  SubirMaterialRequest,
} from './materiales.grpc.types';
import { aArchivo, aMaterial } from './materiales.mapper';
import { MaterialesService } from './materiales.service';

const SERVICIO = 'MaterialService';

// Con gRPC dentro de una app HTTP (híbrida), useGlobalFilters no llega a los
// controladores gRPC: el filtro se pone en cada uno. Probado contra gRPC real.
@Controller()
@UseFilters(GrpcExceptionFilter)
export class MaterialesGrpcController {
  constructor(private readonly servicio: MaterialesService) {}

  @GrpcMethod(SERVICIO, 'SubirMaterial')
  async subirMaterial(req: SubirMaterialRequest): Promise<MaterialGrpc> {
    const material = await this.servicio.subir({
      tutorId: req.tutorId,
      ramoCodigo: req.ramoCodigo,
      titulo: req.titulo,
      // "contenido" dice cuál de los dos campos del oneof vino.
      texto: req.contenido === 'texto' ? req.texto : undefined,
      archivo: req.contenido === 'archivo' ? req.archivo : undefined,
    });
    return aMaterial(material);
  }

  @GrpcMethod(SERVICIO, 'ListarMaterial')
  async listarMaterial(
    req: ListarMaterialRequest,
  ): Promise<ListarMaterialResponse> {
    const materiales = await this.servicio.listar(req);
    return { materiales: materiales.map(aMaterial) };
  }

  @GrpcMethod(SERVICIO, 'DescargarArchivo')
  async descargarArchivo(
    req: DescargarArchivoRequest,
  ): Promise<DescargarArchivoResponse> {
    const { archivo, datos } = await this.servicio.descargar(
      req.id,
      req.usuarioId,
    );
    return { archivo: aArchivo(archivo), datos };
  }

  @GrpcMethod(SERVICIO, 'EliminarMaterial')
  async eliminarMaterial(req: EliminarMaterialRequest): Promise<object> {
    await this.servicio.eliminar(req.id, req.tutorId);
    return {};
  }
}
