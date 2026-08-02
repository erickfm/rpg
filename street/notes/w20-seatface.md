# w20 — QUEUE item 22: the instrument that lied about seats

**Root cause, one line:** `seatface.mjs` filtered colliders to `|minX| < 500`
while the interior belt starts at x ~ 600, so it had never seen a single
interior wall or table — and separately, its `./lib/` import was never rewritten
when the file was moved into `scripts/probes/`, so it could not even load.

Port: **4190**. My assigned 4199 was held by pid 1780226; 4184–4199 were all
occupied except 4188 and 4190.

## What the item said, and what was actually true

The item said the file lives at `scripts/seatface.mjs`. It does not — it is
`scripts/probes/seatface.mjs`. That matters more than a stale path, because the
move is what broke it:

| | |
|---|---|
| item's claim | filters colliders to `\|minX\| < 500`, blind indoors |
| **also true, not in the item** | **it throws `ERR_MODULE_NOT_FOUND` on load and cannot run at all** — `import { reportWorld } from './lib/which-world.mjs'` was not rewritten to `../lib/` when it moved into `probes/` |

So the item's "it reported 222 of 228 seats look at open ground" describes
behaviour from *before* the move. In the tree as I found it the probe was dead
code. I fixed the import first, reproduced the lie exactly — **213 of 219 seats
"look at open ground for 6 m or more"** — and only then lifted the ceiling.

## What I changed

| file | |
|---|---|
| `scripts/probes/seatface.mjs` | import path `./lib/` → `../lib/`; collider filter `Math.abs(c.minX) < 500` → `isFinite(c.minZ)`, with a comment saying why the ceiling was wrong |
| `scripts/probes/seatface-agrees.mjs` | NEW. The agreement check the item's DONE WHEN asks for |

I chose **fix, not delete.** Deleting satisfies DONE WHEN too, but
`notes/AUDIT-INSTRUMENTS.md:1613` lists `seatface` among the ten scripts that
"carry a live finding or a live method", and that file's own rule is *"deleting a
script a note quotes would leave the note citing nothing"* — two notes quote it.
The method (march along the facing vector, report what you actually look at) is a
report, not a duplicate of `seat-facing.mjs`, which is a pass/fail check.

## The numbers, measured on build `71ff458a1`

| | with the ceiling | without |
|---|---|---|
| colliders seen | 239 | **514** (275 dropped by the ceiling) |
| seats "looking at open ground ≥ 6 m" | 213 of 219 | **32 of 219** |
| indoor seats disagreeing with `seat-facing.mjs` | **181 of 202** | **0** |

With the ceiling lifted the probe finally reports the interior belt — seats at
x = 675 (casino), 1076 (library reading table), 1084 — at 0.35 m from the table
they are sat at, which is what sitting at a table looks like.

## How it is proven, and that the proof can fail

`scripts/probes/seatface-agrees.mjs` fails three ways:

- **rule 0 — the source.** Rules 1 and 2 run a *copy* of seatface's march, so on
  their own they would stay green if somebody put the ceiling back in the file.
  That is the identical cannot-fail trap this item exists to remove, so rule 0
  reads `seatface.mjs` off disk and fails on any magnitude bound on a collider
  coordinate.
- **rule 1 — same collider set** as `seat-facing.mjs`.
- **rule 2 — per seat:** no indoor seat may read 6 m of open ground from
  seatface's march while `seat-facing.mjs` measures a wall or solid within 6 m.

**Mutation-tested both directions**, which is also how I caught two bugs in my
own check: re-adding the ceiling to `seatface.mjs` → exit 1, removing it →
exit 0. A green run additionally prints a WARNING if the ceiling would *not*
have changed the verdict, so it cannot pass vacuously on some future world.

The mutation run is what showed the failure message printing the bound as
`< 5` — the regex used `\d`, not `\d+`. Fixed. A check that misquotes the number
it caught is half a check.

**Copied, not derived (BUILDER-BRIEF §8):** both algorithms in the comparison
probe are copied with line-number citations, because neither script exports its
logic — each is a top-level runner with the algorithm inline in a page
`evaluate`. There is nothing to import without editing `seat-facing.mjs`, which
this item does not name. Follow-up queued below.

## Verification

- `seatface-agrees.mjs` — exit 0; mutant exit 1
- `seat-facing.mjs` — 219 of 219 seats green, unchanged before and after
- `node scripts/bugsweep.mjs` — 93 shots, **zero STATION MISS**, no console
  errors (only the pre-existing THREE.Clock / Canvas2D / WebGL warnings)
- No world source was touched, so there is nothing for `fp`/`fpdiff` to move —
  the whole change is two files under `scripts/probes/`.

## Found and NOT fixed — needs queueing

1. **288 of 406 probes are dead on load.** Not a guess: `grep` counts 288 files
   in `scripts/probes/` importing `from './lib/…'`, `scripts/probes/lib/` does
   not exist, and spot-runs of `alley.mjs` and others throw
   `ERR_MODULE_NOT_FOUND`. Before my two files, **zero** probes had the correct
   `../lib/` path — the bulk move into `probes/` rewrote no import. Breakdown:
   `which-world.mjs` 180, `frames.mjs` 111, `clock.mjs` 59, `reachable.mjs` 16,
   `args.mjs` 5, `modes.mjs` 4. It is one `sed` over the directory plus a run to
   confirm, but it is 288 files this item does not name. **A whole directory of
   instruments that exits non-zero the moment anyone runs it is how the next
   `seatface` goes unnoticed.**

2. **Hoist the shared seat geometry into `scripts/lib/`.** `seat-facing.mjs` and
   `seatface.mjs` both inline the collider filter, `roomOf`/`roomDims`, and the
   facing march, and my comparison probe now holds a third copy. §8 says derive,
   never retype; a shared `scripts/lib/seatgeom.mjs` would delete all three.

3. **`seatface.mjs` defaults to `SHOT_URL ?? 'http://localhost:4184/'`** —
   somebody else's world, and 4184 was live while I worked. Harmless with
   `SHOT_URL` set, but it is GOTCHAS 48 lying in wait. Most probes do this.

4. **Item 22's stated path is wrong** (`scripts/seatface.mjs` vs
   `scripts/probes/seatface.mjs`). Worth the desk checking whether other open
   items inherited paths from before the `probes/` move.
