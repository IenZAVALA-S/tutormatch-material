import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientesModule } from '../clientes/clientes.module';
import { SesionesModule } from '../sesiones/sesiones.module';
import { ArchivosStorage } from './archivos.storage';
import { MaterialesGrpcController } from './materiales.grpc-controller';
import { MaterialesRepository } from './materiales.repository';
import { MaterialesService } from './materiales.service';
import { Material, MaterialSchema } from './schemas/materiales.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Material.name, schema: MaterialSchema },
    ]),
    SesionesModule,
    ClientesModule,
  ],
  controllers: [MaterialesGrpcController],
  providers: [MaterialesService, MaterialesRepository, ArchivosStorage],
})
export class MaterialesModule {}
