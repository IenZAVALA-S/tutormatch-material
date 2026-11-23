import { OnModuleDestroy } from '@nestjs/common';
import { GRPC_PROTO_USUARIOS } from '../../common/grpc/grpc.constantes';
import { ClienteGrpc, PLAZO_GRPC_MS } from '../grpc/cliente-grpc';
import { UsuariosPort } from './usuarios.port';

/** Cliente real de Usuarios (Go, Pablo). */
export class UsuariosGrpc extends UsuariosPort implements OnModuleDestroy {
  private readonly grpc: ClienteGrpc;

  constructor(url: string, plazoMs = PLAZO_GRPC_MS) {
    super();
    this.grpc = new ClienteGrpc(
      'Usuarios',
      GRPC_PROTO_USUARIOS,
      'tutorias.usuarios.v1.UsuariosService',
      url,
      plazoMs,
    );
  }

  async validarTutorRamo(
    tutorId: string,
    ramoCodigo: string,
  ): Promise<boolean> {
    const res = await this.grpc.llamar<{ valido: boolean }>(
      'ValidarTutorRamo',
      { tutorId, ramoCodigo },
    );
    return res.valido;
  }

  onModuleDestroy(): void {
    this.grpc.cerrar();
  }
}
