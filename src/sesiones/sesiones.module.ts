import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sesion, SesionSchema } from './schemas/sesiones.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Sesion.name, schema: SesionSchema }]),
  ],
  exports: [MongooseModule],
})
export class SesionesModule {}