# w34 — item 67: two instrument faults in the chamfer walk

**Port used: 4186** (proved free with `curl` → `000` before starting; dev server,
`npx vite --port 4186 --strictPort`). Shut down at end of session.

**File:** `scripts/probes/w24-chamfer-walk.mjs` — note the item named it as
`scripts/w24-chamfer-walk.mjs`; it has always lived in `scripts/probes/`.
Nothing else was wrong with the item.

## Root cause, one line

Both faults were the instrument, not the world: it never chose the port it
measured, and it ended its two walking legs on a wall clock in a simulation
whose `dt` is clamped, so it reported frame rate as distance.

## 1. The unaimed port

Line 28 carried `process.env.SHOT_URL ?? 'http://localhost:4210/'` — the exact
GOTCHAS 48 shape that had 648 other instruments swept on 2026-08-02. Unaimed it
opened 4210, measured whoever was serving it, and printed a confident chamfer
verdict with nothing in the output admitting the port was a default nobody
picked. Now `import { aim } from '../lib/aim.mjs'` and `aim('http://localhost:4210/')`,
which returns `SHOT_URL` untouched when set and otherwise prints the
NOT AIMED banner to stderr.

## 2. The fixed 2600 ms legs — the flake

§4a and §4b both held `w` for a fixed 2600 ms, sampling on a 65 ms wall-clock
poll. `dt` is **clamped at 0.05 s** (`src/main.ts:107`), so a loaded browser
advances the simulation by at most 50 ms however long the frame actually took.
The window therefore closed while the player was still mid-corner, and the
number reported was how many frames the machine managed — not how far the
chamfer let anybody walk.

**Reproduced on my own port before changing anything**, at `CPU_THROTTLE=8`,
five runs on bit-identical world bytes:

    §4a cleared   2.68 / 3.92 / 3.76 / 2.68 / 2.68 m      (the face is 2.83 m)
    result        1 of 5 runs passed

The scatter straddles the 2.83 m face width the verdict compares against, which
is why the same world passed and failed. **The threshold was not touched.** Both
legs now end on world state:

- **cleared** — you got past `FW + 0.5` m along the face; or
- **stalled** — 30 consecutive *rendered* frames with under 2 mm of travel,
  counted only after the leg has actually started moving (the frames right after
  a warp show no travel because the keydown has not been read yet, and calling
  that "wedged" would paint a good world red); or
- **budget** — 600 *rendered frames*, the terminator of last resort.

The budget is in frames rather than ms deliberately: a budget generous in wall
clock is unbounded exactly when frames are slow, which is when the check
matters. `jump-walk.mjs` sat on a 3000 ms one at x40 for twenty minutes.

Sampling is now per rendered frame, in-page, so no sample straddles a frame the
way a 65 ms poll did.

### Derived, not retyped

The in-page loop needs `along` to decide when to stop, and an in-page callback
cannot close over the node-side `along`/`perp`. So the in-page copy **gates the
loop only** — the raw `x, z` track comes back and every number this file reports
or judges is recomputed by the original node-side `along`/`perp`. There is one
definition of the face frame in any verdict. (BUILDER-BRIEF §8.)

## What I added

- `CPU_THROTTLE` support, the `jump-walk.mjs` / `wetness.mjs` convention, so the
  fault is reproducible **on purpose** rather than one run in five by luck.
- `scripts/probes/w34-chamfer-walk-repeat.mjs` — runs the check N times and
  reports the **spread** of the §4a distance next to the pass count. A single
  green run cannot see a flake; this is what the DONE WHEN is measured with.
  It reads the child's exit code unpiped.

## Found and NOT fixed

- **§4b's "largest outward step" is still reported and not judged**, correctly —
  it measures `fp.ts`'s axis-separated movement against any diagonal wall, not
  the number of boxes. Left exactly as the previous builder documented it.
- **§3 notes red boxes near, but not part of, the corner** — the corner block is
  an 11.7 x 8 m slab spanning the frontage that reads red against props metres
  up the street. Pre-existing, unrelated to the chamfer, still unqueued.
- **The item's path was wrong** (`scripts/` vs `scripts/probes/`); harmless.
