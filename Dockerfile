# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Dockerfile de producción (multi-stage) para el Gemelo Digital de Berlín
# Genera una imagen ligera usando el output "standalone" de Next.js.
# ─────────────────────────────────────────────────────────────

# 1) Dependencias ------------------------------------------------
FROM node:20-alpine AS deps
# libc6-compat mejora la compatibilidad de algunos binarios nativos en Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Solo copiamos manifiestos para aprovechar la cache de capas
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 2) Build -------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Deshabilita telemetría de Next durante el build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3) Runtime -----------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario sin privilegios por seguridad
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copiamos únicamente lo necesario del output standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# El server.js lo genera Next.js con output "standalone"
CMD ["node", "server.js"]
