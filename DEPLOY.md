# CROSSTOWN '97 on Railway

*"next i think i want to try to get this on railway. for other people to play.
for that ill need to try to build a db of sorts."* — 2026-08-05

Everything is built and nothing has been linked or deployed: **the Railway
account is Erick's and creating a project on it is his call.** This is the
sequence.

---

## What is here

| | |
|---|---|
| `server/index.mjs` | Express. Serves `street/dist` and mounts `/api`. |
| `server/api.mjs` | Five JSON routes. Identity is a username, no password. |
| `server/db.mjs` | **Postgres when `DATABASE_URL` is set, SQLite when it is not** — `erickfm/slasher`'s pattern, including the `postgres://` → `postgresql://` fix Railway makes you do. |
| `street/src/proto/ct/save.ts` | The client. A slice registry, one JSON document per player, autosave. |
| `Dockerfile` | Two stages: build the game, then carry `dist` + the server. |
| `railway.json` | Tells Railway to use the Dockerfile, and where the health check is. |

Nothing about **GitHub Pages** or the **single-file artifact** changed. Both
still work and both still have no server behind them — `ct/save.ts` probes for
an API and falls back to `localStorage`, which is what the wardrobe already did.

---

## ⚠ Prerequisite: push

**190 commits are unpushed on `add-stick-and-city98`.** Railway builds from a
GitHub branch, so nothing below deploys the work you are looking at until this
has happened, and it is your call and not a builder's:

```bash
git push origin add-stick-and-city98
```

That push also fires the existing Pages workflow, which already watches this
branch (`.github/workflows/pages.yml`).

---

## Link and deploy

The CLI is installed (5.30.4) and you are logged in as efm.physics@gmail.com.
Run all of this from the repo root, `/home/erick/projects/rpg`.

```bash
# 1. a project
railway init --name crosstown97

# 2. a database. This creates a Postgres service that publishes its own
#    DATABASE_URL — the app does not get it automatically, see step 4.
railway add --database postgres

# 3. the game service, wired to the repo and the branch, so a push deploys
railway add --service crosstown --repo erickfm/rpg --branch add-stick-and-city98

# 4. ⚠ THE STEP THAT IS EASY TO MISS. Point the app at the database. This is a
#    reference, braces and all — Railway resolves it at deploy time, and the
#    URL never lands in the repo or in a shell history.
railway variables --service crosstown --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}'

# 5. a public URL
railway domain --service crosstown

# 6. watch the build, then open it
railway logs --service crosstown
railway open
```

To try it **without** GitHub first — a direct upload of the working tree, which
skips step 3 and does not need the push:

```bash
railway init --name crosstown97
railway add --database postgres
railway variables --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}'
railway up
```

### Confirming it

```bash
curl https://<your-domain>/api/health
# {"ok":true,"db":{"kind":"postgres","ok":true}}
```

`ok` is about the **server**; `db.ok` is about the **database**. The health
check returns 200 either way on purpose — a bad `DATABASE_URL` must not take the
street off the internet, because the game needs no database and only *saving*
does. If `db.ok` is `false`, step 4 did not happen.

---

## Running it locally

No Docker, no Postgres, no environment:

```bash
cd street && npx vite build          # writes street/dist
cd ../server && npm install && npm start
# → http://localhost:8080, SQLite in server/crosstown.db (gitignored)
```

`npm run dev` on :5177 is unaffected and is still the way to build. This server
only matters when you want the save API in front of the game.

---

## The API

| | |
|---|---|
| `GET /api/health` | `{ ok, db: { kind, ok } }` |
| `POST /api/users` | `{ username }` → `{ id, username, existing }` |
| `GET /api/saves/:username` | `{ username, save, updatedAt }`, or **404 for a new player** |
| `PUT /api/saves/:username` | `{ save }` → `{ ok, bytes, updatedAt }` |
| `POST /api/saves/:username` | the same, for `navigator.sendBeacon` — a beacon can only POST, and the save fired as the tab closes is the one that most needs to land |

Usernames are 1–20 of `A-Za-z0-9`, space, `_`, `-`. Saves are capped at 256 kB.

### Identity

**A username and no password**, which is slasher's model unchanged. The thing
being protected is a single-player 1997 street and the worst case is that
somebody types your name and walks around your flat; against that, a password
costs a login screen in front of a game whose pitch is that you press a key and
you are standing on the pavement.

You are asked once per browser, and only when a server answered — so the Pages
build and the artifact never show a dialog. `?player=NAME` in the URL overrides
it, which is how you get a second character.

**When that stops being enough** (a leaderboard, anything social, anything a
stranger would want to be top of): a signed cookie holding the username, issued
at `POST /api/users` and checked on the save routes. The save format does not
change; only who may write one does.

---

## The save

One JSON document per player, one row, one `JSONB` column:

```json
{ "v": 1, "at": 1754441234567, "slices": { "clock": {...}, "purse": {...} } }
```

A document and not a schema because CROSSTOWN's state is still being invented —
the bag stopped being a container and became a *view* of the purse the same week
this was written. A column per field would mean a migration every time a builder
adds a flag; a slice costs two lines in the module that owns the state and no
deploy at all.

**Saved today:** the clock (and therefore the date, the season, the year), the
purse (cash, bank balance, card, PIN, pockets and bag), the dresser drawer, and
what he is wearing.

**Not saved yet**, with the reason and the fix, is listed at the bottom of
`street/src/proto/ct/save.ts`. The big one is `ct/tenancy.ts` — rent paid and
arrears — because `paidPeriods` is a closure local with no setter, and the file
was held by another builder while this was written.

Autosave runs **every 10 seconds, and only when something changed**, plus once
as the tab goes away via `sendBeacon`. Per frame would be sixty writes a second
for a world that changes when you press a key; on-unload-only loses a session to
a crash, a killed tab or a closed lid.

---

## Two things that will bite

**`street/package.json` has a shared-checkout guard.**
`scripts/guard-shared-checkout.mjs` fronts `preinstall` and `build` and also
hooks `vite.config.ts`, so it runs on `npm ci` and on every vite invocation. It
refuses only on a positive determination of three facts — main checkout, Claude
shell, travelled out of a worktree — and a container has no git repo and none of
those variables, so it already fails open there. The Dockerfile sets
`CT_ALLOW_SHARED=1` anyway, using the guard's own documented opt-out rather than
editing it. **The guard is unchanged and still bites where it was built to.**

**The typecheck is the most likely way a deploy fails.** The Dockerfile runs
`npx tsc --noEmit` before `npx vite build`, the same split the Pages workflow
uses. Several builders edit `street/src` at once, and a type error that is
transient on a laptop is permanent in a commit. Run it before you push:

```bash
cd street && npx tsc --noEmit
```

It is deliberately **not** worked around. Shipping a build that does not
typecheck is how the world reaches players broken.
