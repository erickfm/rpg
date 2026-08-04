# rpg — CROSSTOWN '97

**New here, or working with no memory of this project? This file is the whole
orientation.** There is no second door — `START-HERE.md` was deleted on
2026-08-03 because it duplicated this file, had gone stale, and still told every
new agent *"Read `notes/OWNERSHIP.md` first. One file, one owner"*, which is
exactly the advice that cost a worker three items in eleven minutes.

## The two documents

**`street/notes/QUEUE.md`** — the one ranked list of work, and the only statement
of where things stand. Take the top item with `./scripts/claim.sh <name>`, finish
it, `./scripts/done.sh <name> "..."`, claim again. Nobody waits to be told what is
next.

**`street/notes/GOTCHAS.md`** — landmines. **Reference, not a read-through.** Read
its ranked index (the fourteen that actually bite, and the section above them on
checks that go green without measuring); search the rest when you touch that area.

Everything else is looked up, never read: `street/FEATURE-REQUESTS.md` is every
request in the user's own words and is the spine — items come from it, and it stays
true when summaries rot. `street/notes/BUILDER-BRIEF.md` is the how-to.
This file orients a cold start.

**Deleted 2026-08-03, and not coming back** (git history holds all of it):
`SESSION-STATE.md`, `LEDGER.md` and `STATUS.md` were three hand-maintained
descriptions of where things stand, sitting beside a QUEUE.md that is maintained by
scripts — four sources of truth for one fact means three are lying at any moment.
`OWNERSHIP.md` was a permission list this file already warned you never to obey,
after it cost a worker three items in eleven minutes. `notes/status/` named agents
that had not run in weeks. `notes/archive/` was 559 files and 78,879 lines — larger
than the world itself — hand-copying what git already stores.

## Working agreements

Log every user request to `street/FEATURE-REQUESTS.md`, and **say which agent it
was routed to** when you reply — the user cannot reprioritise a queue he cannot
see.

**IF THE QUEUE HAS UNCLAIMED WORK, WORKERS ARE RUNNING. ALWAYS.** The user's
standing instruction, 2026-08-01: *"if there is a queue there should be workers
working. always."* An idle queue with idle workers is the desk failing, not the
fleet resting. The desk's first act on any tick is to check
`grep -c '| TODO' street/notes/QUEUE.md` and spawn up to the cap if it is
non-zero. Workers are only absent when the queue is genuinely empty.

**Builders are self-serving: they take the top item from `street/notes/QUEUE.md`,
finish it, release it, and take the next.** The desk ranks the queue and verifies
what comes back; it does not hand out work item by item. A builder that runs out
of queue says so and stops — it does not invent work.

**THE DESK RANKS AND VERIFIES. IT DOES NOT DIAGNOSE.** Measured over the 35 items
of 2026-08-01: the desk's stated cause was wrong on 6, and a builder caught it 6
times out of 6. The three longest cycles on the board were all "the brief was
wrong and the builder had to work backwards first" — not hard work, bad dispatch.
So an item ships **the symptom, the user's words verbatim, the screenshot path,
and a "done when" line a script can fail** — never a guessed cause or a guessed
filename. Every item that landed with no follow-up had a check that could fail;
every item that needed follow-up was a symptom plus a guess.

`claim.sh` and `done.sh` lock the file, so two builders can never hold the same
item. **A builder never confirms its own work**: `done.sh` marks DONE, and the
desk checks it against the source before the row is believed. Every agent this
week has made at least one claim that did not survive that check.

**ONE AGENT IN THE TRUNK. EVER.** `src/proto/fp.ts`, `src/proto/crosstown.ts` and
the spot picker are where every room meets — one player body, one selection
predicate, one collision system. **A file lock cannot help here: it stops two
builders double-CLAIMING, not two changes colliding in the same predicate.** On
2026-08-03 the calendar fix broke the door and the door fix broke the calendar,
both in that trunk, and the agent cap did nothing about either. Rooms, props and
interiors parallelise freely — the trunk never does.

**At most 5 agents at once**, and only on leaf work. A sixteen-agent run exhausted
the account's usage on 2026-07-30 and took the whole fleet down. An agent exists
only while it holds an item; when the queue empties it is shut down, not parked.

**Screenshots are for LOOKING, never for PROVING.** Two runs of identical code
differ ~20% of pixels. To prove a change didn't move the world:
`npm run fp before` → change → `npm run fp after` → `npm run fpdiff`. Textures
and structure must match; 4–6 pigeons drifting is the noise floor.

**BUT `fp` IS A PURE-REFACTOR TOOL ONLY.** `scenedump.mjs` seeds `Math.random`
globally, and three draws random UUIDs per mesh — so **adding or removing any
geometry shifts the stream and repaints every dithered texture after it**. One
builder saw 294 of 1461 textures differ on a change that moved nothing. If your
change adds a mesh, this recipe reports a catastrophe that is not there; compare
`places` as a multiset instead (`scripts/probes/w44-placediff.mjs`).

Anything involving movement, collision or floors must be verified by **actually
walking it**, not from a screenshot. The 2 m sidewalk lane is sacred.

## Running it

The user playtests **http://localhost:5177/**, and as of 2026-08-03 that is a
plain `vite` DEV server on the main checkout — it serves `src/` directly with hot
reload, so **it always shows mainline and is never stale.** `dist/` has nothing to
do with it; do not "refresh" it by building.

**It is NOT the integration world this section used to describe, and
`live-integrate.sh` is not driving it.** That script reads three hardcoded
worktrees — `rpg-ground`, `rpg-entrance`, `rpg-alley` — **all three deleted** — is
blind to every `.claude/worktrees/agent-*` worker, and writes to `rpg-live`, which
nothing serves. Do not trust it to show you a builder's in-flight work. If you want
that, look at the builder's own port.

Builders use their own ports (4178+); never share one. **Kill your preview when you
finish** — 33 orphaned vite servers were found still listening on 2026-08-03,
belonging to workers whose worktrees had been deleted hours earlier.

There is also a published artifact and a GitHub Pages deploy
(https://erickfm.github.io/rpg/, auto-deploys on push). Republish the artifact
with `cd street && npm run build && node scripts/pack-artifact.mjs`, then publish
`street/dist/artifact.html` to the existing artifact URL.

## Commands

| | |
|---|---|
| `./scripts/desk.sh` | **run this first** — who is idle, what is unlanded, which queues are stale |
| `./scripts/queues.sh` | every agent's task, queue depth, git state |
| `./scripts/land.sh [--dry]` | merge train: rebase + merge every green builder |
| `./scripts/ownership.sh <agent>` | are your edits inside your boundaries |
| `npm run sweep` | 48-shot world sweep, reports console errors |
| `node scripts/health.mjs` | does the world actually initialise. **Three statuses:** `0` initialised, `1` measured and broken, `3` nothing measured. That last one matters — for months this check printed `WORLD BROKEN` and exited 0, so a dead world scored green; and the naive repair (`exit 1` on failure) would have sent a builder who simply forgot to start a preview to go looking at their own code. Fixed 2026-08-02, with a `health-dead` mutation case behind it |
