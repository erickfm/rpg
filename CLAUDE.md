# rpg — CROSSTOWN '97

**New here, or working with no memory of this project? Read
`street/START-HERE.md` first.** It assumes zero context and links everything
else in reading order.

## The essentials

- **`street/START-HERE.md`** — cold start: what this is, which agent you are,
  first five minutes, how to bring the whole rig up.
- **`street/notes/GOTCHAS.md`** — landmines that have each cost hours. Unseeded
  `Math.random` in the paint layer, the single seeded `rnd()` whose call order
  is load-bearing, billboards vs ground decals, 1–2 texel faces, the apartment
  floor-picker. **Read before your first change.**
- **`street/notes/OWNERSHIP.md`** — one file, one owner. Almost every merge
  conflict here came from editing a file you do not own.
- **`street/PARALLEL-WORKFLOW.md`** — how the multi-agent process works: desk +
  builders, queues, briefs, merge protocol, and a retrospective on what to fix
  next. A living doc; update it as we learn.
- **`street/FEATURE-REQUESTS.md`** — every playtest request in the user's own
  words. New requests land here immediately.

## Working agreements

Log every user request to `street/FEATURE-REQUESTS.md`, and **say which agent it
was routed to** when you reply — the user cannot reprioritise a queue he cannot
see.

Builders take tasks from `street/notes/queues/<agent>.md`. The desk writes those
files; builders only read them, and report completion in a handoff note under
`street/notes/`.

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
| `./scripts/queues.sh` | every agent's task, queue depth, git state |
| `./scripts/land.sh [--dry]` | merge train: rebase + merge every green builder |
| `./scripts/ownership.sh <agent>` | are your edits inside your boundaries |
| `npm run sweep` | 48-shot world sweep, reports console errors |
| `node scripts/health.mjs` | does the world actually initialise |
