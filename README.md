# TutorMatch · Material

Servicio de Material y Evaluaciones de TutorMatch (NestJS + MongoDB). Guarda el material que suben los tutores (archivos y avisos) y las evaluaciones que los alumnos hacen de los tutores. Se expone solo por gRPC; lo consume el BFF.

Las decisiones y el contrato están en el submódulo `contracts/`:

- `contracts/propuestas/material.md`: qué se acordó y por qué.
- `contracts/proto/material/v1/material.proto`: el contrato gRPC que implementa este servicio.

## Correr en local

```bash
git clone --recurse-submodules <url-de-este-repo>   # trae también contracts/
npm install
cp .env.example .env
docker compose up -d                                # Mongo en localhost:27018
npm run start:dev
```

Si ya clonaste sin `--recurse-submodules`: `git submodule update --init`.

| Variable | Para qué |
|---|---|
| `MONGO_URI` | Conexión a Mongo, base `material`. |
| `GRPC_URL` | Dónde escucha gRPC (`0.0.0.0:9090`). |
| `PORT` | Puerto HTTP. Hoy no tiene rutas. |

## Tests

```bash
npm test       # unitarios, no necesitan Mongo
npm run lint
npm run format
```

## Estructura

```
src/
  common/        errores de dominio, filtro que los traduce a códigos gRPC, utilidades
  clientes/      puertos hacia Usuarios y Sesiones (por ahora, versiones falsas con datos demo)
  evaluaciones/  Evaluar, ListarEvaluaciones, ListarMisEvaluaciones, ObtenerResumenTutores
  materiales/    SubirMaterial, ListarMaterial, DescargarArchivo, EliminarMaterial (pendiente)
  sesiones/      copia local de las sesiones, armada desde Kafka (pendiente el consumidor)
```

Cada controlador gRPC lleva `@UseFilters(GrpcExceptionFilter)`: en una app híbrida (HTTP + gRPC) el filtro global no llega a los controladores gRPC.
