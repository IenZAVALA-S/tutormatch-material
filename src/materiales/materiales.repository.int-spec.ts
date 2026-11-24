import { Connection, Model } from 'mongoose';
import {
  cerrar,
  conectarMongoDePrueba,
  modeloDePrueba,
  PLAZO_PREPARACION_MS,
  vaciar,
} from '../common/testing/mongo-pruebas';
import { ArchivosStorage } from './archivos.storage';
import { MaterialesRepository, NuevoMaterial } from './materiales.repository';
import {
  Material,
  MaterialSchema,
  TipoMaterial,
} from './schemas/materiales.schema';

describe('MaterialesRepository y ArchivosStorage (Mongo real)', () => {
  let conexion: Connection;
  let modelo: Model<Material>;
  let repo: MaterialesRepository;
  let archivos: ArchivosStorage;

  const aviso = (tutorId: string, ramoCodigo: string, titulo: string) =>
    ({
      tutorId,
      ramoCodigo,
      titulo,
      tipo: TipoMaterial.AVISO,
      texto: 'x',
    }) as NuevoMaterial;

  beforeAll(async () => {
    conexion = await conectarMongoDePrueba();
    modelo = await modeloDePrueba<Material>(
      conexion,
      Material.name,
      MaterialSchema,
    );
    repo = new MaterialesRepository(modelo);
    archivos = new ArchivosStorage(conexion);
  }, PLAZO_PREPARACION_MS);
  afterEach(() => vaciar(conexion));
  afterAll(() => cerrar(conexion));

  describe('listar', () => {
    // yo: mi material. tutor-A en MAT y FIS. tutor-B en MAT.
    beforeEach(async () => {
      for (const [tutor, ramo, titulo] of [
        ['yo', 'MAT1610', 'mío'],
        ['tutor-A', 'MAT1610', 'A-MAT'],
        ['tutor-A', 'FIS1514', 'A-FIS'],
        ['tutor-B', 'MAT1610', 'B-MAT'],
      ]) {
        await repo.crear(aviso(tutor, ramo, titulo));
        await new Promise((r) => setTimeout(r, 5)); // creadoEn distintos
      }
    });

    const titulos = async (
      visibles: { tutorId: string; ramoCodigo: string }[],
      filtros = {},
    ) =>
      (
        await repo.listar({
          usuarioId: 'yo',
          visibles,
          tutorId: '',
          ramoCodigo: '',
          ...filtros,
        })
      ).map((m) => m.titulo);

    it('sin sesiones, solo el material propio', async () => {
      expect(await titulos([])).toEqual(['mío']);
    });

    it('lo propio más cada par tutor-ramo visible, del más nuevo al más antiguo', async () => {
      expect(
        await titulos([{ tutorId: 'tutor-A', ramoCodigo: 'MAT1610' }]),
      ).toEqual(['A-MAT', 'mío']);
    });

    it('ver a un tutor en un ramo no muestra sus otros ramos', async () => {
      const lista = await titulos([
        { tutorId: 'tutor-A', ramoCodigo: 'MAT1610' },
      ]);
      expect(lista).not.toContain('A-FIS');
    });

    it('los filtros acotan dentro de lo visible, no amplían', async () => {
      const visibles = [
        { tutorId: 'tutor-A', ramoCodigo: 'MAT1610' },
        { tutorId: 'tutor-A', ramoCodigo: 'FIS1514' },
      ];
      expect(await titulos(visibles, { tutorId: 'tutor-A' })).toEqual([
        'A-FIS',
        'A-MAT',
      ]);
      expect(await titulos(visibles, { ramoCodigo: 'FIS1514' })).toEqual([
        'A-FIS',
      ]);
      // tutor-B no es visible: filtrar por él no lo hace aparecer
      expect(await titulos(visibles, { tutorId: 'tutor-B' })).toEqual([]);
    });
  });

  it('crear, buscar y eliminar', async () => {
    const { _id } = await repo.crear(aviso('yo', 'MAT1610', 'x'));
    expect((await repo.buscarPorId(_id))?.titulo).toBe('x');

    await repo.eliminar(_id);
    expect(await repo.buscarPorId(_id)).toBeNull();
  });

  describe('ArchivosStorage (GridFS)', () => {
    // 1 MB: GridFS lo parte en varios trozos de 255 KB.
    const datos = Buffer.alloc(1024 * 1024, 7);

    it('guarda y devuelve exactamente los mismos bytes', async () => {
      const id = await archivos.guardar('guia.pdf', datos);

      expect((await archivos.leer(id)).equals(datos)).toBe(true);
      expect(
        await conexion.db!.collection('archivos.chunks').countDocuments(),
      ).toBe(5);
    });

    it('borrar elimina el archivo y todos sus trozos', async () => {
      const id = await archivos.guardar('guia.pdf', datos);

      await archivos.borrar(id);

      await expect(archivos.leer(id)).rejects.toThrow();
      expect(
        await conexion.db!.collection('archivos.chunks').countDocuments(),
      ).toBe(0);
    });
  });
});
