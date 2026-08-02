# w27 — `scripts/jump-walk.mjs`: the last fixed wall-clock wait

Queue item 50. Port **4187** (dev) and **4194** (`vite preview`, built bundle).
Both shut down at the end of the session.

## Root cause, one line

`dt` is clamped at 0.05 s (`src/main.ts:107`), so a slow frame advances the
simulation by at most 50 ms however long it really took — a fixed 1100 ms window
around the hop therefore closes mid-ascent under load and reports the
peak-so-far as the apex.

## The item's premise was right, but x8 was not where it breaks

The item said "produces the same apex under CPU throttle x8 as it does idle". I
measured before changing anything, and **x8 does not break the old instrument** —
it needs roughly x40 before the window truncates. One spot, the pavement,
`scripts/probes/jump-apex-under-throttle.mjs`:

```
fixed 1100 ms   x1 0.4750  x8 0.4750  x20 0.4750  x40 0.3900  x80 0.2950
settled frames  x1 0.4750  x8 0.4750  x20 0.4750  x40 0.4750  x80 0.4750
```

The defect is real, the threshold in the item is not. A builder who had run only
x8 would have concluded the file was already fine.

Full seven-spot sweep at x40, old file vs new:

| | old (fixed 1100 ms) | new (settled) |
|---|---|---|
| pavement / kerb / road / stoop | 0.390 | 0.475 |
| ground floor / stairs / upstairs | 0.475 | 0.475 |
| verdict | **4 FAILs against a healthy world** | passes |

## What changed

`scripts/jump-walk.mjs` only. Three things:

1. **The sample ends when the hop ends, not after 1100 ms.** It waits in-page for
   the camera to have risen, then to hold one height for six consecutive rendered
   frames, below the peak. That is a statement about world state, so load cannot
   truncate it. It **rejects** rather than returning a partial peak, with two
   distinguishable messages: the hop never started, or it never landed.
   Deliberately not "back at `rest`" — a spot that lands you on a different
   storey is the finding this file exists to report and must reach the
   CHANGED FLOOR check rather than die in the settle.

2. **The space hold is three rendered frames, not 60 ms.** The impulse at
   `fp.ts:488` is an edge read once per rendered frame — the same hazard as
   BUILDER-BRIEF §5's held `[E]`. Under load a frame outlasts a 60 ms hold and
   the hop never starts at all.

3. **A derived floor replaces the old lower band.** `APEX_FLOOR` is computed by
   running the world's own integrator at the dt clamp; it comes out at 0.475 m,
   the lowest apex the physics can produce. **The old band's floor was 0.45 —
   below it.** This is not theoretical: in the mutation run below, three spots
   read *exactly* 0.450, a hop truncated at frame 4, and the old check passed
   every one of them as healthy. That is the "check that cannot fail" family in
   GOTCHAS 58, and it was live in this file.

4. `CPU_THROTTLE=8` (any rate) runs the whole sweep throttled, so the regression
   has a check that can fail, from the instrument itself.

## Mutation tests — both red, both changed bytes

| mutation | bytes | result |
|---|---|---|
| both waits back to wall clock | 12772 → 11641 | x40: **6 FAILs, exit 1**, incl. three 0.450s the old band passed |
| keypress spanning no rendered frame | 12772 → 12755 | x40: `the camera never left the ground within 300 frames`, exit 1 |

Green on: dev idle, dev x8, dev x40, **built bundle** idle, built bundle x8 —
all seven spots, same floor everywhere. `node scripts/bugsweep.mjs` on the built
bundle: **0 STATION MISS**, 96 shots, warnings only (pre-existing `THREE.Clock`
deprecation and Canvas2D `getImageData` noise).

## "Same apex idle vs throttled" — the honest reading

They are **not bit-identical, and cannot be**. The world integrates the hop with
forward Euler at a variable step, so a coarser `dt` genuinely peaks lower: 0.5714
m at the continuous limit, 0.475 m at the 0.05 s clamp. What the fix buys is that
every reading is now a real apex of a *completed* hop, inside the physical band
[0.475, 0.571]:

- **before**: 0.295 → 0.475 across throttle, a 0.180 m spread, most of it below
  anything the physics can produce.
- **after**: 0.475 → 0.527, a 0.052 m spread, entirely inside the band, and the
  variation is the world's integrator rather than the instrument's clock.

If the desk wants a literally constant apex, that is a **world** change (fixed
timestep accumulator in `src/main.ts`), not an instrument one, and I did not make
it — `main.ts` is not named by this item.

## Found and NOT fixed — for the desk to queue

1. **`x` is bound to "load the next proto" (`src/main.ts:19`, with `]`).** A
   probe that presses `x` silently leaves CROSSTOWN; `camY()` then reads the next
   world's camera. I hit this writing a mutation and it cost a detour — the
   camera read 7.02, which is the *same* number as the stale walk-up spawn eye in
   this file's own 5.260 m story, so it is easy to misdiagnose. Worth a GOTCHAS
   line: **never use `x` as a filler keypress.** I do not own `notes/GOTCHAS.md`.

2. **`DT_CLAMP` (0.05, `src/main.ts:107`), `JUMP_V0` (4.0) and `GRAVITY` (14)
   (`src/proto/fp.ts:488,491`) are copied into this probe, not imported** — none
   is exported today. Cited by line per BUILDER-BRIEF §8. Worth hoisting into a
   shared module so the derived floor cannot drift from the world; that touches
   `main.ts` and `fp.ts`, which this item does not name.

3. **Every other instrument that samples motion still uses a fixed wall-clock
   wait.** I only had `jump-walk.mjs`. `grep -rln 'waitForTimeout' scripts/`
   is the shortlist; anything measuring a *peak* or a *settled* value is exposed
   to exactly this fault, and x8 is not enough throttle to expose it — use x40.
