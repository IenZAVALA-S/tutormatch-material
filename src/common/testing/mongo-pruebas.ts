import { Connection, createConnection, Model, Schema } from 'mongoose';

/**
 * Base de Mongo para los tests de integración (*.int-spec.ts). Usa el Mongo del
 * docker-compose, en una base aparte: nunca toca la base "material" de desarrollo.
 *
 * Entre corridas se VACÍA, no se borra: en Docker sobre Windows crear una
 * colección tarda ~8 s y un índice ~11 s, mientras que vaciarla tarda ms. Así
 * solo la primera corrida paga ese costo.
 */
export const MONGO_URI_PRUEBAS =
  process.env.MONGO_URI_PRUEBAS ?? 'mongodb://localhost:27018/material_pruebas';

/** Plazo para los beforeAll: la primera corrida crea colecciones e índices. */
export const PLAZO_PREPARACION_MS = 300_000;

export async function conectarMongoDePrueba(): Promise<Connection> {
  const conexion = await createConnection(MONGO_URI_PRUEBAS, {
    serverSelectionTimeoutMS: 5_000,
  }).asPromise();
  await vaciar(conexion);
  return conexion;
}

/**
 * Modelo con sus índices ya construidos (como el único de evaluaciones).
 * El cast es porque conexion.model() devuelve un tipo un poco distinto del
 * Model<T> que reciben los repositorios, aunque en ejecución es lo mismo.
 */
export async function modeloDePrueba<T>(
  conexion: Connection,
  nombre: string,
  schema: Schema,
): Promise<Model<T>> {
  const modelo = conexion.model(nombre, schema) as unknown as Model<T>;
  await modelo.init();
  return modelo;
}

/** Vacía todas las colecciones, conservando las colecciones y sus índices. */
export async function vaciar(conexion: Connection): Promise<void> {
  const colecciones = await conexion.db!.collections();
  await Promise.all(colecciones.map((c) => c.deleteMany({})));
}

export async function cerrar(conexion: Connection): Promise<void> {
  await vaciar(conexion);
  await conexion.close();
}
