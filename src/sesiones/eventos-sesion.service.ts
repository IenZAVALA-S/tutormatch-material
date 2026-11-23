import { Injectable, Logger } from '@nestjs/common';
import { EstadoSesion } from './schemas/sesiones.schema';
import { DatosSesion, SesionesRepository } from './sesiones.repository';

/** Tópicos que publica Sesiones (formato en contracts/eventos/). */
export const TOPICOS_SESION = [
  'sesion.creada',
  'sesion.finalizada',
  'sesion.cancelada',
] as const;

/**
 * Aplica un mensaje de Kafka a la copia local de las sesiones.
 *
 * - Mensaje mal formado: se registra en el log y se salta. Reintentarlo no lo
 *   arreglaría y trabaría los mensajes que vienen detrás.
 * - Error al guardar (Mongo caído): se lanza, para que Kafka no lo dé por
 *   leído y lo vuelva a entregar.
 */
@Injectable()
export class EventosSesionService {
  private readonly logger = new Logger(EventosSesionService.name);

  constructor(private readonly sesiones: SesionesRepository) {}

  async aplicar(topico: string, valor: Buffer | null): Promise<void> {
    const datos = leerPayload(valor);
    if (!datos) {
      this.logger.warn(`Mensaje mal formado en ${topico}, se ignora`);
      return;
    }

    switch (topico) {
      case 'sesion.creada':
        return this.sesiones.registrarCreada(datos);
      case 'sesion.finalizada':
        return this.sesiones.fijarEstado(datos, EstadoSesion.FINALIZADA);
      case 'sesion.cancelada':
        return this.sesiones.fijarEstado(datos, EstadoSesion.CANCELADA);
      default:
        this.logger.warn(`Tópico desconocido ${topico}, se ignora`);
    }
  }
}

/** Saca del sobre los cuatro campos que usa Material; null si falta alguno. */
function leerPayload(valor: Buffer | null): DatosSesion | null {
  let evento: unknown;
  try {
    evento = JSON.parse(valor?.toString() ?? '');
  } catch {
    return null;
  }

  const p = (evento as { payload?: Record<string, unknown> } | null)?.payload;
  const campos = ['sesionId', 'tutorId', 'estudianteId', 'ramoCodigo'];
  if (!p || !campos.every((c) => typeof p[c] === 'string' && p[c] !== '')) {
    return null;
  }
  return {
    sesionId: p.sesionId as string,
    tutorId: p.tutorId as string,
    estudianteId: p.estudianteId as string,
    ramoCodigo: p.ramoCodigo as string,
  };
}
