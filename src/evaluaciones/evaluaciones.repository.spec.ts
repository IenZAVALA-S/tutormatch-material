import { Model } from 'mongoose';
import { YaExisteError } from '../common/errores/errores-dominio';
import {
  EvaluacionesRepository,
  NuevaEvaluacion,
} from './evaluaciones.repository';
import { Evaluacion } from './schemas/evaluaciones.schema';

describe('EvaluacionesRepository', () => {
  const datos: NuevaEvaluacion = {
    sesionId: 'a',
    tutorId: 'b',
    estudianteId: 'c',
    ramoCodigo: 'MAT1610',
    nota: 5,
    comentario: '',
  };

  function repositorioCon(create: jest.Mock): EvaluacionesRepository {
    const modelo = { create } as unknown as Model<Evaluacion>;
    return new EvaluacionesRepository(modelo);
  }

  it('traduce el error de clave duplicada de Mongo a YaExisteError', async () => {
    const repo = repositorioCon(jest.fn().mockRejectedValue({ code: 11000 }));
    await expect(repo.crear(datos)).rejects.toThrow(YaExisteError);
  });

  it('deja pasar cualquier otro error', async () => {
    const repo = repositorioCon(
      jest.fn().mockRejectedValue(new Error('Mongo no responde')),
    );
    await expect(repo.crear(datos)).rejects.toThrow('Mongo no responde');
  });
});
