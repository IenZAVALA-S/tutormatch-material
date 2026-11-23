import { Logger } from '@nestjs/common';
import { EstadoSesion } from './schemas/sesiones.schema';
import { EventosSesionService } from './eventos-sesion.service';
import { DatosSesion, SesionesRepository } from './sesiones.repository';

describe('EventosSesionService', () => {
  const payload: DatosSesion = {
    sesionId: '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90',
    tutorId: 'a1b2c3d4-0000-4000-8000-000000000001',
    estudianteId: 'a1b2c3d4-0000-4000-8000-000000000002',
    ramoCodigo: 'MAT1610',
  };

  /** Igual que contracts/eventos/sesion.*.json. */
  const mensaje = (type: string, p: object = payload) =>
    Buffer.from(
      JSON.stringify({
        eventId: '6f1c2a9e-0b7d-4c3e-9a51-2d8f4b7e1c03',
        type,
        occurredAt: '2026-11-12T22:00:00Z',
        payload: {
          ...p,
          inicio: '2026-11-19T18:00:00Z',
          fin: '2026-11-19T19:00:00Z',
        },
      }),
    );

  let repositorio: {
    registrarCreada: jest.Mock;
    fijarEstado: jest.Mock;
  };
  let servicio: EventosSesionService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    repositorio = {
      registrarCreada: jest.fn().mockResolvedValue(undefined),
      fijarEstado: jest.fn().mockResolvedValue(undefined),
    };
    servicio = new EventosSesionService(
      repositorio as unknown as SesionesRepository,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('sesion.creada registra la sesión, solo con los campos que usa Material', async () => {
    await servicio.aplicar('sesion.creada', mensaje('sesion.creada'));
    expect(repositorio.registrarCreada).toHaveBeenCalledWith(payload);
  });

  it.each([
    ['sesion.finalizada', EstadoSesion.FINALIZADA],
    ['sesion.cancelada', EstadoSesion.CANCELADA],
  ])('%s fija el estado %s', async (topico, estado) => {
    await servicio.aplicar(topico, mensaje(topico));
    expect(repositorio.fijarEstado).toHaveBeenCalledWith(payload, estado);
  });

  it.each([
    ['un valor vacío', null],
    ['algo que no es JSON', Buffer.from('hola')],
    ['un JSON sin payload', Buffer.from('{"type":"sesion.creada"}')],
    ['un JSON null', Buffer.from('null')],
    [
      'un payload sin estudianteId',
      mensaje('sesion.creada', { ...payload, estudianteId: undefined }),
    ],
    [
      'un sesionId que no es texto',
      mensaje('sesion.creada', { ...payload, sesionId: 42 }),
    ],
  ])('ignora %s sin lanzar error', async (_caso, valor) => {
    await expect(
      servicio.aplicar('sesion.creada', valor),
    ).resolves.toBeUndefined();
    expect(repositorio.registrarCreada).not.toHaveBeenCalled();
  });

  it('ignora un tópico desconocido', async () => {
    await servicio.aplicar('sesion.confirmada', mensaje('sesion.confirmada'));
    expect(repositorio.registrarCreada).not.toHaveBeenCalled();
    expect(repositorio.fijarEstado).not.toHaveBeenCalled();
  });

  it('si falla Mongo, lanza el error para que Kafka reintente el mensaje', async () => {
    repositorio.registrarCreada.mockRejectedValue(
      new Error('Mongo no responde'),
    );
    await expect(
      servicio.aplicar('sesion.creada', mensaje('sesion.creada')),
    ).rejects.toThrow('Mongo no responde');
  });
});
