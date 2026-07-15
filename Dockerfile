# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS base
ENV CI=true
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/test-support/package.json packages/test-support/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS source
COPY . .

FROM source AS web-builder
ARG INTERNAL_API_ORIGIN=http://authometry-api:4000
ENV INTERNAL_API_ORIGIN=$INTERNAL_API_ORIGIN
RUN pnpm --filter @authometry/web build

FROM node:24-alpine AS web
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM source AS server-builder
RUN pnpm --filter @authometry/server build

FROM node:24-alpine AS server
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 authometry
COPY --from=server-builder --chown=authometry:nodejs /app/apps/server/dist ./dist
COPY --from=server-builder --chown=authometry:nodejs /app/apps/server/migrations ./migrations
USER authometry
EXPOSE 4000
CMD ["node", "dist/index.js"]
