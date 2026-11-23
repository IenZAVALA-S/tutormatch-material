import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EstadoSesion, Sesion } from './schemas/sesiones.schema';

/** Un tutor en un ramo: la unidad con la que se decide quién ve qué material. */
export interface TutorRamo {
  tutorId: string;
  ramoCodigo: string;
}

/** Lo que Material guarda de cada evento de sesión. */
export interface DatosSesion extends TutorRamo {
  sesionId: string;
  estudianteId: string;
}

/**
 * Copia local de las sesiones: la escribe el consumidor de Kafka y la lee la
 * regla de visibilidad del material.
 *
 * Regla de visibilidad: un alumno ve el material de un tutor en un ramo si tiene
 * o tuvo al menos una sesión con él en ese ramo que no esté CANCELADA.
 */
@Injectable()
export class SesionesRepository {
  constructor(
    @InjectModel(Sesion.name)
    private readonly modelo: Model<Sesion>,
  ) {}

  // Los dos upserts dan el mismo resultado si un evento llega repetido, así que no
  // hace falta guardar los eventId ya procesados.

  /** sesion.creada: solo crea. Si ya existe (evento repetido), no la toca. */
  async registrarCreada(s: DatosSesion): Promise<void> {
    await this.modelo
      .updateOne(
        { _id: s.sesionId },
        {
          $setOnInsert: {
            tutorId: s.tutorId,
            estudianteId: s.estudianteId,
            ramoCodigo: s.ramoCodigo,
            estado: EstadoSesion.CREADA,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  /**
   * sesion.finalizada y sesion.cancelada: fijan el estado. También crean la
   * sesión, por si el evento sesion.creada se perdió.
   */
  async fijarEstado(s: DatosSesion, estado: EstadoSesion): Promise<void> {
    await this.modelo
      .updateOne(
        { _id: s.sesionId },
        {
          $set: {
            tutorId: s.tutorId,
            estudianteId: s.estudianteId,
            ramoCodigo: s.ramoCodigo,
            estado,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  /** ¿Tiene el alumno alguna sesión no cancelada con ese tutor en ese ramo? */
  async tieneSesionVigente(
    estudianteId: string,
    { tutorId, ramoCodigo }: TutorRamo,
  ): Promise<boolean> {
    const sesion = await this.modelo
      .exists({
        estudianteId,
        tutorId,
        ramoCodigo,
        estado: { $ne: EstadoSesion.CANCELADA },
      })
      .exec();
    return sesion !== null;
  }

  /** Todos los pares tutor-ramo cuyo material puede ver el alumno. */
  async tutoresRamosVisibles(estudianteId: string): Promise<TutorRamo[]> {
    const filas = await this.modelo
      .aggregate<{ _id: TutorRamo }>([
        {
          $match: { estudianteId, estado: { $ne: EstadoSesion.CANCELADA } },
        },
        {
          $group: {
            _id: { tutorId: '$tutorId', ramoCodigo: '$ramoCodigo' },
          },
        },
      ])
      .exec();
    return filas.map((f) => f._id);
  }
}
