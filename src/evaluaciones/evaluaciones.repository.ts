import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { YaExisteError } from '../common/errores/errores-dominio';
import { Evaluacion } from './schemas/evaluaciones.schema';

export type NuevaEvaluacion = Omit<Evaluacion, '_id' | 'creadaEn'>;

export interface ResumenEvaluaciones {
  promedio: number;
  cantidad: number;
}

@Injectable()
export class EvaluacionesRepository {
  constructor(
    @InjectModel(Evaluacion.name)
    private readonly modelo: Model<Evaluacion>,
  ) {}

  async crear(datos: NuevaEvaluacion): Promise<Evaluacion> {
    try {
      const documento = await this.modelo.create(datos);
      return documento.toObject();
    } catch (error) {
      if (esClaveDuplicada(error)) {
        throw new YaExisteError('Esta sesión ya fue evaluada');
      }
      throw error;
    }
  }

  listarPorTutor(tutorId: string): Promise<Evaluacion[]> {
    return this.modelo
      .find({ tutorId })
      .sort({ creadaEn: -1 })
      .lean<Evaluacion[]>()
      .exec();
  }

  listarPorEstudiante(estudianteId: string): Promise<Evaluacion[]> {
    return this.modelo
      .find({ estudianteId })
      .sort({ creadaEn: -1 })
      .lean<Evaluacion[]>()
      .exec();
  }
  async resumenPorTutores(
    tutorIds: string[],
  ): Promise<Map<string, ResumenEvaluaciones>> {
    const filas = await this.modelo
      .aggregate<{ _id: string; promedio: number; cantidad: number }>([
        { $match: { tutorId: { $in: tutorIds } } },
        {
          $group: {
            _id: '$tutorId',
            promedio: { $avg: '$nota' },
            cantidad: { $sum: 1 },
          },
        },
      ])
      .exec();

    return new Map(
      filas.map((f) => [f._id, { promedio: f.promedio, cantidad: f.cantidad }]),
    );
  }
}
function esClaveDuplicada(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
