import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka, logLevel } from 'kafkajs';
import { EventosSesionService, TOPICOS_SESION } from './eventos-sesion.service';

const REINTENTO_MS = 5_000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Consumidor de los eventos de Sesiones (grupo "material").
 *
 * No usa el transporte Kafka de Nest a propósito: ese se conecta dentro de
 * startAllMicroservices(), y si Kafka no está o falta un tópico, tampoco arranca
 * gRPC. Aquí se conecta en segundo plano y reintenta cada 5 s hasta lograrlo;
 * mientras tanto gRPC atiende normal (en Kubernetes el orden de arranque no
 * está garantizado).
 */
@Injectable()
export class SesionesKafkaConsumer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SesionesKafkaConsumer.name);
  private consumidor?: Consumer;
  private detenido = false;
  private conectando = false;

  constructor(
    private readonly eventos: EventosSesionService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    // Sin await: el arranque de la app no espera a Kafka.
    void this.conectarConReintentos();
  }

  async onApplicationShutdown(): Promise<void> {
    this.detenido = true;
    await this.consumidor?.disconnect();
  }

  private async conectarConReintentos(): Promise<void> {
    // Una sola vuelta a la vez: un error en run() puede avisar por dos lados.
    if (this.conectando) return;
    this.conectando = true;
    try {
      while (!this.detenido) {
        try {
          await this.conectar();
          this.logger.log(`Escuchando ${TOPICOS_SESION.join(', ')}`);
          return;
        } catch (error) {
          this.logger.warn(
            `Kafka todavía no está listo (${(error as Error).message}); ` +
              `reintento en ${REINTENTO_MS / 1000} s`,
          );
          await this.consumidor?.disconnect().catch(() => undefined);
          await esperar(REINTENTO_MS);
        }
      }
    } finally {
      this.conectando = false;
    }
  }

  /** kafkajs se rindió y no va a reiniciar: se vuelve a conectar desde cero. */
  private async reconectar(): Promise<void> {
    await this.consumidor?.disconnect().catch(() => undefined);
    await esperar(REINTENTO_MS);
    await this.conectarConReintentos();
  }

  private async conectar(): Promise<void> {
    const kafka = new Kafka({
      clientId: 'material',
      brokers: this.config
        .get<string>('KAFKA_BROKERS', 'localhost:9092')
        .split(','),
      // kafkajs repetiría cada error en JSON; los informamos nosotros, una vez.
      logLevel: logLevel.NOTHING,
    });

    const consumidor = kafka.consumer({
      groupId: 'material',
      // Los tópicos los crea Sesiones; si aún no existen, se reintenta.
      allowAutoTopicCreation: false,
    });
    this.consumidor = consumidor;

    // Ya conectado, kafkajs se recupera solo de casi todas las caídas. Si
    // decide no reiniciar, el consumidor quedaría muerto: se reconecta aquí.
    consumidor.on(consumidor.events.CRASH, ({ payload }) => {
      this.logger.error(
        `El consumidor se cayó: ${payload.error.message}` +
          (payload.restart ? '; kafkajs lo reinicia' : '; se reconecta'),
      );
      const esElActual = consumidor === this.consumidor;
      if (!payload.restart && esElActual && !this.detenido) {
        void this.reconectar();
      }
    });

    await this.consumidor.connect();
    await this.consumidor.subscribe({
      topics: [...TOPICOS_SESION],
      // Solo la primera vez (sin offsets guardados): para no perder las
      // sesiones creadas antes de que Material existiera.
      fromBeginning: true,
    });
    await this.consumidor.run({
      eachMessage: ({ topic, message }) =>
        this.eventos.aplicar(topic, message.value),
    });
  }
}
