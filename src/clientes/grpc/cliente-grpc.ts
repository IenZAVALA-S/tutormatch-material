import {
  Client,
  credentials,
  loadPackageDefinition,
  Metadata,
  ServiceError,
  status,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import {
  NoEncontradoError,
  ServicioNoDisponibleError,
} from '../../common/errores/errores-dominio';
import { GRPC_OPCIONES_LOADER } from '../../common/grpc/grpc.constantes';

/** Cuánto se espera a otro servicio antes de darlo por caído. */
export const PLAZO_GRPC_MS = 3_000;

type MetodoUnario = (
  req: object,
  metadata: Metadata,
  opciones: { deadline: Date },
  callback: (error: ServiceError | null, res: unknown) => void,
) => void;

/**
 * Cliente gRPC de otro servicio, armado desde su .proto de contracts/.
 * Traduce los errores de gRPC a errores de dominio, que el filtro de Material
 * convierte de vuelta en códigos para el BFF.
 */
export class ClienteGrpc {
  private readonly cliente: Client;

  constructor(
    /** Para los mensajes de error, ej. "Usuarios". */
    private readonly nombre: string,
    protoPath: string,
    /** Nombre completo, ej. "tutorias.usuarios.v1.UsuariosService". */
    servicio: string,
    url: string,
    private readonly plazoMs = PLAZO_GRPC_MS,
  ) {
    const paquete = loadPackageDefinition(
      loadSync(protoPath, GRPC_OPCIONES_LOADER),
    );
    const Servicio = servicio
      .split('.')
      .reduce<any>((nodo, parte) => nodo[parte], paquete);
    // No conecta todavía: el canal se abre en la primera llamada.
    this.cliente = new Servicio(url, credentials.createInsecure());
  }

  llamar<Res>(metodo: string, req: object): Promise<Res> {
    const fn = (this.cliente as unknown as Record<string, MetodoUnario>)[
      metodo
    ].bind(this.cliente);
    const deadline = new Date(Date.now() + this.plazoMs);

    return new Promise((resolve, reject) => {
      fn(req, new Metadata(), { deadline }, (error, res) =>
        error ? reject(this.traducir(metodo, error)) : resolve(res as Res),
      );
    });
  }

  cerrar(): void {
    this.cliente.close();
  }

  private traducir(metodo: string, error: ServiceError): Error {
    switch (error.code) {
      case status.UNAVAILABLE:
      case status.DEADLINE_EXCEEDED:
        return new ServicioNoDisponibleError(`${this.nombre} no responde`);
      case status.NOT_FOUND:
        return new NoEncontradoError(error.details);
      default:
        // Llega al BFF como INTERNAL; el detalle queda en el log de Material.
        return new Error(
          `${this.nombre}.${metodo} respondió ${status[error.code]}: ${error.details}`,
        );
    }
  }
}
