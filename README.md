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
docker compose up -d                                # Mongo (localhost:27018) y Kafka (localhost:9192)
npm run start:dev
```

Si ya clonaste sin `--recurse-submodules`: `git submodule update --init`.

| Variable | Para qué |
|---|---|
| `MONGO_URI` | Conexión a Mongo, base `material`. |
| `GRPC_URL` | Dónde escucha gRPC (`0.0.0.0:9090`). |
| `KAFKA_BROKERS` | Brokers de Kafka, separados por coma (`localhost:9192`, el del `docker-compose`). Para probar junto a Sesiones, el de ellos (`localhost:9092`). |
| `USUARIOS_GRPC_URL`, `SESIONES_GRPC_URL` | Servicios a los que llama Material (`usuarios:9090`, `sesiones:9090` en Kubernetes). |
| `CLIENTES_FALSOS` | `true` para desarrollar sin Usuarios ni Sesiones: usa los datos de `src/clientes/datos-demo.ts`. Sin esta variable, las dos URL son obligatorias y la app no arranca sin ellas. |
| `PORT` | Puerto HTTP, solo para las sondas de salud (ver Despliegue). |

## Tests

```bash
npm test                  # unitarios (*.spec.ts): no necesitan nada levantado
npm run test:integracion  # *.int-spec.ts: necesitan `docker compose up -d`
npm run test:cov          # los dos juntos, con coverage; falla bajo 60% (necesita `docker compose up -d`)
npm run lint
npm run format
```

Los de integración prueban las consultas reales contra Mongo (base `material_pruebas`, aparte de la de desarrollo) y, en `src/app.int-spec.ts`, la app completa de punta a punta: gRPC como el BFF, eventos en Kafka (con su propio grupo de consumidores) y GridFS.

La primera corrida tarda unos minutos: en Docker sobre Windows crear cada colección e índice toma varios segundos. Después la base solo se vacía, no se borra, y las siguientes corridas son rápidas.

El coverage se mide con unitarios e integración juntos: los unitarios solos no llegan al 60% en funciones, porque los repositorios y el consumidor de Kafka se prueban contra Mongo y Kafka reales.

## CI

`.github/workflows/ci.yml` (GitHub Actions) corre en cada push y pull request: `npm ci`, lint, build, `test:cov` con el umbral de 60% y `docker build`. Mongo y Kafka se levantan como contenedores de servicio, en los mismos puertos que el `docker-compose`. La imagen todavía no se publica.

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
docker exec material-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9192 --create --topic sesion.creada
```

## Despliegue

```bash
git submodule update --init      # la imagen copia los .proto de contracts/
docker build -t tutormatch-material .
```

La imagen escucha gRPC en `9090` y HTTP en `3002`; este último solo tiene las sondas de salud. Al recibir SIGTERM cierra ordenado: sale del grupo de Kafka y cierra Mongo.

| Ruta | Para qué | Responde |
|---|---|---|
| `GET /health/vivo` | `livenessProbe`: si falla, Kubernetes reinicia el pod | siempre `200` mientras el proceso responda |
| `GET /health/listo` | `readinessProbe`: si falla, no le manda tráfico | `200` con Mongo conectado; `503` sin Mongo. Kafka se informa, pero no lo deja "no listo": gRPC funciona sin él |

Sondas para el Deployment:

```yaml
livenessProbe:
  httpGet: { path: /health/vivo, port: 3002 }
  periodSeconds: 10
readinessProbe:
  httpGet: { path: /health/listo, port: 3002 }
  periodSeconds: 5
```

Variables en Kubernetes: `MONGO_URI` (en un Secret), `GRPC_URL=0.0.0.0:9090`, `PORT=3002`, `KAFKA_BROKERS`, `USUARIOS_GRPC_URL=usuarios:9090` y `SESIONES_GRPC_URL=sesiones:9090`. Sin `CLIENTES_FALSOS`.
