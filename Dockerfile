# ===================================================================
# Saturn Studio — image Docker de production
# Contexte de build = racine du repo (saturn-studio/), car l'app a besoin
# de ses dossiers FRÈRES au runtime :
#   REPO_ROOT = process.cwd()/..  →  <parent>/.claude/agents, content/, etc.
# On calque donc la structure dans /srv/saturn :
#   /srv/saturn/naiom-platform   (l'app, WORKDIR = process.cwd())
#   /srv/saturn/.claude/agents   (les 6 modules d'agents)
#   /srv/saturn/content, meetings, ...   (livrables → volumes)
# ===================================================================

# ---- base commune ----
FROM node:20-slim AS base
WORKDIR /srv/saturn/naiom-platform
ENV NEXT_TELEMETRY_DISABLED=1

# ---- dépendances (couche cache) ----
FROM base AS deps
COPY naiom-platform/package.json naiom-platform/package-lock.json ./
RUN npm ci

# ---- build de production ----
FROM base AS build
COPY --from=deps /srv/saturn/naiom-platform/node_modules ./node_modules
COPY naiom-platform/ ./
RUN npm run build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
# Modules d'agents, frères de l'app (indispensables à PATHS.agents).
COPY .claude /srv/saturn/.claude
# App buildée (inclut .next, node_modules, public/, next.config, package.json).
COPY --from=build /srv/saturn/naiom-platform ./
EXPOSE 3000
# `next start` sert le build — PAS `next dev`.
CMD ["npm", "run", "start", "--", "-p", "3000"]
