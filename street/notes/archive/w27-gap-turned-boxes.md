# w27 — item 59: `gap.ts` measures a turned box exactly

Ports: **4187** (dev — `interiors-walk` and the collider probes import TS source,
so they need dev, not preview) and **4194** (`vite preview`, built bundle).
Both shut down at the end of the session.

## Root cause, one line

The corridor test only ever considered world X and Z, so it could not see the
axis a slot between two turned boxes actually runs along — and the width it
reported was a separation along an axis, which is the real clearance only when
the two boxes meet face to face.

## I had to rebase first, and it was not free

My worktree's base (`4d35e1b1b`) predates the turned-box work entirely — it still
has the chamfer as a staircase of bands and `AABB` with no `rot`, so **item 59
could not be started on it at all**. Rebased onto `add-stick-and-city98`
(`2c5ae6df2`), which brought two conflicts in files my earlier items had touched:

- **`scripts/jump-walk.mjs`** — the tip had rewritten it substantially (it now
  walks the storeys instead of warping to three spots that were all the same
  height). My item-50 frames work is re-applied onto that structure rather than
  over it: the tip's `aim()` URL, its `warp` that treats a `null` storey as
  "leave it alone", and its `jumpHere` all kept; the settle, the frame-counted
  hold and `APEX_FLOOR` layered on. Re-verified green after the rebase, all
  seven spots plus every storey assertion.
- **`scripts/wetness.mjs`** — trivial, the tip moved to `aim()`.

Both re-run green post-rebase. **Anyone landing my branch is landing a rebase
that was resolved by hand, not a fast-forward.**

## What changed in `ct/gap.ts`

1. **Corridor width is the true clearance.** Every vertex of each box against
   every edge of the other, which is exact for convex polygons.
2. **The separating-axis test decides THAT a corridor exists** — the boxes face
   each other rather than sitting diagonally — and names the frame the slot runs
   in, which the filled-test needs. It no longer supplies the width.
3. **An unrotated pair takes the original expressions on an explicit branch.**
   Same answer either way; not the same floating-point chain, and `nudgeClear`
   turns this number into where a car parks.
4. **`orientedFilled`** does the interval union in the corridor's own frame, and
   **refuses fillers that are not square to it** — where a projection is not
   coverage. Same refusal added to `corridorFilled` for turned fillers. That can
   only leave a corridor reported, never hide one.

## I got it wrong twice, and the same check caught both

| attempt | what it did | how it failed |
|---|---|---|
| narrowest qualifying separation | reasoned that the tightest slot is the one you wedge in | a separation along a badly-chosen axis is not a slot: two 45° bars 2 m apart in world X read 0.444 m, measured between corners 1.6 m from each other |
| widest qualifying separation | correct as a bound | still not the clearance where a corner faces a flat face — **worst case 0.634 m of understatement** over 4000 random pairs |

**All sixteen hand-written cases passed the first, wrong version.** Cases I choose
share my blind spots — in every one of them only a single axis qualifies, so
narrowest and widest are the same number. What caught it was asking the question
directly: over 4000 seeded-random turned pairs, whenever `corridor` reports a
slot, is that number the actual distance between the rectangles? The oracle is
exact polygon distance written independently in the test file. It is the only
check here that could have found either error.

## Verified

- **`test/gap.test.ts` — the first unit tests in this repo.** 17 cases, 4 ms, no
  browser, no port, no frame. gap.ts is pure geometry and never needed one.
- **Mutation-tested, both red, bytes confirmed changed:**
  - clearance → axis separation (the bug I shipped for one commit): property
    test red at 0.634, 20400 → 20352 bytes.
  - turned boxes read as world coordinates (the pre-w24 bug): 6 of 17 red,
    20400 → 20391 bytes.
- **The world does not move.** `scripts/probes/w27-collider-keys.mjs` dumps every
  static collider; **identical** before and after, 512 of 518 both sides. The
  red dump is also identical, **RED 160**, which is w24's number. The key dump
  exists because the red dump would not show a car that moved from one clear
  spot to another — `nudgeClear` is the thing at risk here.
- **`scripts/probes/w27-second-turned-collider.mjs`** — the item's own acceptance,
  in the real world. It **searches** for an offset where a world-axis reading
  calls the pair a trap (0.4004 m) while the real clearance is 1.1617 m, and
  **aborts rather than passing if no such offset exists** — which is exactly what
  it does against w24's `gap.ts`, because for that version the two readings are
  the same number. Against mine: no phantom on the chamfer, and a bar slid in to
  0.60 m of real clearance is still caught.
- **Walked**: `w24-chamfer-walk.mjs` — riding the face never puts you inside it,
  hugging it carries you along and off the end, 0 of 39 frames moved under 10 mm,
  no console errors.
- `bugsweep.mjs` on the **built bundle**: **0 STATION MISS**.
- `tsc --noEmit` and `npm run build` clean.

## A regression I introduced and caught before shipping

**A vitest file under `src/` kills the DEV world.** With `gap.test.ts` at
`src/proto/ct/gap.test.ts`, vite's client executed it in the browser and threw
`TypeError: Cannot read properties of undefined (reading 'config')` at the
`describe()` call; `__ct` never appeared and the world did not initialise.
Persistent across restarts.

**`npm run build` is clean either way**, so this would have shipped as "builds
fine, playtest world dead" — and the live integration world is what the user
plays. Proven by moving the file: same content at `test/gap.test.ts`, dev server
clean, world up, red dump 160, 17/17 still passing. Worth a GOTCHAS line, which
I do not own: **tests go in `test/`, never under `src/`.**

## Found and NOT fixed — for the desk to queue

1. **`scripts/interiors-walk.mjs` refuses to run at all** on the current tip:
   *"the world publishes rooms this suite does not test: apt301 — refusing to
   report on a subset and call it the world"*. w22 landed the apartment as a
   room and the suite's ROOMS list was not extended. It is doing the right thing
   loudly, but it means **the bodega walk cannot be run by anyone right now**,
   including whoever holds item 58 (the bodega flake) — that item may be
   unstartable until this is fixed. One entry with a `keeper`.
2. **`corridorFilled` still cannot see a rectangle filled by boxes stacked
   across the OTHER axis** (w24's finding 4). Untouched; it forced the bodega
   pier's depth and will bite again.
3. **The property test's oracle and `clearance()` share a mathematical idea**
   (closest pair of convex polygons is vertex-to-edge), though they are written
   independently and the 16 hand-computed cases are a separate anchor. A
   genuinely independent oracle would sample the boundaries densely. I judged
   the current pair sufficient and am flagging it rather than leaving it
   unsaid.
4. **`rot` is still unread by `ct/crowd.ts`'s citizen avoidance** and
   `escapeFrom`'s `minY` is unimplemented (w24's finding 5, unchanged). Neither
   matters until a turned box goes through `ctx.obstacle`.
5. **`jump-walk.mjs`'s WALK section still holds movement keys for wall-clock
   durations** (`waitForTimeout(150)`, `(350)`, `(400)`). Under load those
   under-travel for the same dt-clamp reason as item 50, which would show up as
   a false "did not reach the landing". Out of item 50's scope — it asked about
   the apex — but it is the same fault in the same file.
