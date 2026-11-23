import { Module } from '@nestjs/common';
import { SesionesFake } from './sesiones/sesiones.fake';
import { SesionesPort } from './sesiones/sesiones.port';
import { UsuariosFake } from './usuarios/usuarios.fake';
import { UsuariosPort } from './usuarios/usuarios.port';

@Module({
  providers: [
    { provide: UsuariosPort, useClass: UsuariosFake },
    { provide: SesionesPort, useClass: SesionesFake },
  ],
  exports: [UsuariosPort, SesionesPort],
})
export class ClientesModule {}
