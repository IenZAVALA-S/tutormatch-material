import { join } from 'node:path';

export const GRPC_PACKAGE_MATERIAL = 'tutorias.material.v1';

export const GRPC_PROTO_MATERIAL = join(
  process.cwd(),
  'contracts/proto/material/v1/material.proto',
);

export const GRPC_TAMANO_MAXIMO_MENSAJE = 11 * 1024 * 1024;

export const GRPC_OPCIONES_LOADER = {
  keepCase: false, // tutor_id (proto) → tutorId (JS)
  longs: Number, // int64 (tamano_bytes) → number, en vez de un objeto Long
  enums: String, // TipoMaterial → 'ARCHIVO' en vez de 1
  defaults: true, // los campos que no vienen llegan con su valor por defecto
  oneofs: true, // agrega el campo "contenido" que dice si vino 'texto' o 'archivo'
};
