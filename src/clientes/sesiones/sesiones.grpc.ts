import { OnModuleDestroy } from '@nestjs/common';
import { GRPC_PROTO_SESIONES } from '../../common/grpc/grpc.constantes';
import { ClienteGrpc, PLAZO_GRPC_MS } from '../grpc/cliente-grpc';
import { Participacion, SesionesPort } from './sesiones.port';

/** Cliente real de Sesiones (Spring Boot, Vicente). */
export class SesionesGrpc extends SesionesPort implements OnModuleDestroy {
  private readonly grpc: ClienteGrpc;

  constructor(url: string, plazoMs = PLAZO_GRPC_MS) {
    super();
    this.grpc = new ClienteGrpc(
      'Sesiones',
      GRPC_PROTO_SESIONES,
      'tutorias.sesiones.v1.SesionesService',
      url,
      plazoMs,
    );
  }

  /** La respuesta ya trae exactamente los campos de Participacion. */
  verificarParticipacion(
    sesionId: string,
    estudianteId: string,
  ): Promise<Participacion> {
    return this.grpc.llamar<Participacion>('VerificarParticipacion', {
      sesionId,
      estudianteId,
    });
  }

  onModuleDestroy(): void {
    this.grpc.cerrar();
  }
}
