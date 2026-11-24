import { Types } from 'mongoose';
import { aArchivo, aMaterial } from './materiales.mapper';
import { Material, TipoMaterial } from './schemas/materiales.schema';

describe('materiales.mapper', () => {
  const archivo: Material = {
    _id: 'id-1',
    tutorId: 'tutor-1',
    ramoCodigo: 'MAT1610',
    tipo: TipoMaterial.ARCHIVO,
    titulo: 'Guía',
    archivo: {
      gridfsId: new Types.ObjectId(),
      nombre: 'guia.pdf',
      tipoMime: 'application/pdf',
      tamanoBytes: 482113,
    },
    creadoEn: new Date('2026-11-20T18:00:00.250Z'),
  };

  it('nunca expone el gridfsId, que es un detalle interno', () => {
    expect(aArchivo(archivo.archivo!)).not.toHaveProperty('gridfsId');
    expect(aMaterial(archivo).archivo).not.toHaveProperty('gridfsId');
  });

  it('un archivo lleva sus datos y no tiene texto', () => {
    expect(aMaterial(archivo)).toEqual({
      id: 'id-1',
      tutorId: 'tutor-1',
      ramoCodigo: 'MAT1610',
      tipo: TipoMaterial.ARCHIVO,
      titulo: 'Guía',
      texto: undefined,
      archivo: {
        nombre: 'guia.pdf',
        tipoMime: 'application/pdf',
        tamanoBytes: 482113,
      },
      creadoEn: { seconds: 1795197600, nanos: 250_000_000 },
    });
  });

  it('un aviso lleva su texto y no tiene archivo', () => {
    const aviso = aMaterial({
      _id: 'id-2',
      tutorId: 'tutor-1',
      ramoCodigo: 'MAT1610',
      tipo: TipoMaterial.AVISO,
      titulo: 'Para el jueves',
      texto: 'Traigan calculadora.',
      creadoEn: new Date(),
    });
    expect(aviso.texto).toBe('Traigan calculadora.');
    expect(aviso.archivo).toBeUndefined();
  });
});
