// ── CROSSTOWN '97, SERVED ─────────────────────────────────────────────────
//
// One Node process that does what `erickfm/slasher`'s `server.py` does, in the
// language this project is already written in:
//
//   · serves the BUILT game out of `street/dist`
//   · serves a small JSON API at `/api/*` (see `api.mjs`)
//   · Postgres when `DATABASE_URL` is set, SQLite when it is not (see `db.mjs`)
//
// **Express, not Fastify.** The route table is five entries and the traffic is
// one save per player per thirty seconds, so throughput decides nothing. What
// does decide it: `app.get('/api/x', h)` and `express.static(dir)` are the same
// two shapes as Flask's `@app.route` and `static_folder`, so this file reads as
// a translation of the server he already wrote rather than as a new thing to
// learn. The boring choice is the right one for deploy plumbing.
//
// ── THIS DOES NOT REPLACE GITHUB PAGES ───────────────────────────────────
//
// Pages builds `street/` with `npx vite build --base=./` and uploads `dist/`
// (`.github/workflows/pages.yml`); `scripts/pack-artifact.mjs` inlines the same
// `dist/` into one HTML file. Neither of them runs this server, and nothing here
// changes either output. The game detects at runtime whether an API is in front
// of it and falls back to `localStorage` when there is not — so the Pages build
// and the artifact keep working exactly as they do today, with a local-only
// save. See `street/src/proto/ct/save.ts`.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { api } from './api.mjs';
import * as db from './db.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Railway injects PORT and it is not optional — bind what you are given.
const PORT = Number(process.env.PORT || 8080);

// Where the built game is. Overridable because the container lays it out
// differently from the checkout: in Docker the build stage copies `dist` to a
// fixed path, and here it is a sibling of the server directory.
const STATIC_DIR = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.resolve(HERE, '..', 'street', 'dist');

const app = express();
app.disable('x-powered-by');

app.use('/api', api());

// ── the game ──────────────────────────────────────────────────────────────
//
// Hashed asset filenames are immutable, so they are cached hard; `index.html`
// must never be, or a deploy ships new assets to a browser still holding the
// old document that names the old ones.
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, {
    index: false,
    setHeaders(res, file) {
      if (path.basename(file) === 'index.html') res.setHeader('Cache-Control', 'no-cache');
      else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));

  // Everything that is not an API call and not a file gets the game. One
  // document, one entry point — there is no router in the client to confuse
  // this with.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
} else {
  // LOUD, and not a 404. A container that shipped without the build step is the
  // failure this is most likely to hit, and "Cannot GET /" would send you
  // looking at routing instead of at the Dockerfile.
  const msg = `[serve] no build at ${STATIC_DIR} — run \`npm run build\` in street/ (or set STATIC_DIR)`;
  console.error(msg);
  app.get(/^(?!\/api\/).*/, (_req, res) => res.status(503).type('text/plain').send(msg));
}

const server = await start();

async function start() {
  try {
    await db.init();
    console.log(`[db] ${db.KIND} ready`);
  } catch (e) {
    // DO NOT EXIT. The game itself needs no database; only saving does. A dead
    // DB must degrade to "you can play, you cannot save", never to a site that
    // will not load — /api/health reports the truth either way.
    console.error(`[db] ${db.KIND} FAILED to initialise — saves will 500:`, e);
  }
  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`[serve] CROSSTOWN '97 on http://0.0.0.0:${PORT}  (static: ${STATIC_DIR})`);
  });
}

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => { db.close().finally(() => process.exit(0)); });
  });
}
