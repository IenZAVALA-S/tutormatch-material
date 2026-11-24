import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventosSesionService } from './eventos-sesion.service';
import { Sesion, SesionSchema } from './schemas/sesiones.schema';
import { SesionesKafkaConsumer } from './sesiones.kafka-consumer';
import { SesionesRepository } from './sesiones.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Sesion.name, schema: SesionSchema }]),
  ],
  providers: [SesionesRepository, EventosSesionService, SesionesKafkaConsumer],
  // El consumidor se exporta solo para que /health/listo informe su estado.
  exports: [SesionesRepository, SesionesKafkaConsumer],
})
export class SesionesModule {}
