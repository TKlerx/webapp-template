FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV COREPACK_HOME=/corepack
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /corepack \
    && corepack enable \
    && corepack prepare pnpm@11.1.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM base AS migrate-deps
WORKDIR /migrate-runtime
COPY docker/migrate/package.json ./package.json
COPY pnpm-workspace.yaml ./
RUN pnpm install --prod

FROM base AS builder
WORKDIR /app
ARG BASE_PATH
ENV BASE_PATH=$BASE_PATH
ENV AUTH_BASE_URL=http://localhost:3270
ENV BETTER_AUTH_SECRET=docker-build-secret-change-me-at-least-32-characters
ENV APP_DATABASE_URL=postgresql://starter:starter@localhost:5432/business_app_starter
ENV DATABASE_URL=postgresql://starter:starter@localhost:5432/business_app_starter
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate --config prisma.config.postgres.ts && pnpm run build

FROM base AS migrate-runner
WORKDIR /app
COPY --from=migrate-deps /migrate-runtime/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma.config.postgres.ts ./prisma.config.postgres.ts
COPY --from=builder /app/scripts ./scripts

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3270
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/package.json ./package.json
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /app/uploads /data \
    && chown -R nextjs:nodejs /app /data /corepack
USER nextjs
EXPOSE 3270
CMD ["node", "server.js"]
