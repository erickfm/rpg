# rpg — CROSSTOWN '97

**New here, or working with no memory of this project? Read
`street/START-HERE.md` first.** It assumes zero context and links everything
else in reading order.

## The four documents

Read these; everything else is history or reference.

0. **`street/notes/SESSION-STATE.md`** — **read this first, always.** What is
   unfinished right now and who has it. Everything below is how the project
   works; this is where it currently stands
1. **`street/START-HERE.md`** — orientation, which agent you are, how to run things
2. **`street/notes/GOTCHAS.md`** — landmines. Read before your first change
3. **`street/notes/OWNERSHIP.md`** — which files are yours
4. **`street/notes/queues/<agent>.md`** — your actual tasks. **Unticked boxes do
   NOT mean open work** — most queues were never ticked off. The ledger says
   whether; the queue only says how

Reference, for looking things up rather than reading: `street/PARALLEL-WORKFLOW.md`
(the multi-agent process) and `street/FEATURE-REQUESTS.md` (every request in the
user's own words). `street/notes/archive/` holds finished handoff notes — open
one only when touching the area it describes.

## Working agreements

Log every user request to `street/FEATURE-REQUESTS.md`, and **say which agent it
was routed to** when you reply — the user cannot reprioritise a queue he cannot
see.

Builders take tasks from `street/notes/queues/<agent>.md`. The desk writes those
files; builders only read them, and report completion in a handoff note under
`street/notes/`.

**At most 5 agents run at once — normally 3 builders + 1 auditor.** A
sixteen-agent run exhausted the account's usage on 2026-07-30 and took the whole
fleet down. An agent exists only while it holds an item; when its queue empties
it gets shut down, not parked. `street/PARALLEL-WORKFLOW.md` §10 is binding.

**Screenshots are for LOOKING, never for PROVING.** Two runs of identical code
differ ~20% of pixels. To prove a change didn't move the world:
`npm run fp before` → change → `npm run fp after` → `npm run fpdiff`. Textures
and structure must match; 4–6 pigeons drifting is the noise floor.

Anything involving movement, collision or floors must be verified by **actually
walking it**, not from a screenshot. The 2 m sidewalk lane is sacred.

## Running it

The user playtests **the live integration world at http://localhost:5177/** —
mainline plus every builder's in-flight work, rebuilt every 15 s by
`street/scripts/live-integrate.sh`, which drops any builder that breaks the
build. Builders use their own ports (4178+); never share one.

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
| `node scripts/health.mjs` | does the world actually initialise |
