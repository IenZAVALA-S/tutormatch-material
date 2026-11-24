import { randomUUID } from 'node:crypto';
import {
  ArgumentoInvalidoError,
  NoEncontradoError,
  PrecondicionFallidaError,
  YaExisteError,
} from '../common/errores/errores-dominio';
import { DEMO } from '../clientes/datos-demo';
import { SesionesFake } from '../clientes/sesiones/sesiones.fake';
import {
  EvaluacionesRepository,
  NuevaEvaluacion,
  ResumenEvaluaciones,
} from './evaluaciones.repository';
import { EvaluacionesService, EvaluarComando } from './evaluaciones.service';
import { Evaluacion } from './schemas/evaluaciones.schema';

/** Repository en memoria: se porta como el real, sin necesitar Mongo. */
class RepositorioEnMemoria {
  readonly guardadas: Evaluacion[] = [];

  crear(datos: NuevaEvaluacion): Promise<Evaluacion> {
    if (this.guardadas.some((e) => e.sesionId === datos.sesionId)) {
      return Promise.reject(new YaExisteError('Esta sesión ya fue evaluada'));
    }
    const evaluacion: Evaluacion = {
      ...datos,
      _id: randomUUID(),
      creadaEn: new Date(),
    };
    this.guardadas.push(evaluacion);
    return Promise.resolve(evaluacion);
  }

  listarPorTutor(tutorId: string): Promise<Evaluacion[]> {
    return Promise.resolve(this.guardadas.filter((e) => e.tutorId === tutorId));
  }

  listarPorEstudiante(estudianteId: string): Promise<Evaluacion[]> {
    return Promise.resolve(
      this.guardadas.filter((e) => e.estudianteId === estudianteId),
    );
  }

  resumenPorTutores(
    tutorIds: string[],
  ): Promise<Map<string, ResumenEvaluaciones>> {
    const mapa = new Map<string, ResumenEvaluaciones>();
    for (const id of tutorIds) {
      const notas = this.guardadas
        .filter((e) => e.tutorId === id)
        .map((e) => e.nota);
      if (notas.length > 0) {
        const suma = notas.reduce((a, b) => a + b, 0);
        mapa.set(id, { promedio: suma / notas.length, cantidad: notas.length });
      }
    }
    return Promise.resolve(mapa);
  }
}

