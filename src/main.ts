import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import {
  GRPC_OPCIONES_LOADER,
  GRPC_PACKAGE_MATERIAL,
  GRPC_PROTO_MATERIAL,
  GRPC_TAMANO_MAXIMO_MENSAJE,
} from './common/grpc/grpc.constantes';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const grpcUrl = config.get<string>('GRPC_URL', '0.0.0.0:9090');

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: GRPC_PACKAGE_MATERIAL,
      protoPath: GRPC_PROTO_MATERIAL,
      url: grpcUrl,
      loader: GRPC_OPCIONES_LOADER,
      maxReceiveMessageLength: GRPC_TAMANO_MAXIMO_MENSAJE,
      maxSendMessageLength: GRPC_TAMANO_MAXIMO_MENSAJE,
    },
  });

  await app.startAllMicroservices();

  const puertoHttp = config.get<number>('PORT', 3002);
  await app.listen(puertoHttp);

  logger.log(`gRPC escuchando en ${grpcUrl}`);
  logger.log(`HTTP escuchando en el puerto ${puertoHttp}`);
}
void bootstrap();