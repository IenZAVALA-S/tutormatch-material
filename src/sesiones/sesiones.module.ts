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
  exports: [SesionesRepository],
})
export class SesionesModule {}
