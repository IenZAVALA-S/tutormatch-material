import { INestApplication } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  GRPC_OPCIONES_LOADER,
  GRPC_PACKAGE_MATERIAL,
  GRPC_PROTO_MATERIAL,
  GRPC_TAMANO_MAXIMO_MENSAJE,
} from './grpc.constantes';

/**
 * Agrega el servidor gRPC de Material a la app. Lo usan main.ts y el test de
 * punta a punta, para que el test pruebe exactamente la misma configuración.
 */
export function conectarGrpc(app: INestApplication, url: string): void {
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: GRPC_PACKAGE_MATERIAL,
      protoPath: GRPC_PROTO_MATERIAL,
      url,
      loader: GRPC_OPCIONES_LOADER,
      // Archivos de hasta 10 MB: gRPC corta en 4 MB por defecto.
      maxReceiveMessageLength: GRPC_TAMANO_MAXIMO_MENSAJE,
      maxSendMessageLength: GRPC_TAMANO_MAXIMO_MENSAJE,
    },
  });
}
