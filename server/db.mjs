// ── THE DATABASE, TWO DRIVERS, ONE INTERFACE ──────────────────────────────
//
// Lifted, deliberately, from Erick's own `erickfm/slasher` `server.py`, because
// it is proven and he already understands its shape:
//
//   · `DATABASE_URL` set   -> Postgres (that is Railway)
//   · `DATABASE_URL` unset -> SQLite in a local file (that is your laptop)
//   · Railway hands out `postgres://`; `pg` and everything else want
//     `postgresql://`. Normalise it here, once, exactly as slasher does.
//
// The one thing that is NOT lifted is slasher's language and its eight tables.
// This is Node, and the save is ONE JSONB blob per player — see `api.mjs` and
// `street/src/proto/ct/save.ts` for why. Two tables total.
//
// ⚠ SQLITE IS NOT A SECOND SOURCE OF TRUTH. It exists so that `npm start` works
// on a fresh checkout with no services running and no environment set. Anything
// you rely on surviving lives in Postgres.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Railway may provide postgres:// instead of postgresql:// — slasher normalises
// exactly this and it is the single most common way this deploy breaks.
let DATABASE_URL = process.env.DATABASE_URL || '';
if (DATABASE_URL.startsWith('postgres://')) {
  DATABASE_URL = 'postgresql://' + DATABASE_URL.slice('postgres://'.length);
}

export const USE_PG = Boolean(DATABASE_URL);
export const KIND = USE_PG ? 'postgres' : 'sqlite';

// ── postgres ──────────────────────────────────────────────────────────────

let pool = null;

async function pgPool() {
  if (pool) return pool;
  const { default: pg } = await import('pg');
  pool = new pg.Pool({
    connectionString: DATABASE_URL,
    // Railway's internal network needs no TLS; its public proxy hands out a
    // certificate that does not chain to a root Node ships with. Both of those
    // are the same one-line answer, and it is the answer slasher's psycopg2
    // default also lands on.
    ssl: /\bsslmode=require\b/.test(DATABASE_URL) ? { rejectUnauthorized: false } : false,
    max: 5,
  });
  return pool;
}

// ── sqlite ────────────────────────────────────────────────────────────────
//
// `node:sqlite` is in the standard library from Node 22.5 and needs no flag
// from 23.4 — so "zero-config locally" means genuinely zero: no npm package, no
// native build, no service. That is the whole reason it is preferred here over
// better-sqlite3.

let sq = null;

function sqlite() {
  if (sq) return sq;
  const file = process.env.SQLITE_PATH || path.join(HERE, 'crosstown.db');
  sq = new DatabaseSync(file);
  sq.exec('PRAGMA journal_mode = WAL');
  return sq;
}

// ── schema ────────────────────────────────────────────────────────────────
//
// TWO TABLES.
//
//   users  — a username and nothing else, which is slasher's identity model
//            verbatim. See `api.mjs` for why that is the right MVP here.
//   saves  — ONE ROW PER PLAYER holding ONE JSON DOCUMENT.
//
// The save is a document and not a schema on purpose. CROSSTOWN's state is
// still being invented — the bag became a view of the purse the same week this
// was written — and a column per field would mean a migration every time a
// builder adds a flag. `slices` inside the blob is where new state goes, and
// adding one costs nobody a deploy.

export async function init() {
  if (USE_PG) {
    const p = await pgPool();
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
    await p.query(`
      CREATE TABLE IF NOT EXISTS saves (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        blob JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`);
  } else {
    const d = sqlite();
    d.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    d.exec(`
      CREATE TABLE IF NOT EXISTS saves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        blob TEXT NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
  }
}

// ── the four verbs the API needs ──────────────────────────────────────────

/** Create the user if they are new; return `{ id, existing }` either way.
 *  No password: see `api.mjs`. */
export async function upsertUser(username) {
  if (USE_PG) {
    const p = await pgPool();
    const found = await p.query('SELECT id FROM users WHERE username = $1', [username]);
    if (found.rows.length) return { id: found.rows[0].id, existing: true };
    const made = await p.query(
      'INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username RETURNING id',
      [username],
    );
    return { id: made.rows[0].id, existing: false };
  }
  const d = sqlite();
  const found = d.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (found) return { id: found.id, existing: true };
  const made = d.prepare('INSERT INTO users (username) VALUES (?)').run(username);
  return { id: Number(made.lastInsertRowid), existing: false };
}

/** The player's save document, or null if they have never saved. */
export async function getSave(username) {
  if (USE_PG) {
    const p = await pgPool();
    const r = await p.query(
      `SELECT s.blob, s.updated_at FROM saves s
         JOIN users u ON u.id = s.user_id
        WHERE u.username = $1`,
      [username],
    );
    if (!r.rows.length) return null;
    // node-postgres parses JSONB for us; a TEXT column would not be parsed.
    return { save: r.rows[0].blob, updatedAt: String(r.rows[0].updated_at) };
  }
  const d = sqlite();
  const row = d.prepare(
    `SELECT s.blob AS blob, s.updated_at AS updated_at FROM saves s
       JOIN users u ON u.id = s.user_id
      WHERE u.username = ?`,
  ).get(username);
  if (!row) return null;
  let save = null;
  try { save = JSON.parse(row.blob); } catch { save = null; }
  return { save, updatedAt: String(row.updated_at) };
}

/** Write the player's save, creating the user if they are new. */
export async function putSave(username, blob) {
  const { id } = await upsertUser(username);
  const json = JSON.stringify(blob);
  if (USE_PG) {
    const p = await pgPool();
    const r = await p.query(
      `INSERT INTO saves (user_id, blob, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (user_id) DO UPDATE
            SET blob = EXCLUDED.blob, updated_at = NOW()
       RETURNING updated_at`,
      [id, json],
    );
    return { updatedAt: String(r.rows[0].updated_at) };
  }
  const d = sqlite();
  d.prepare(
    `INSERT INTO saves (user_id, blob, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
          SET blob = excluded.blob, updated_at = CURRENT_TIMESTAMP`,
  ).run(id, json);
  const row = d.prepare('SELECT updated_at FROM saves WHERE user_id = ?').get(id);
  return { updatedAt: String(row.updated_at) };
}

/** Cheap liveness probe, so `/api/health` reports the DB and not just the web
 *  process. A container that boots with a bad `DATABASE_URL` looks perfectly
 *  healthy until the first player tries to save; this is how you find out. */
export async function ping() {
  if (USE_PG) { const p = await pgPool(); await p.query('SELECT 1'); return true; }
  sqlite().prepare('SELECT 1').get();
  return true;
}

export async function close() {
  if (pool) { await pool.end(); pool = null; }
  if (sq) { sq.close(); sq = null; }
}
