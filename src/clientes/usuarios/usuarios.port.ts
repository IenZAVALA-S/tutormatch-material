export abstract class UsuariosPort {
  /**
   * true si el tutor tiene ese ramo activo.
   * @throws ServicioNoDisponibleError si Usuarios no responde
   */
  abstract validarTutorRamo(
    tutorId: string,
    ramoCodigo: string,
  ): Promise<boolean>;
}
