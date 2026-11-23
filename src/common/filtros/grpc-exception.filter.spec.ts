import { status } from '@grpc/grpc-js';
import { Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  ArgumentoInvalidoError,
  NoEncontradoError,
  PermisoDenegadoError,
  PrecondicionFallidaError,
  ServicioNoDisponibleError,
  YaExisteError,
} from '../errores/errores-dominio';
import { GrpcExceptionFilter } from './grpc-exception.filter';

describe('GrpcExceptionFilter', () => {
  const filtro = new GrpcExceptionFilter();

  /** El filtro devuelve un Observable que falla: esto obtiene ese error. */
  const errorGrpcDe = (excepcion: unknown) =>
    firstValueFrom(filtro.catch(excepcion));

  afterEach(() => jest.restoreAllMocks());

  it.each([
    [new NoEncontradoError('x'), 'NOT_FOUND'],
    [new YaExisteError('x'), 'ALREADY_EXISTS'],
    [new PermisoDenegadoError('x'), 'PERMISSION_DENIED'],
    [new PrecondicionFallidaError('x'), 'FAILED_PRECONDITION'],
    [new ArgumentoInvalidoError('x'), 'INVALID_ARGUMENT'],
    [new ServicioNoDisponibleError('x'), 'UNAVAILABLE'],
  ] as const)('traduce %s a %s', async (error, nombre) => {
    await expect(errorGrpcDe(error)).rejects.toEqual({
      code: status[nombre],
      message: 'x',
    });
  });

  it('respeta un RpcException lanzado a propósito', async () => {
    const original = { code: status.ABORTED, message: 'abortado' };
    await expect(errorGrpcDe(new RpcException(original))).rejects.toEqual(
      original,
    );
  });

  it.each([
    ['un Error', new Error('cadena de conexión secreta')],
    ['un texto', 'cadena de conexión secreta'],
    ['undefined', undefined],
  ])(
    'oculta los detalles de %s inesperado, pero lo registra en el log',
    async (_descripcion, excepcion) => {
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      await expect(errorGrpcDe(excepcion)).rejects.toEqual({
        code: status.INTERNAL,
        message: 'Error interno del servidor',
      });
      expect(logError).toHaveBeenCalled();
    },
  );
});
