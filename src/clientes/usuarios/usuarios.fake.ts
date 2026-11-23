import { Injectable } from '@nestjs/common';
import { DEMO } from '../datos-demo';
import { UsuariosPort } from './usuarios.port';

@Injectable()
export class UsuariosFake extends UsuariosPort {
  private readonly ramosActivos = new Set<string>();

  constructor() {
    super();
    this.agregarRamo(DEMO.tutorId, DEMO.ramoCodigo);
  }

  agregarRamo(tutorId: string, ramoCodigo: string): void {
    this.ramosActivos.add(this.clave(tutorId, ramoCodigo));
  }

  quitarRamo(tutorId: string, ramoCodigo: string): void {
    this.ramosActivos.delete(this.clave(tutorId, ramoCodigo));
  }

  validarTutorRamo(tutorId: string, ramoCodigo: string): Promise<boolean> {
    return Promise.resolve(
      this.ramosActivos.has(this.clave(tutorId, ramoCodigo)),
    );
  }

  private clave(tutorId: string, ramoCodigo: string): string {
    return `${tutorId}:${ramoCodigo}`;
  }
}
