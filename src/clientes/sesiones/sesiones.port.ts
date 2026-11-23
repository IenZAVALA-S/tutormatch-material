export interface Participacion {
  finalizada: boolean;
  participo: boolean;
  tutorId: string;
  ramoCodigo: string;
}

export abstract class SesionesPort {
  /**
   * @throws NoEncontradoError si la sesión no existe
   * @throws ServicioNoDisponibleError si Sesiones no responde
   */
  abstract verificarParticipacion(
    sesionId: string,
    estudianteId: string,
  ): Promise<Participacion>;
}
