# Item 234 — the lamplight is fine; both checks were asking the wrong surface

Worker eightysix, 2026-08-03. Port 4420, built bundle, `vite preview --strictPort`.

## Root cause, one line

`544053b20` moved the warm term and the pool gain into `POOL_FRAG`, so
`ct/props.ts:1494` now writes a pooled material only `base * amb` where `amb` is
`ambient(e.floor)` — **per elevation, not per lamp** — and every check reading
`material.color` from JS went blind to lamplight in the same instant.

## What the desk got right, and the one thing it got wrong

**Right, and confirmed by measurement:** `glow.mjs` was RED on mainline for a
world that is working. Reproduced at `cdd29913a`: `main street: under a lamp
0.0450 vs mid-block 0.0450 — 1.0x`. Near and far on one floor are equal *by
construction*, so 1.0x was the only answer that sampling could ever return.

**Wrong:** the row says grade-sane.mjs's ceiling clause "is now VACUOUS … passing
because there is nothing left for it to see" and asks for it to be re-pointed or
retired. It conflates two different things:

| | state |
|---|---|
| the `deliberately over 1.0` **count** | reporting only, and genuinely dead — 0, peak 0.0000 |
| the ceiling **assertion** | alive, 10962 materials, floor under it, mutation-proven |

`canfail grade-twice` (a material warmed twice, 1.3225 against a 1.155 ceiling)
and `grade-nan` were both run against this tree on 2026-08-03 and **both CAUGHT**.
A clause with a passing mutation behind it is not one that cannot fail, so it is
kept, and the evidence is written beside it rather than asserted from memory.

## The finding the row did not contain: the side street's GREEN was worse than the main street's RED

`glow.mjs` reported `side street … 11.7x  OK` and it looked like the healthy half.
Measured in `scripts/probes/w86-is-glows-side-street-green-real.mjs`:

```
── 13:00 (MIDDAY — night=0, NO pool exists anywhere) ──
  main  near 1.0000  far 1.0000  = 1.0x    (59/164)
  side  near 1.0000  far 1.0000  = 1.0x    ( 8/161)
── 23:00 (deep night) ──
  main  near 0.0450  far 0.0450  = 1.0x    (60/163)
  side  near 1.0000  far 0.0857  = 11.7x   ( 8/161)
```

**Seven of those eight near-lamp samples are `selfLit`** (`ct/props.ts:1113`) —
neon signs and lit windows, stamped `graded` but deliberately held bright at
`FLOOR_SIGN` so they do *not* dim at dusk, which is a thing the user asked for in
as many words. Their luminance is `1.0000` at noon and `1.0000` at midnight.

**A material whose colour is identical at noon and at midnight cannot be
reporting on a lamp.** The green was reading "neon is bright at night" off a
population that happened to stand near a lamp post. `glow.mjs`'s own comment
justified widening to the side street because it "pools hardest of the three:
1.0 against 0.0529 mid-block, 18.9x" — that justification was always this
artefact.

## What the check does now

Reads **pixels**, and normalises each spot against **its own daytime luminance**:

```
gain(spot) = luminance(23:00 at spot) / luminance(13:00 at spot)
pool       = gain(under a lamp) / gain(mid-block)
```

At 13:00 `night` is 0 and `POOL_FRAG` is skipped by its own first line, so the
daytime reading is that spot's paint with no lamplight in it. Dividing by it
**cancels the base colour** — which closes the hole the neon walked through for
every future population, not just for neon.

Mid-block is **derived**, not typed: `LAMP_R` is parsed out of `ct/props.ts`
(BUILDER-BRIEF §8) and the control is the *nearest* spot whose closest lamp is at
or past that radius, where the shader's falloff is exactly zero. Nearest, not
darkest — maximising distance sent five of eleven controls 18–20 m away, off the
end of the street.

### Measured, built bundle, five runs

```
median 4.55–4.57x   dimmest 3.32–3.34x   lit ground holds 69% of daylight   10 of 11 lamps
```

Four legs, two of them new: median ≥ 3.0x, **per-lamp worst** ≥ 2.6x (so one dark
lamp cannot hide behind nine bright ones), lit ground holds ≥ 50% of its daylight
luminance, and a **ceiling** — nothing is warmed twice. Population floor of 4
pairs. One lamp, `side (34,-107.1)`, is skipped honestly by the instrument's own
daylight control and says so.

## Two things I watched fail, and the first is the more instructive

`canfail glow-pool` **SLEPT** on my first bar of 1.5x. That bar was *reasoned*
rather than measured — "the ratio of ratios cancels everything, so a dead pool
must give 1.00x".

