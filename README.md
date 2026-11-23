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
docker compose up -d                                # Mongo (localhost:27018) y Kafka (localhost:9092)
npm run start:dev
```

Si ya clonaste sin `--recurse-submodules`: `git submodule update --init`.

| Variable | Para qué |
|---|---|
| `MONGO_URI` | Conexión a Mongo, base `material`. |
| `GRPC_URL` | Dónde escucha gRPC (`0.0.0.0:9090`). |
| `KAFKA_BROKERS` | Brokers de Kafka, separados por coma (`localhost:9092`). |
| `USUARIOS_GRPC_URL`, `SESIONES_GRPC_URL` | Servicios a los que llama Material (`usuarios:9090`, `sesiones:9090` en Kubernetes). |
| `CLIENTES_FALSOS` | `true` para desarrollar sin Usuarios ni Sesiones: usa los datos de `src/clientes/datos-demo.ts`. Sin esta variable, las dos URL son obligatorias y la app no arranca sin ellas. |
| `PORT` | Puerto HTTP. Hoy no tiene rutas; queda para el health check de Kubernetes. |

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
  clientes/      Usuarios y Sesiones: puerto, cliente gRPC real (plazo de 3 s) y versión falsa
  evaluaciones/  Evaluar, ListarEvaluaciones, ListarMisEvaluaciones, ObtenerResumenTutores
  materiales/    SubirMaterial, ListarMaterial, DescargarArchivo, EliminarMaterial; bytes en GridFS
  sesiones/      copia local de las sesiones, armada desde Kafka; regla de visibilidad del material
```

Cada controlador gRPC lleva `@UseFilters(GrpcExceptionFilter)`: en una app híbrida (HTTP + gRPC) el filtro global no llega a los controladores gRPC.

## Kafka

Material consume `sesion.creada`, `sesion.finalizada` y `sesion.cancelada` (grupo `material`), que publica Sesiones con el formato de `contracts/eventos/`. Con ellos arma su copia de las sesiones, que decide qué material ve cada alumno.

- Se conecta en segundo plano: si Kafka no responde o los tópicos aún no existen, reintenta cada 5 s y gRPC funciona igual.
- La primera vez lee los tópicos desde el inicio, para no perder sesiones anteriores.
- Un mensaje mal formado se registra y se salta; si falla Mongo, Kafka vuelve a entregarlo.
- Los tópicos los crea Sesiones. En local se pueden crear a mano:

```bash
docker exec material-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic sesion.creada
```