describe('EvaluacionesService', () => {
  let repositorio: RepositorioEnMemoria;
  let sesiones: SesionesFake;
  let servicio: EvaluacionesService;

  const valida: EvaluarComando = {
    sesionId: DEMO.sesionFinalizadaId,
    estudianteId: DEMO.estudianteId,
    nota: 5,
    comentario: '  Explica muy bien.  ',
  };

  beforeEach(() => {
    repositorio = new RepositorioEnMemoria();
    sesiones = new SesionesFake();
    servicio = new EvaluacionesService(
      repositorio as unknown as EvaluacionesRepository,
      sesiones,
    );
  });

  describe('evaluar', () => {
    it('guarda la evaluación con el tutor y el ramo que informa Sesiones', async () => {
      const evaluacion = await servicio.evaluar(valida);

      expect(evaluacion).toMatchObject({
        tutorId: DEMO.tutorId,
        ramoCodigo: DEMO.ramoCodigo,
        nota: 5,
        comentario: 'Explica muy bien.',
      });
    });

    it('acepta una evaluación sin comentario', async () => {
      const evaluacion = await servicio.evaluar({ ...valida, comentario: '' });
      expect(evaluacion.comentario).toBe('');
    });

    it('rechaza una segunda evaluación de la misma sesión', async () => {
      await servicio.evaluar(valida);
      await expect(servicio.evaluar(valida)).rejects.toThrow(YaExisteError);
    });

    it('rechaza si la sesión no existe', async () => {
      await expect(
        servicio.evaluar({ ...valida, sesionId: randomUUID() }),
      ).rejects.toThrow(NoEncontradoError);
    });

    it('rechaza si el estudiante no participó', async () => {
      await expect(
        servicio.evaluar({ ...valida, estudianteId: DEMO.otroEstudianteId }),
      ).rejects.toThrow(PrecondicionFallidaError);
    });

    it('rechaza si la sesión no está finalizada', async () => {
      await expect(
        servicio.evaluar({ ...valida, sesionId: DEMO.sesionPendienteId }),
      ).rejects.toThrow(PrecondicionFallidaError);
    });

    it.each([0, 6, 4.5, -1])('rechaza la nota %p', async (nota) => {
      await expect(servicio.evaluar({ ...valida, nota })).rejects.toThrow(
        ArgumentoInvalidoError,
      );
    });

    it('rechaza un comentario de más de 1000 caracteres', async () => {
      await expect(
        servicio.evaluar({ ...valida, comentario: 'a'.repeat(1001) }),
      ).rejects.toThrow(ArgumentoInvalidoError);
    });

    it('rechaza ids que no son UUID', async () => {
      await expect(
        servicio.evaluar({ ...valida, sesionId: 'hola' }),
      ).rejects.toThrow(ArgumentoInvalidoError);
    });

    it('no guarda nada cuando la validación falla', async () => {
      await expect(servicio.evaluar({ ...valida, nota: 9 })).rejects.toThrow();
      expect(repositorio.guardadas).toHaveLength(0);
    });
  });

  describe('listarEvaluaciones', () => {
    it('calcula el promedio y la cantidad', async () => {
      const otraSesion = randomUUID();
      sesiones.registrar({
        id: otraSesion,
        tutorId: DEMO.tutorId,
        estudianteId: DEMO.otroEstudianteId,
        ramoCodigo: DEMO.ramoCodigo,
        finalizada: true,
      });
      await servicio.evaluar(valida); // nota 5
      await servicio.evaluar({
        sesionId: otraSesion,
        estudianteId: DEMO.otroEstudianteId,
        nota: 3,
        comentario: '',
      });

      const resultado = await servicio.listarEvaluaciones(DEMO.tutorId);

      expect(resultado.cantidad).toBe(2);
      expect(resultado.promedio).toBe(4);
    });

    it('devuelve promedio 0 si el tutor no tiene evaluaciones', async () => {
      const resultado = await servicio.listarEvaluaciones(DEMO.tutorId);
      expect(resultado).toEqual({ evaluaciones: [], promedio: 0, cantidad: 0 });
    });
  });

  describe('listarMisEvaluaciones', () => {
    it('devuelve solo las evaluaciones del alumno', async () => {
      await servicio.evaluar(valida);

      expect(
        await servicio.listarMisEvaluaciones(DEMO.estudianteId),
      ).toHaveLength(1);
      expect(
        await servicio.listarMisEvaluaciones(DEMO.otroEstudianteId),
      ).toHaveLength(0);
    });
  });

  describe('obtenerResumenTutores', () => {
    it('incluye a los tutores sin evaluaciones, en el orden pedido', async () => {
      await servicio.evaluar(valida);
      const sinEvaluaciones = randomUUID();

      const resumenes = await servicio.obtenerResumenTutores([
        sinEvaluaciones,
        DEMO.tutorId,
      ]);

      expect(resumenes).toEqual([
        { tutorId: sinEvaluaciones, promedio: 0, cantidad: 0 },
        { tutorId: DEMO.tutorId, promedio: 5, cantidad: 1 },
      ]);
    });

    it('responde 0 y 0 a un id que no es UUID, sin fallar el lote', async () => {
      await servicio.evaluar(valida);

      const resumenes = await servicio.obtenerResumenTutores([
        'tut-e2e-278',
        DEMO.tutorId,
      ]);

      expect(resumenes).toEqual([
        { tutorId: 'tut-e2e-278', promedio: 0, cantidad: 0 },
        { tutorId: DEMO.tutorId, promedio: 5, cantidad: 1 },
      ]);
    });

    it('devuelve una lista vacía si no se pide ningún tutor', async () => {
      expect(await servicio.obtenerResumenTutores([])).toEqual([]);
    });
  });
});
