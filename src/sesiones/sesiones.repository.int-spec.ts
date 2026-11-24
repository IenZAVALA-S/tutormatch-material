import { Connection, Model } from 'mongoose';
import {
  cerrar,
  conectarMongoDePrueba,
  modeloDePrueba,
  PLAZO_PREPARACION_MS,
  vaciar,
} from '../common/testing/mongo-pruebas';
import { EstadoSesion, Sesion, SesionSchema } from './schemas/sesiones.schema';
import { DatosSesion, SesionesRepository } from './sesiones.repository';

describe('SesionesRepository (Mongo real)', () => {
  let conexion: Connection;
  let modelo: Model<Sesion>;
  let repo: SesionesRepository;

  const TUTOR = 'tutor-1';
  const ALUMNO = 'alumno-1';
  const s1: DatosSesion = {
    sesionId: 'sesion-1',
    tutorId: TUTOR,
    estudianteId: ALUMNO,
    ramoCodigo: 'MAT1610',
  };
  const estado = async (id = s1.sesionId) =>
    (await modelo.findById(id).lean())?.estado;

  beforeAll(async () => {
    conexion = await conectarMongoDePrueba();
    modelo = await modeloDePrueba<Sesion>(conexion, Sesion.name, SesionSchema);
    repo = new SesionesRepository(modelo);
  }, PLAZO_PREPARACION_MS);
  afterEach(() => vaciar(conexion));
  afterAll(() => cerrar(conexion));

  describe('upserts de los eventos de Kafka', () => {
    it('sesion.creada crea la sesión como CREADA', async () => {
      await repo.registrarCreada(s1);
      expect(await modelo.findById(s1.sesionId).lean()).toEqual({
        _id: 'sesion-1',
        tutorId: TUTOR,
        estudianteId: ALUMNO,
        ramoCodigo: 'MAT1610',
        estado: EstadoSesion.CREADA,
      });
    });

    it('un sesion.creada repetido no duplica ni cambia nada', async () => {
      await repo.registrarCreada(s1);
      await repo.registrarCreada(s1);
      expect(await modelo.countDocuments()).toBe(1);
    });

    it('un sesion.creada tardío no revive una sesión cancelada', async () => {
      await repo.fijarEstado(s1, EstadoSesion.CANCELADA);
      await repo.registrarCreada(s1);
      expect(await estado()).toBe(EstadoSesion.CANCELADA);
    });

    it('sesion.finalizada sin sesion.creada (perdido) crea la sesión', async () => {
      await repo.fijarEstado(s1, EstadoSesion.FINALIZADA);
      expect(await estado()).toBe(EstadoSesion.FINALIZADA);
    });

    it('fijarEstado cambia el estado de una sesión existente', async () => {
      await repo.registrarCreada(s1);
      await repo.fijarEstado(s1, EstadoSesion.CANCELADA);
      expect(await estado()).toBe(EstadoSesion.CANCELADA);
    });
  });

  describe('regla de visibilidad', () => {
    const tr = { tutorId: TUTOR, ramoCodigo: 'MAT1610' };

    it.each([EstadoSesion.CREADA, EstadoSesion.FINALIZADA])(
      'una sesión %s da acceso',
      async (e) => {
        await repo.fijarEstado(s1, e);
        expect(await repo.tieneSesionVigente(ALUMNO, tr)).toBe(true);
      },
    );

    it('una sesión CANCELADA no da acceso', async () => {
      await repo.fijarEstado(s1, EstadoSesion.CANCELADA);
      expect(await repo.tieneSesionVigente(ALUMNO, tr)).toBe(false);
    });

    it('basta con una sesión vigente aunque otras estén canceladas', async () => {
      await repo.fijarEstado(s1, EstadoSesion.CANCELADA);
      await repo.registrarCreada({ ...s1, sesionId: 'sesion-2' });
      expect(await repo.tieneSesionVigente(ALUMNO, tr)).toBe(true);
    });

    it('no da acceso a otro ramo del mismo tutor ni a otro alumno', async () => {
      await repo.registrarCreada(s1);
      expect(
        await repo.tieneSesionVigente(ALUMNO, { ...tr, ramoCodigo: 'FIS1514' }),
      ).toBe(false);
      expect(await repo.tieneSesionVigente('alumno-2', tr)).toBe(false);
    });

    it('tutoresRamosVisibles da cada par una vez y omite los cancelados', async () => {
      await repo.registrarCreada(s1);
      await repo.registrarCreada({ ...s1, sesionId: 'sesion-2' }); // mismo par
      await repo.registrarCreada({
        ...s1,
        sesionId: 'sesion-3',
        ramoCodigo: 'FIS1514',
      });
      await repo.fijarEstado(
        { ...s1, sesionId: 'sesion-4', tutorId: 'tutor-2' },
        EstadoSesion.CANCELADA,
      );
      await repo.registrarCreada({
        ...s1,
        sesionId: 'sesion-5',
        estudianteId: 'alumno-2',
        tutorId: 'tutor-3',
      });

      const visibles = await repo.tutoresRamosVisibles(ALUMNO);

      expect(visibles).toHaveLength(2);
      expect(visibles).toEqual(
        expect.arrayContaining([
          { tutorId: TUTOR, ramoCodigo: 'MAT1610' },
          { tutorId: TUTOR, ramoCodigo: 'FIS1514' },
        ]),
      );
    });
  });
});
