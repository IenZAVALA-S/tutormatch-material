import { Module } from '@nestjs/common';
import { SesionesModule } from '../sesiones/sesiones.module';
import { SaludController } from './salud.controller';

@Module({
  imports: [SesionesModule],
  controllers: [SaludController],
})
export class SaludModule {}
