import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { HydratedDocument } from 'mongoose';

export const NOTA_MINIMA = 1;
export const NOTA_MAXIMA = 5;
export const COMENTARIO_MAXIMO = 1000;

@Schema({
  collection: 'evaluaciones',
  versionKey: false,
  timestamps: { createdAt: 'creadaEn', updatedAt: false },
})
export class Evaluacion {
  @Prop({ type: String, default: () => randomUUID() })
  _id!: string;

  @Prop({ required: true })
  sesionId!: string;

  @Prop({ required: true })
  tutorId!: string;

  @Prop({ required: true })
  estudianteId!: string;

  @Prop({ required: true })
  ramoCodigo!: string;

  @Prop({
    required: true,
    min: NOTA_MINIMA,
    max: NOTA_MAXIMA,
    validate: {
      validator: Number.isInteger,
      message: 'La nota debe ser un número entero',
    },
  })
  nota!: number;

  @Prop({ default: '', trim: true, maxlength: COMENTARIO_MAXIMO })
  comentario!: string;

  creadaEn!: Date;
}

export type EvaluacionDocument = HydratedDocument<Evaluacion>;
export const EvaluacionSchema = SchemaFactory.createForClass(Evaluacion);
EvaluacionSchema.index({ sesionId: 1 }, { unique: true });
EvaluacionSchema.index({ tutorId: 1, creadaEn: -1 });
EvaluacionSchema.index({ estudianteId: 1 });
