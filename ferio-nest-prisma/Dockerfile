# ──────────────────────────────────────────────────────────────
# Ferio Backend — NestJS + Prisma (multi-stage)
# ──────────────────────────────────────────────────────────────

# ── Stage 1: Build ──
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile=false

COPY prisma/ prisma/
# Dummy URLs satisfy env() validation during client generation (no DB connection needed)
ENV CONTROL_PLANE_DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV MARKETPLACE_DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV TENANT_DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate --config prisma/control-plane/prisma.config.ts && \
    npx prisma generate --config prisma/marketplace/prisma.config.ts && \
    npx prisma generate --config prisma/tenant/prisma.config.ts && \
    npx prisma generate --schema prisma/schema.prisma

COPY tsconfig* nest-cli.json ./
COPY src/ src/
COPY libs/ libs/
RUN npx nest build && npx nest build common && npx nest build database && npx nest build redis && npx nest build queue

# ── Stage 2: Runtime ──
FROM node:22-slim
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /app/dist/ dist/
COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/package.json ./
COPY --from=build /app/prisma/ prisma/

ENV NODE_ENV=production
EXPOSE 6733

CMD ["node", "dist/src/main.js"]
