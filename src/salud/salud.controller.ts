import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { SesionesKafkaConsumer } from '../sesiones/sesiones.kafka-consumer';

export interface EstadoSalud {
  estado: 'ok';
  mongo: 'conectado';
  /** Solo informativo: sin Kafka, gRPC funciona igual. */
  kafka: 'conectado' | 'reconectando';
}

/**
 * Sondas de Kubernetes, por HTTP (puerto PORT).
 *
 * - /health/vivo (livenessProbe): el proceso responde. Si falla, Kubernetes
 *   reinicia el pod. No mira Mongo: reiniciar no arregla un Mongo caído.
 * - /health/listo (readinessProbe): puede atender. Sin Mongo responde 503 y
 *   Kubernetes deja de mandarle tráfico hasta que vuelva.
 */
@Controller('health')
export class SaludController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    private readonly kafka: SesionesKafkaConsumer,
  ) {}

  @Get('vivo')
  vivo(): { estado: 'ok' } {
    return { estado: 'ok' };
  }

  @Get('listo')
  listo(): EstadoSalud {
    if (this.mongo.readyState !== ConnectionStates.connected) {
      throw new ServiceUnavailableException({
        estado: 'no listo',
        mongo: ConnectionStates[this.mongo.readyState],
      });
    }
    return {
      estado: 'ok',
      mongo: 'conectado',
      kafka: this.kafka.conectado ? 'conectado' : 'reconectando',
    };
  }
}
