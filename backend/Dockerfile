# Build from this directory:
#   docker build -t travel-photo-journal-api backend

ARG NODE_VERSION=22

# ---- build: compile TypeScript with the full dependency set -------------------------------------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Manifests first, so the dependency layer is cached until package.json or the lockfile changes.
# --ignore-scripts: "prepare" installs git hooks, which an image has no use for. The packages that
# do need an install step are rebuilt explicitly below.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild argon2

COPY . .
RUN npm run build

# ---- prod-deps: only what the running server needs ----------------------------------------------
FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# argon2 (native module) and @prisma/engines (downloads the migration engine, which the non-root
# runtime user could not) are rebuilt explicitly because scripts are skipped.
RUN npm ci --omit=dev --ignore-scripts && npm rebuild argon2 @prisma/engines

# ---- runtime ------------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Needed at release time: `prisma migrate deploy` reads the schema, migrations and config.
COPY prisma ./prisma
COPY prisma.config.ts package.json ./

# Local-driver uploads live here; mount a volume to keep them. Owned by the unprivileged user.
RUN mkdir -p /data/uploads && chown -R node:node /data
ENV LOCAL_STORAGE_DIR=/data/uploads
USER node

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "dist/server.js"]
