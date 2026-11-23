import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientesModule } from '../clientes/clientes.module';
import { EvaluacionesGrpcController } from './evaluaciones.grpc-controller';
import { EvaluacionesRepository } from './evaluaciones.repository';
import { EvaluacionesService } from './evaluaciones.service';
import { Evaluacion, EvaluacionSchema } from './schemas/evaluaciones.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Evaluacion.name, schema: EvaluacionSchema },
    ]),
    ClientesModule,
  ],
  controllers: [EvaluacionesGrpcController],
  providers: [EvaluacionesService, EvaluacionesRepository],
})
export class EvaluacionesModule {}
