FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=optional

FROM base AS builder
WORKDIR /app
ARG BASE_PATH
ENV BASE_PATH=$BASE_PATH
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --config prisma.config.postgres.ts && npm run build

FROM base AS migrate-runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma.config.postgres.ts ./prisma.config.postgres.ts
COPY --from=builder /app/scripts ./scripts

FROM base AS prod-deps
COPY package*.json ./
RUN npm ci --omit=dev --omit=optional

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/generated ./generated
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma.config.postgres.ts ./prisma.config.postgres.ts
COPY --from=builder /app/scripts ./scripts
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /app/uploads /data \
    && chown -R nextjs:nodejs /app /data
USER nextjs
EXPOSE 3270
CMD ["npm", "run", "start"]
