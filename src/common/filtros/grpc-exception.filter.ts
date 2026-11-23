import { status } from '@grpc/grpc-js';
import { Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import {
  ArgumentoInvalidoError,
  ErrorDominio,
  NoEncontradoError,
  PermisoDenegadoError,
  PrecondicionFallidaError,
  ServicioNoDisponibleError,
  YaExisteError,
} from '../errores/errores-dominio';

interface ErrorGrpc {
  code: status;
  message: string;
}

@Catch()
export class GrpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GrpcExceptionFilter.name);

  catch(exception: unknown): Observable<never> {
    return throwError(() => this.aErrorGrpc(exception));
  }

  private aErrorGrpc(exception: unknown): ErrorGrpc {
    if (exception instanceof ErrorDominio) {
      return {
        code: this.codigoPara(exception),
        message: exception.message,
      };
    }

    if (exception instanceof RpcException) {
      return exception.getError() as ErrorGrpc;
    }

    this.logger.error('Error inesperado', exception as Error);
    return { code: status.INTERNAL, message: 'Error interno del servidor' };
  }

  private codigoPara(error: ErrorDominio): status {
    if (error instanceof NoEncontradoError) return status.NOT_FOUND;
    if (error instanceof YaExisteError) return status.ALREADY_EXISTS;
    if (error instanceof PermisoDenegadoError) return status.PERMISSION_DENIED;
    if (error instanceof PrecondicionFallidaError)
      return status.FAILED_PRECONDITION;
    if (error instanceof ArgumentoInvalidoError) return status.INVALID_ARGUMENT;
    if (error instanceof ServicioNoDisponibleError) return status.UNAVAILABLE;
    return status.UNKNOWN;
  }
}
