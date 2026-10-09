# The live demo's image: Fastify serves the built editor and /api from one origin.
# The server runs its TypeScript as is (Node strips the types), so only the editor has a build step.

FROM node:24-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# The server's production dependencies, in the workspace layout: @trafaret/core stays a link to packages/core,
# because Node refuses to strip types from files inside node_modules.
FROM base AS deps
RUN pnpm install --frozen-lockfile --prod --filter @trafaret/server...

FROM node:24-slim
# The Mock model draws the prompt as text, which needs a font.
RUN apt-get update \
  && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/server/node_modules apps/server/node_modules
COPY --from=deps /app/packages/core/node_modules packages/core/node_modules
COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/core/src packages/core/src
COPY apps/server/package.json apps/server/
COPY apps/server/src apps/server/src
COPY apps/server/library apps/server/library
COPY --from=build /app/apps/web/dist apps/web/dist
USER node
EXPOSE 8080
CMD ["node", "apps/server/src/main.ts"]
