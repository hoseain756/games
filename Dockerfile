# --- build stage ------------------------------------------------------------
# Node for `next build` + `node scripts/postbuild.mjs`, Bun for the
# lockfile-faithful install (bun.lock).
FROM node:22-slim AS build
RUN npm install -g bun@1
# Prisma detects the OpenSSL flavor via the CLI binary — without this it
# warns and may pick a mismatched engine for Debian bookworm (slim).
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# The project postinstall runs `prisma generate`, so the schema MUST exist
# before `bun install` — copying it here also keeps the dependency layer
# cache-correct (invalidate on schema change).
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- runtime stage ----------------------------------------------------------
# Pure Node: scripts/prod-server.mjs fronts the Next.js standalone server and
# the in-process realtime game engines (:3003/:3004) behind ONE public port,
# honoring ?XTransformPort= exactly like the sandbox gateway.
FROM node:22-slim AS runtime
# libssl/openssl for the Prisma query engine binaries traced into the
# standalone output (unused routes today, but cheap insurance).
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_INTERNAL_PORT=3001

COPY --from=build /app/.next/standalone ./.next/standalone
COPY --from=build /app/scripts ./scripts

EXPOSE 3000
CMD ["node", "scripts/prod-server.mjs"]
