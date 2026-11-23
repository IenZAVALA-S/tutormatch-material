import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SesionesFake } from './sesiones/sesiones.fake';
import { SesionesGrpc } from './sesiones/sesiones.grpc';
import { SesionesPort } from './sesiones/sesiones.port';
import { UsuariosFake } from './usuarios/usuarios.fake';
import { UsuariosGrpc } from './usuarios/usuarios.grpc';
import { UsuariosPort } from './usuarios/usuarios.port';

/**
 * Con CLIENTES_FALSOS=true usa las versiones falsas (datos de datos-demo.ts),
 * para desarrollar sin Usuarios ni Sesiones. Si no, exige las URL: sin ellas la
 * app no arranca, así nunca corre con datos falsos por olvido.
 */
const usarFalsos = (config: ConfigService) =>
  config.get<string>('CLIENTES_FALSOS') === 'true';

@Module({
  providers: [
    {
      provide: UsuariosPort,
      inject: [ConfigService],
      useFactory: (config: ConfigService): UsuariosPort => {
        if (usarFalsos(config)) {
          new Logger('ClientesModule').warn(
            'CLIENTES_FALSOS=true: Usuarios y Sesiones son versiones falsas',
          );
          return new UsuariosFake();
        }
        return new UsuariosGrpc(config.getOrThrow('USUARIOS_GRPC_URL'));
      },
    },
    {
      provide: SesionesPort,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SesionesPort =>
        usarFalsos(config)
          ? new SesionesFake()
          : new SesionesGrpc(config.getOrThrow('SESIONES_GRPC_URL')),
    },
  ],
  exports: [UsuariosPort, SesionesPort],
})
export class ClientesModule {}
