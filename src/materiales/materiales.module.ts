import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SesionesModule } from '../sesiones/sesiones.module';
import { Material, MaterialSchema } from './schemas/materiales.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Material.name, schema: MaterialSchema },
    ]),
    SesionesModule,
  ],
})
export class MaterialesModule {}