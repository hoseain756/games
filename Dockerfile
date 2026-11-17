# --- build stage ------------------------------------------------------------
# Node for `next build` + `node scripts/postbuild.mjs`, Bun for the
# lockfile-faithful install (bun.lock).
FROM node:22-slim AS build
RUN npm install -g bun@1
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- runtime stage ----------------------------------------------------------
# Pure Node: scripts/prod-server.mjs fronts the Next.js standalone server and
# the in-process realtime game engines (:3003/:3004) behind ONE public port,
# honoring ?XTransformPort= exactly like the sandbox gateway.
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_INTERNAL_PORT=3001

COPY --from=build /app/.next/standalone ./.next/standalone
COPY --from=build /app/scripts ./scripts

EXPOSE 3000
CMD ["node", "scripts/prod-server.mjs"]
