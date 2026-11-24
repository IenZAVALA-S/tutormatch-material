import { ServiceUnavailableException } from '@nestjs/common';
import { Connection, ConnectionStates } from 'mongoose';
import { SesionesKafkaConsumer } from '../sesiones/sesiones.kafka-consumer';
import { SaludController } from './salud.controller';

describe('SaludController', () => {
  const controlador = (mongo: ConnectionStates, kafkaConectado: boolean) =>
    new SaludController(
      { readyState: mongo } as Connection,
      { conectado: kafkaConectado } as SesionesKafkaConsumer,
    );

  it('vivo siempre responde, aunque Mongo esté caído', () => {
    expect(controlador(ConnectionStates.disconnected, false).vivo()).toEqual({
      estado: 'ok',
    });
  });

  it('listo responde ok con Mongo conectado', () => {
    expect(controlador(ConnectionStates.connected, true).listo()).toEqual({
      estado: 'ok',
      mongo: 'conectado',
      kafka: 'conectado',
    });
  });

  it('sin Kafka sigue listo: gRPC funciona igual', () => {
    expect(
      controlador(ConnectionStates.connected, false).listo(),
    ).toMatchObject({ estado: 'ok', kafka: 'reconectando' });
  });

  it.each([ConnectionStates.disconnected, ConnectionStates.connecting])(
    'sin Mongo (%s) responde 503',
    (estado) => {
      expect(() => controlador(estado, true).listo()).toThrow(
        ServiceUnavailableException,
      );
    },
  );
});
