export abstract class ErrorDominio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class NoEncontradoError extends ErrorDominio {}

export class YaExisteError extends ErrorDominio {}

export class PermisoDenegadoError extends ErrorDominio {}

export class PrecondicionFallidaError extends ErrorDominio {}

export class ArgumentoInvalidoError extends ErrorDominio {}

export class ServicioNoDisponibleError extends ErrorDominio {}