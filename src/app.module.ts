import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';
import { MaterialesModule } from './materiales/materiales.module';
import { SaludModule } from './salud/salud.module';
import { SesionesModule } from './sesiones/sesiones.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
      }),
    }),
    MaterialesModule,
    EvaluacionesModule,
    SesionesModule,
    SaludModule,
  ],
})
export class AppModule {}
