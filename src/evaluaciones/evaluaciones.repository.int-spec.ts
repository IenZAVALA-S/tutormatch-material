import { Connection } from 'mongoose';
import { YaExisteError } from '../common/errores/errores-dominio';
import {
  cerrar,
  conectarMongoDePrueba,
  modeloDePrueba,
  PLAZO_PREPARACION_MS,
  vaciar,
} from '../common/testing/mongo-pruebas';
import {
  EvaluacionesRepository,
  NuevaEvaluacion,
} from './evaluaciones.repository';
import { Evaluacion, EvaluacionSchema } from './schemas/evaluaciones.schema';

describe('EvaluacionesRepository (Mongo real)', () => {
  let conexion: Connection;
  let repo: EvaluacionesRepository;

  const evaluacion = (
    sesionId: string,
    tutorId: string,
    nota: number,
    estudianteId = 'alumno-1',
  ): NuevaEvaluacion => ({
    sesionId,
    tutorId,
    estudianteId,
    ramoCodigo: 'MAT1610',
    nota,
    comentario: '',
  });

  beforeAll(async () => {
    conexion = await conectarMongoDePrueba();
    // Construye los índices, entre ellos el único de sesionId.
    const modelo = await modeloDePrueba<Evaluacion>(
      conexion,
      Evaluacion.name,
      EvaluacionSchema,
    );
    repo = new EvaluacionesRepository(modelo);
  }, PLAZO_PREPARACION_MS);
  afterEach(() => vaciar(conexion));
  afterAll(() => cerrar(conexion));

  it('el índice único impide una segunda evaluación de la misma sesión', async () => {
    await repo.crear(evaluacion('sesion-1', 'tutor-1', 5));
    await expect(
      repo.crear(evaluacion('sesion-1', 'tutor-1', 3)),
    ).rejects.toThrow(YaExisteError);
  });

  it('listarPorTutor y listarPorEstudiante, de la más nueva a la más antigua', async () => {
    await repo.crear(evaluacion('sesion-1', 'tutor-1', 5));
    await new Promise((r) => setTimeout(r, 5));
    await repo.crear(evaluacion('sesion-2', 'tutor-1', 3, 'alumno-2'));
    await repo.crear(evaluacion('sesion-3', 'tutor-2', 4));

    expect(
      (await repo.listarPorTutor('tutor-1')).map((e) => e.sesionId),
    ).toEqual(['sesion-2', 'sesion-1']);
    expect(
      (await repo.listarPorEstudiante('alumno-1')).map((e) => e.sesionId),
    ).toEqual(expect.arrayContaining(['sesion-1', 'sesion-3']));
  });

  it('resumenPorTutores calcula promedio y cantidad, y omite a los sin evaluaciones', async () => {
    await repo.crear(evaluacion('sesion-1', 'tutor-1', 5));
    await repo.crear(evaluacion('sesion-2', 'tutor-1', 4));
    await repo.crear(evaluacion('sesion-3', 'tutor-2', 2));

    const resumen = await repo.resumenPorTutores([
      'tutor-1',
      'tutor-2',
      'sin-evaluaciones',
    ]);

    expect(Object.fromEntries(resumen)).toEqual({
      'tutor-1': { promedio: 4.5, cantidad: 2 },
      'tutor-2': { promedio: 2, cantidad: 1 },
    });
  });

  it('el schema rechaza una nota fuera de 1..5 aunque se salte el service', async () => {
    await expect(
      repo.crear(evaluacion('sesion-1', 'tutor-1', 7)),
    ).rejects.toThrow();
  });
});
