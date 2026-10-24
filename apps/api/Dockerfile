# Build from the repository root (npm workspaces):
#   docker build -f apps/api/Dockerfile -t travel-photo-journal-api .

ARG NODE_VERSION=22

# ---- build: compile TypeScript with the full dependency set -------------------------------------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Manifests first, so the dependency layer is cached until a package.json or the lockfile changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace=apps/api --include-workspace-root

COPY apps/api apps/api
RUN npm run build --workspace=apps/api

# ---- prod-deps: only what the running server needs ----------------------------------------------
FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# --ignore-scripts: the root "prepare" script installs git hooks, which a container has no use for.
# The two packages that do need their install step are rebuilt explicitly: argon2 (native module)
# and @prisma/engines (downloads the migration engine, which the non-root runtime user could not).
RUN npm ci --workspace=apps/api --omit=dev --ignore-scripts && npm rebuild argon2 @prisma/engines

# ---- runtime ------------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/api

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist ./dist
# Needed at release time: `prisma migrate deploy` reads the schema, migrations and config.
COPY apps/api/prisma ./prisma
COPY apps/api/prisma.config.ts apps/api/package.json ./

# Local-driver uploads live here; mount a volume to keep them. Owned by the unprivileged user.
RUN mkdir -p /data/uploads && chown -R node:node /data
ENV LOCAL_STORAGE_DIR=/data/uploads
USER node

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "dist/server.js"]
