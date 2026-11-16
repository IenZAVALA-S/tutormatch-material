import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Evaluacion, EvaluacionSchema } from './schemas/evaluaciones.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Evaluacion.name, schema: EvaluacionSchema },
    ]),
  ],
})
export class EvaluacionesModule {}