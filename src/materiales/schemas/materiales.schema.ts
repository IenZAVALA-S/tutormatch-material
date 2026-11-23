import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export enum TipoMaterial {
  ARCHIVO = 'ARCHIVO',
  AVISO = 'AVISO',
}

export const TIPOS_MIME_PERMITIDOS = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB

@Schema({ _id: false })
export class ArchivoInfo {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  gridfsId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 255 })
  nombre!: string;

  @Prop({ required: true, enum: TIPOS_MIME_PERMITIDOS })
  tipoMime!: string;

  @Prop({ required: true, min: 1, max: TAMANO_MAXIMO_BYTES })
  tamanoBytes!: number;
}

export const ArchivoInfoSchema = SchemaFactory.createForClass(ArchivoInfo);

@Schema({
  collection: 'materiales',
  versionKey: false,
  timestamps: { createdAt: 'creadoEn', updatedAt: false },
})
export class Material {
  @Prop({ type: String, default: () => randomUUID() })
  _id!: string;

  @Prop({ required: true })
  tutorId!: string;

  @Prop({ required: true, trim: true })
  ramoCodigo!: string;

  @Prop({ required: true, enum: Object.values(TipoMaterial) })
  tipo!: TipoMaterial;

  @Prop({ required: true, trim: true, maxlength: 200 })
  titulo!: string;

  // Solo en aviso
  @Prop({ trim: true })
  texto?: string;

  // Solo en archivo
  @Prop({ type: ArchivoInfoSchema })
  archivo?: ArchivoInfo;

  creadoEn!: Date;
}

export type MaterialDocument = HydratedDocument<Material>;
export const MaterialSchema = SchemaFactory.createForClass(Material);
MaterialSchema.index({ tutorId: 1, ramoCodigo: 1, creadoEn: -1 });
