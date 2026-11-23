import { Injectable } from '@nestjs/common';
import {
  ArgumentoInvalidoError,
  PrecondicionFallidaError,
} from '../common/errores/errores-dominio';
import { exigirUuid } from '../common/validacion/validaciones';
import { SesionesPort } from '../clientes/sesiones/sesiones.port';
import { EvaluacionesRepository } from './evaluaciones.repository';
import {
  COMENTARIO_MAXIMO,
  Evaluacion,
  NOTA_MAXIMA,
  NOTA_MINIMA,
} from './schemas/evaluaciones.schema';

export interface EvaluarComando {
  sesionId: string;
  estudianteId: string;
  nota: number;
  comentario: string;
}

export interface EvaluacionesDeTutor {
  evaluaciones: Evaluacion[];
  promedio: number;
  cantidad: number;
}

export interface ResumenDeTutor {
  tutorId: string;
  promedio: number;
  cantidad: number;
}

@Injectable()
export class EvaluacionesService {
  constructor(
    private readonly repositorio: EvaluacionesRepository,
    private readonly sesiones: SesionesPort,
  ) {}

  async evaluar(comando: EvaluarComando): Promise<Evaluacion> {
    exigirUuid(comando.sesionId, 'sesion_id');
    exigirUuid(comando.estudianteId, 'estudiante_id');
    this.validarNota(comando.nota);
    const comentario = this.normalizarComentario(comando.comentario);
    const participacion = await this.sesiones.verificarParticipacion(
      comando.sesionId,
      comando.estudianteId,
    );
    if (!participacion.participo) {
      throw new PrecondicionFallidaError(
        'El estudiante no participó en esta sesión',
      );
    }
    if (!participacion.finalizada) {
      throw new PrecondicionFallidaError('La sesión aún no está finalizada');
    }

    return this.repositorio.crear({
      sesionId: comando.sesionId,
      estudianteId: comando.estudianteId,
      tutorId: participacion.tutorId,
      ramoCodigo: participacion.ramoCodigo,
      nota: comando.nota,
      comentario,
    });
  }

  async listarEvaluaciones(tutorId: string): Promise<EvaluacionesDeTutor> {
    exigirUuid(tutorId, 'tutor_id');
    const evaluaciones = await this.repositorio.listarPorTutor(tutorId);
    const cantidad = evaluaciones.length;
    const suma = evaluaciones.reduce((total, e) => total + e.nota, 0);

    return {
      evaluaciones,
      promedio: cantidad === 0 ? 0 : suma / cantidad,
      cantidad,
    };
  }

  listarMisEvaluaciones(estudianteId: string): Promise<Evaluacion[]> {
    exigirUuid(estudianteId, 'estudiante_id');
    return this.repositorio.listarPorEstudiante(estudianteId);
  }

  async obtenerResumenTutores(tutorIds: string[]): Promise<ResumenDeTutor[]> {
    tutorIds.forEach((id) => exigirUuid(id, 'tutor_ids'));
    if (tutorIds.length === 0) return [];

    const resumenes = await this.repositorio.resumenPorTutores(tutorIds);

    return tutorIds.map((tutorId) => ({
      tutorId,
      ...(resumenes.get(tutorId) ?? { promedio: 0, cantidad: 0 }),
    }));
  }

  private validarNota(nota: number): void {
    if (!Number.isInteger(nota) || nota < NOTA_MINIMA || nota > NOTA_MAXIMA) {
      throw new ArgumentoInvalidoError(
        `La nota debe ser un entero entre ${NOTA_MINIMA} y ${NOTA_MAXIMA}`,
      );
    }
  }

  private normalizarComentario(comentario: string): string {
    const limpio = (comentario ?? '').trim();
    if (limpio.length > COMENTARIO_MAXIMO) {
      throw new ArgumentoInvalidoError(
        `El comentario no puede superar ${COMENTARIO_MAXIMO} caracteres`,
      );
    }
    return limpio;
  }
}
