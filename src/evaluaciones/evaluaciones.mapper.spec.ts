import { aEvaluacionAnonima, aEvaluacionPropia } from './evaluaciones.mapper';
import { Evaluacion } from './schemas/evaluaciones.schema';

describe('evaluaciones.mapper', () => {
  const evaluacion: Evaluacion = {
    _id: 'id-1',
    sesionId: 'sesion-1',
    tutorId: 'tutor-1',
    estudianteId: 'alumno-1',
    ramoCodigo: 'MAT1610',
    nota: 4,
    comentario: 'Bien',
    creadaEn: new Date('2026-11-21T20:00:00.500Z'),
  };

  it('la vista anónima nunca revela quién la escribió ni de qué sesión es', () => {
    const anonima = aEvaluacionAnonima(evaluacion);

    expect(anonima).not.toHaveProperty('estudianteId');
    expect(anonima).not.toHaveProperty('sesionId');
    expect(anonima).not.toHaveProperty('tutorId');
  });

  it('convierte la fecha a google.protobuf.Timestamp', () => {
    expect(aEvaluacionAnonima(evaluacion).creadaEn).toEqual({
      seconds: 1795291200,
      nanos: 500_000_000,
    });
  });

  it('la vista propia incluye la sesión', () => {
    expect(aEvaluacionPropia(evaluacion).sesionId).toBe('sesion-1');
  });
});
