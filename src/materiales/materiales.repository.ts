import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { TutorRamo } from '../sesiones/sesiones.repository';
import { Material } from './schemas/materiales.schema';

export type NuevoMaterial = Omit<Material, '_id' | 'creadoEn'>;

export interface FiltroMaterial {
  /** Pares tutor-ramo que el usuario puede ver. Su propio material va aparte. */
  visibles: TutorRamo[];
  usuarioId: string;
  /** Filtros opcionales: vacío no filtra. */
  tutorId: string;
  ramoCodigo: string;
}

@Injectable()
export class MaterialesRepository {
  constructor(
    @InjectModel(Material.name)
    private readonly modelo: Model<Material>,
  ) {}

  async crear(datos: NuevoMaterial): Promise<Material> {
    const documento = await this.modelo.create(datos);
    return documento.toObject();
  }

  buscarPorId(id: string): Promise<Material | null> {
    return this.modelo.findById(id).lean<Material>().exec();
  }

  /** Del más nuevo al más antiguo. */
  listar(f: FiltroMaterial): Promise<Material[]> {
    const filtro: QueryFilter<Material> = {
      // Lo propio, más lo de cada tutor-ramo visible.
      $or: [{ tutorId: f.usuarioId }, ...f.visibles],
    };
    if (f.tutorId) filtro.tutorId = f.tutorId;
    if (f.ramoCodigo) filtro.ramoCodigo = f.ramoCodigo;

    return this.modelo
      .find(filtro)
      .sort({ creadoEn: -1 })
      .lean<Material[]>()
      .exec();
  }

  async eliminar(id: string): Promise<void> {
    await this.modelo.deleteOne({ _id: id }).exec();
  }
}
