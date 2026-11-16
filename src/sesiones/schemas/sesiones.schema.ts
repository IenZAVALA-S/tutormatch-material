import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum EstadoSesion {
  CREADA = 'CREADA',
  FINALIZADA = 'FINALIZADA',
  CANCELADA = 'CANCELADA',
}

// Copia local de las sesiones, armada desde los eventos Kafka.
// La fuente de verdad es el servicio de Sesiones; esto solo sirve
// para decidir quién puede ver qué material.
@Schema({ collection: 'sesiones', versionKey: false })
export class Sesion {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ required: true })
  tutorId!: string;

  @Prop({ required: true })
  estudianteId!: string;

  @Prop({ required: true })
  ramoCodigo!: string;

  @Prop({ required: true, enum: Object.values(EstadoSesion) })
  estado!: EstadoSesion;
}

export type SesionDocument = HydratedDocument<Sesion>;
export const SesionSchema = SchemaFactory.createForClass(Sesion);
SesionSchema.index({ estudianteId: 1, tutorId: 1, ramoCodigo: 1 });