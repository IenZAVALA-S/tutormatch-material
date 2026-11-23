import { ArgumentoInvalidoError } from '../errores/errores-dominio';

const PATRON_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function exigirUuid(valor: string, campo: string): void {
  if (!PATRON_UUID.test(valor)) {
    throw new ArgumentoInvalidoError(`${campo} debe ser un UUID válido`);
  }
}
