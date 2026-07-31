# Start here

You are an agent working on **CROSSTOWN '97**. Assume you have no memory of this
project. This page gets you productive; everything else is linked from it.

**There are only four documents you need.** Everything else is history.

| | | |
|---|---|---|
| **notes/SESSION-STATE.md** | **read first** | where the project stands *right now* — what is unfinished, who has it |
| **START-HERE.md** | you are here | orientation + how to run things |
| **notes/GOTCHAS.md** | 120 lines | landmines. read before your first change |
| **notes/OWNERSHIP.md** | 53 lines | which files are yours |
| **notes/queues/\<you\>.md** | short | your actual tasks — but **unticked boxes ≠ open work**, most queues were never ticked off. The ledger says whether, the queue says how |
| **notes/CITIZEN-STYLE.md** | read before drawing ANY person | the 8-angle atlas, with examples |

Two more exist as **reference**, not reading: `PARALLEL-WORKFLOW.md` (the
multi-agent process, look things up in it) and `FEATURE-REQUESTS.md` (every
request in the user's own words). `notes/archive/` is finished handoff notes —
open one only when you are about to touch the area it describes.

---

## What this is

A small, **hand-authored** 3D city street in the browser — Three.js, TypeScript,
Vite. One block, a side street, an alley, a walk-up you can go inside, a bodega
you can buy from. Everything is painted at ~8 px/m as pixel textures on simple
geometry. 1997, muted palette, deliberately low-tech.

It is **not** procedural. Every building is placed by hand and means something.
The whole value of the project is that it looks made, not generated — so
consistency of style matters more than any individual feature.

The user playtests it constantly and gives feedback in screenshots. Most
requests are **judgements** ("that looks wrong"), not specifications.

---

## Which agent are you?

**Read `notes/OWNERSHIP.md` first.** One file, one owner. Editing a file you do
not own is what causes almost every merge conflict here.

- **The desk** — the session the user talks to. Triages every request, routes
  it, owns the merge queue, does small changes itself, and keeps the live world
  healthy. If nobody told you otherwise, you are probably a builder.
- **A builder** — you work in a git worktree (`../rpg-<topic>`) on your own
  branch. Your tasks are in `notes/queues/<you>.md`. The desk writes that file;
  **you only read it.**
- **An auditor** — read-only. You produce a report, you do not edit `src/`.

---

## First five minutes

```bash
cd street
npm run build                 # tsc --noEmit && vite build — must be clean
cat notes/queues/<you>.md     # your queue: take the top item under ## Now
./scripts/ownership.sh <you>  # are you inside your boundaries?
```

Then read, in this order:

1. **`notes/GOTCHAS.md`** — landmines that have each cost hours. Not optional.
2. **`notes/queues/<you>.md`** — your tasks, with links to the user's screenshots.

That is enough to start. Reach for `PARALLEL-WORKFLOW.md` when you need the
process (§12 how feedback is given, §15 what we would fix next), and
`notes/archive/` when you want to know why an area looks the way it does.

---

## Working rules

**Verify by walking, not by looking.** Screenshots prove almost nothing here —
see `GOTCHAS.md` §1. For a change that should not alter the world, fingerprint
it. For anything involving movement or collision, actually drive the player.

**Commit after each queue item**, not at the end. Uncommitted work is invisible
to the user: the live world integrates committed and uncommitted state, but a
broken tree gets dropped entirely.

**Never edit another agent's file to unbreak your own change.** If you change a
shared module's signature and it breaks a caller you do not own, STOP and tell
the desk. That drive-by fix is what conflicts at merge — it happened three times
in one day.

**Two failures, then delete.** If a detail has been redrawn twice and still
misses, remove it and say so in your handoff.

**Match the house style.** Before drawing anything new, read the nearest
comparable thing and copy its texel density, palette and shading conventions.

---

## Bringing the whole rig up from cold

```bash
# 1. the live integration world — what the user actually plays
git worktree add ../rpg-live live
ln -sfn "$PWD/node_modules" ../rpg-live/street/node_modules
(cd ../rpg-live/street && npx vite --port 5177 --host &)
while true; do ./scripts/live-integrate.sh; sleep 15; done &

# 2. a builder — use the script, do not do this by hand
scripts/builder.sh <topic> feat/<topic> 4178 "You are builder X. Read ..."
```

`scripts/builder.sh` exists because standing one up by hand went wrong twice in
one session: once launched in `acceptEdits` rather than `auto`, so every agent
stalled on a permission dialog and the desk became a permission-clicking
bottleneck; and once with the brief typed into the prompt but never submitted,
so eight agents sat idle while the desk reported them as working. The script
forces auto mode, sends the text and the Enter separately, and then checks the
prompt is actually empty before claiming success.

`scripts/live-integrate.sh` rebuilds a throwaway `live` branch every 15 s as
*mainline + every worktree's current state*, including uncommitted edits. It
typechecks the result and **drops any builder that breaks the build**, so one
agent mid-edit cannot take down the world the user is playing.

---

## The commands you will actually use

| | |
|---|---|
| `./scripts/desk.sh` | **the desk's one command** — who is idle, what is unlanded, which queues are stale |
| `./scripts/desk.sh --land` | the same, then run the merge train |
| `./scripts/queues.sh` | every agent's task and queue depth |
| `./scripts/land.sh --dry` | what would merge right now |
| `./scripts/land.sh` | the merge train — rebase + merge every green builder |
| `./scripts/ownership.sh <you>` | are your edits inside your boundaries |
| `npm run fp <label>` / `npm run fpdiff a b` | structural fingerprint |
| `npm run sweep` | 48-shot world sweep, reports console errors |
| `node scripts/health.mjs` | does the world actually initialise |

Ports: **5177** live world · **4178+** per builder · never share one.

---

## If something is broken

- **World not loading** → `node scripts/health.mjs`. If `__ct` never appears, a
  builder is mid-edit or a worktree lost its `node_modules` symlink.
- **Your work isn't visible** → you are probably being dropped for a broken
  build. `npx tsc --noEmit` in your worktree.
- **Merge conflict** → you likely edited a file you do not own. Check
  `notes/OWNERSHIP.md`; the owner resolves, not you.
