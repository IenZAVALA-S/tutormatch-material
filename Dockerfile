# Imagen del servicio de Material.
#
# Necesita el submódulo contracts/ descargado al construir (los .proto se leen
# en tiempo de ejecución). En GitHub Actions: checkout con submodules: true.
#
#   docker build -t tutormatch-material .

# ---- 1. Compilar ----
FROM node:24-alpine AS compilacion
WORKDIR /app

# Primero solo las dependencias: Docker reutiliza esta capa mientras
# package-lock.json no cambie, y la imagen se reconstruye mucho más rápido.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build \
 # Quita las dependencias de desarrollo (jest, typescript...) antes de copiar.
 && npm prune --omit=dev

# ---- 2. Imagen final: solo lo necesario para correr ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=compilacion /app/node_modules ./node_modules
COPY --from=compilacion /app/dist ./dist
COPY package.json ./
# Los .proto de Material, Usuarios y Sesiones (ver grpc.constantes.ts).
COPY contracts/proto ./contracts/proto

# No correr como root.
USER node

# 9090: gRPC (lo que usa el BFF). 3002: HTTP, solo para /health/vivo y /health/listo.
EXPOSE 9090 3002

# Sin npm de por medio: así el proceso recibe directo la señal de apagado de
# Kubernetes y se cierra ordenado (desconecta Kafka y Mongo).
CMD ["node", "dist/main.js"]