**It does not, and that is a fact about the world.** `POOL_GAIN = 0` leaves
**2.1x of lamplight still on the ground**, because the per-fragment pool is not
the only thing lighting it: the painted 5.6 m **additive pool decal** is separate
geometry that `POOL_GAIN` never touches. Any pixel reading of ground light
necessarily sees both mechanisms, so "the gain is dead" reads as a halving rather
than a blackout.

```
                    ratio median   ratio worst   night/day under lamp
HEAD                   4.56x          3.33x           0.686–0.718
POOL_GAIN = 0          2.10–2.11x     2.08x           0.316–0.336
```

For the new GPU ceiling leg:

```
POOL_FRAG's min(1.0, …) REMOVED     no change at all, 0.72
POOL_FRAG's multiply applied TWICE  1.63 vs 1.11 — FAIL
```

Uncapping moves nothing because **the cap is not binding at these pixels**: the
crop averages a patch of ground only partly inside the lamp's core, so the mean
gain is 0.69 and never approaches the 1.0 the `min()` clamps. *A mutation that
changes no observable is not a failed check, it is a mutation that does not
mutate* — and telling those two apart is the whole job of running it.

The doubled multiply is the argument **for** having a ceiling: under it the other
three verdicts go **greener** (median 4.56x → 10.43x, held 69% → 158%), because
twice the light is still light. A floor cannot catch too much of a good thing.

## The frames — my own verdict, having looked

`shots/gl-pool-main-near-23.png` against `shots/gl-pool-main-far-23.png`, same
watch reading 23:01, same framing, 7 m apart: under the lamp there is a warm
sodium wash across the paving slabs and the kerb; mid-block is near-black and
cold, with only the kerb line catching anything. **The feature is healthy and the
user would see it.** The check was the broken thing.

Looking is also what found the crop bug: the frame's bottom third is the player's
**wristwatch**, a bright constant HUD patch. It could only ever have made this
check too forgiving, but it measures the HUD rather than the world, so the crop
moved to y 0.15–0.55.

## Found and NOT fixed — for the desk to queue

1. **`scripts/canfail.mjs` carries a now-false warning about my own subject.**
   Around lines 487–500 it says of `glow-pool`: *"⚠ THIS CASE CANNOT DISCRIMINATE
   TODAY, AND SAYING SO IS THE POINT … glow.mjs is RED on this tree BEFORE any
   mutation is applied"*. That is fixed as of this item — the case now CAUGHTs —
   and the paragraph will mislead the next reader. `canfail.mjs` is not named by
   item 234, so I left it alone (BUILDER-BRIEF §9). **It is a ~6-line comment
   correction, no logic.**

2. **A GOTCHA worth writing down, and `notes/GOTCHAS.md` is not mine:** *ground
   lighting in this world comes from two independent mechanisms — the
   per-fragment `POOL_FRAG` pool and a separate additive decal — so a pixel
   measurement of lit ground cannot attribute what it sees to either one.* It is
   why a "dead pool" measures 2.1x rather than 1.0x, and it will mislead the next
   person who mutates `POOL_GAIN` and expects a blackout.

3. **`side (34,-107.1)` has no comparable mid-block ground** — at 13:00 the pair
   reads 0.39 vs 0.55. Skipped honestly rather than fudged, but somebody who owns
   the side street should look at what that pavement actually is.

4. **Two main-street lamps read dimmer than their neighbours** — `(-4.1,-65)` and
   `(4.1,-79)` give 3.33–3.36x against 4.54–5.03x elsewhere, entirely because
   their *mid-block* ground is brighter at night (gainFar 0.205 vs 0.151). Not a
   lamp defect; probably a different paving or a crossing. Recorded because it
   sets the per-lamp worst-case bar.

## Derived or copied

`LAMP_R` (7.0) and `WARM_R/G/B` (1.15/1.05/0.85) are **parsed out of
`src/proto/ct/props.ts` at run time**, never retyped — the same pattern
`grade-sane.mjs` already used for the warm factors. If the world is retuned these
retune with it; if it is retuned by accident, both fail to parse and say so rather
than quietly measuring the wrong thing.

## Verification run

- typecheck clean · `node scripts/health.mjs` → `WORLD OK — __ct initialised`
- `npm run sweep` → **0 STATION MISS, 0 COVERAGE**, no new console errors
  (inherited: `[interior:hotel] NO BUILDING NAME`, `THREE.Clock` deprecation,
  `CONTEXT_LOST_WEBGL` per GOTCHAS 80, Canvas2D `willReadFrequently`)
- `canfail glow glow-pool grade-twice grade-nan` → **4/4 CAUGHT**
- five consecutive `glow.mjs probe` runs, all green, spread 0.02x
