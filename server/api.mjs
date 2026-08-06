// ── THE JSON API ──────────────────────────────────────────────────────────
//
// Five routes. Nothing here knows what is inside a save — that is the client's
// business (`street/src/proto/ct/save.ts`), and keeping the server ignorant of
// it is what lets a builder add saved state without touching the deploy.
//
//   GET  /api/health              is the world up, and which DB is behind it
//   POST /api/users               { username }        -> { id, username, existing }
//   GET  /api/saves/:username     -> { username, save, updatedAt } | 404
//   PUT  /api/saves/:username     { save }            -> { ok, updatedAt }
//   POST /api/saves/:username     same as PUT, for `navigator.sendBeacon`
//
// ── IDENTITY: A USERNAME, NO PASSWORD ────────────────────────────────────
//
// This is slasher's model, unchanged, and it is deliberate rather than lazy.
// The thing being protected is a single-player 1997 street: the worst case is
// that someone types your name and walks around your flat. Against that, a
// password costs a reset flow, a hash, a session store and a login screen in
// front of a game whose whole pitch is that you press a key and you are
// standing on the pavement. Erick has shipped exactly this before.
//
// **What to add the day it stops being true** (a leaderboard, anything social,
// anything a stranger would want to be at the top of): a signed cookie holding
// the username, issued at `POST /api/users`, and checked on the save routes. The
// blob shape does not change; only who is allowed to PUT one does.

import express from 'express';
import * as db from './db.mjs';

// ── what a username may be ────────────────────────────────────────────────
//
// Slasher checks length only. This also checks the CHARSET, because unlike
// slasher's the name lands in a URL path (`/api/saves/:username`) — a name with
// a slash or a `..` in it is a routing question you should never have to think
// about. Letters, digits, space, `_` and `-`, 1–20 characters.
const NAME_OK = /^[A-Za-z0-9 _-]{1,20}$/;

/** Bytes of JSON one player is allowed to store. A save is a few kB; this is
 *  three orders of magnitude of headroom and still bounds what one bad actor
 *  can push into the database. */
const MAX_SAVE_BYTES = 256 * 1024;

function cleanName(raw) {
  const name = String(raw ?? '').trim();
  if (!NAME_OK.test(name)) return null;
  return name;
}

export function api() {
  const r = express.Router();

  // A save is JSON and nothing else. The limit is enforced here as well as
  // below so that an oversized body is refused before it is parsed.
  r.use(express.json({ limit: MAX_SAVE_BYTES, type: ['application/json', 'text/plain'] }));

  r.get('/health', async (_req, res) => {
    try {
      await db.ping();
      res.json({ ok: true, db: db.KIND });
    } catch (e) {
      // 503, not 500: the process is fine, its database is not, and a platform
      // health check should be able to tell those apart.
      res.status(503).json({ ok: false, db: db.KIND, error: String(e && e.message || e) });
    }
  });

  r.post('/users', async (req, res) => {
    const username = cleanName(req.body?.username);
    if (!username) return res.status(400).json({ error: 'Username must be 1-20 characters: letters, digits, space, _ or -' });
    try {
      const { id, existing } = await db.upsertUser(username);
      res.status(existing ? 200 : 201).json({ id, username, existing });
    } catch (e) { fail(res, e); }
  });

  r.get('/saves/:username', async (req, res) => {
    const username = cleanName(req.params.username);
    if (!username) return res.status(400).json({ error: 'Bad username' });
    try {
      const got = await db.getSave(username);
      // 404 is the RIGHT answer for a new player and the client treats it as
      // "start a fresh world", not as an error. Returning 200 with a null save
      // would make "never played" and "played and saved nothing" the same
      // answer, and they are not.
      if (!got) return res.status(404).json({ error: 'No save for that player', username });
      res.json({ username, save: got.save, updatedAt: got.updatedAt });
    } catch (e) { fail(res, e); }
  });

  const write = async (req, res) => {
    const username = cleanName(req.params.username);
    if (!username) return res.status(400).json({ error: 'Bad username' });
    const save = req.body?.save;
    if (save === null || typeof save !== 'object' || Array.isArray(save)) {
      return res.status(400).json({ error: 'Body must be { save: <object> }' });
    }
    let bytes;
    try { bytes = Buffer.byteLength(JSON.stringify(save)); }
    catch { return res.status(400).json({ error: 'Save is not serialisable' }); }
    if (bytes > MAX_SAVE_BYTES) return res.status(413).json({ error: `Save is ${bytes} bytes, limit ${MAX_SAVE_BYTES}` });
    try {
      const { updatedAt } = await db.putSave(username, save);
      res.json({ ok: true, username, bytes, updatedAt });
    } catch (e) { fail(res, e); }
  };

  r.put('/saves/:username', write);
  // `navigator.sendBeacon` can only POST, and the last save of a session — the
  // one fired as the tab closes — is the one that most needs to land. Same
  // handler; an upsert is idempotent so the verb carries no meaning here.
  r.post('/saves/:username', write);

  return r;
}

function fail(res, e) {
  // Log the real error, return a flat one. A Postgres error string can name the
  // host, the database and the role.
  console.error('[api]', e);
  res.status(500).json({ error: 'Server error' });
}
