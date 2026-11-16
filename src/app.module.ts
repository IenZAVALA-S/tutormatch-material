import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';
import { MaterialesModule } from './materiales/materiales.module';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}