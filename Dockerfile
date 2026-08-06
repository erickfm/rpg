# ── CROSSTOWN '97 on Railway ──────────────────────────────────────────────
#
# Two stages, because the game is BUILT and the server is not. Stage one turns
# `street/src` into `street/dist`; stage two carries that `dist` plus the server
# and nothing else. The runtime image never sees three.js, vite, playwright or a
# TypeScript compiler.
#
# Node 24 in both. The floor is 22.5 — `server/db.mjs` uses `node:sqlite` from
# the standard library so that "zero-config locally" costs no npm package and no
# native build — but there is no reason to run the deploy on the floor.

# ══ stage 1: build the game ════════════════════════════════════════════════
FROM node:24-slim AS game

# ⚠ THE SHARED-CHECKOUT GUARD, AND WHY IT IS OPTED OUT HERE.
#
# `street/scripts/guard-shared-checkout.mjs` fronts `preinstall` and `build` in
# package.json AND hooks `vite.config.ts`, so it runs on `npm ci` and on every
# vite invocation. It exists to stop a Claude Code agent standing in its own
# worktree from mutating Erick's live checkout at :5177.
#
# A container is not that. It has no git repo, no worktree and none of the
# CLAUDE_* variables, so the guard's own three-fact test already fails open here
# — this is belt and braces, using the guard's own documented opt-out
# (`OVERRIDE = 'CT_ALLOW_SHARED'`) rather than editing or removing it. The guard
# is untouched and still bites where it was built to bite.
ENV CT_ALLOW_SHARED=1

WORKDIR /build

COPY street/package.json street/package-lock.json ./
# Playwright and vitest are dev dependencies of a 300 MB browser download that
# this image will never open. `--omit=dev` would also drop vite and typescript,
# which it does need — so `--ignore-scripts` instead: it keeps every package and
# skips playwright's postinstall, which is the only one that is expensive.
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY street/ ./

# ⚠ THE TYPECHECK IS A SEPARATE STEP ON PURPOSE, and it is the same one
# `.github/workflows/pages.yml` runs. `npx vite build` does not typecheck;
# `npm run build` does, but it also runs the guard wrapper. Split, so a failure
# says "tsc" and not "the container build broke".
#
# THIS IS THE MOST LIKELY WAY A DEPLOY FAILS. Several builders edit `street/src`
# at once, and a type error that is transient on a laptop is permanent in a
# commit — so `npx tsc --noEmit` in `street/` should be green before you push.
# It is not worked around here, and it must not be: shipping a build that does
# not typecheck is how the world reaches Erick broken.
RUN npx tsc --noEmit

# `vite build` and not `npm run build`, exactly as the Pages workflow does it.
# No `--base` here: this server mounts the game at the root, where Pages mounts
# it under /rpg/ and needs `--base=./`. That difference is the whole reason both
# can exist without either one configuring the other.
RUN npx vite build

# ══ stage 2: the server ════════════════════════════════════════════════════
FROM node:24-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server/ ./
COPY --from=game /build/dist ./public

# Where index.mjs looks for the built game. In a checkout it defaults to
# ../street/dist; the container lays it out flat, so say so.
ENV STATIC_DIR=/app/public

# Railway injects PORT and overrides this; the default is for `docker run -p`.
ENV PORT=8080
EXPOSE 8080

# node:* images ship a `node` user. Nothing here writes to disk under Postgres
# — the SQLite fallback would, and it is not what runs on Railway.
USER node

CMD ["node", "index.mjs"]
