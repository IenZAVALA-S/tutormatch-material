import { ArgumentoInvalidoError } from '../errores/errores-dominio';

const PATRON_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: string): boolean {
  return PATRON_UUID.test(valor);
}

export function exigirUuid(valor: string, campo: string): void {
  if (!esUuid(valor)) {
    throw new ArgumentoInvalidoError(`${campo} debe ser un UUID válido`);
  }
}
