import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { conectarGrpc } from './common/grpc/conectar-grpc';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Al recibir SIGTERM (Kubernetes apagando el pod), cierra ordenado: sale del
  // grupo de Kafka y cierra Mongo y los clientes gRPC.
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const grpcUrl = config.get<string>('GRPC_URL', '0.0.0.0:9090');
  conectarGrpc(app, grpcUrl);
  await app.startAllMicroservices();

  const puertoHttp = config.get<number>('PORT', 3002);
  await app.listen(puertoHttp);

  logger.log(`gRPC escuchando en ${grpcUrl}`);
  logger.log(`HTTP escuchando en el puerto ${puertoHttp}`);
}
void bootstrap();
