import { Injectable } from '@nestjs/common';
import { NoEncontradoError } from '../../common/errores/errores-dominio';
import { DEMO } from '../datos-demo';
import { Participacion, SesionesPort } from './sesiones.port';

export interface SesionFake {
  id: string;
  tutorId: string;
  estudianteId: string;
  ramoCodigo: string;
  finalizada: boolean;
}

@Injectable()
export class SesionesFake extends SesionesPort {
  private readonly sesiones = new Map<string, SesionFake>();

  constructor() {
    super();
    const base = {
      tutorId: DEMO.tutorId,
      estudianteId: DEMO.estudianteId,
      ramoCodigo: DEMO.ramoCodigo,
    };
    this.registrar({ ...base, id: DEMO.sesionFinalizadaId, finalizada: true });
    this.registrar({ ...base, id: DEMO.sesionPendienteId, finalizada: false });
  }

  registrar(sesion: SesionFake): void {
    this.sesiones.set(sesion.id, sesion);
  }

  verificarParticipacion(
    sesionId: string,
    estudianteId: string,
  ): Promise<Participacion> {
    const sesion = this.sesiones.get(sesionId);
    if (!sesion) {
      return Promise.reject(
        new NoEncontradoError(`Sesión ${sesionId} no encontrada`),
      );
    }

    return Promise.resolve({
      finalizada: sesion.finalizada,
      participo: sesion.estudianteId === estudianteId,
      tutorId: sesion.tutorId,
      ramoCodigo: sesion.ramoCodigo,
    });
  }
}
