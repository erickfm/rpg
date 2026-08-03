# w63 — item 187: different heights, and where the sameness actually comes from

> *"make people different heights pls."*

Ports **4190** (dev) and **4191** (`vite preview`, the built bundle).

## The row's diagnosis is directionally right and numerically wrong, and the gap is the finding

The row says *"a street with twenty people on it shows SIX heights, repeated."*
Measured before touching anything (`scripts/probes/w63-heights.mjs`):

| population | count | distinct heights |
|---|---|---|
| `ct/crowd.ts` walkers | **6** | **6 — all different already** |
| `citizenSprite()` figures elsewhere in the world | **26** | **6**, and **16 of the 26 are the identical 1.900 m** |

**The six in the file this item names were never the problem.** They already had
six distinct heights. **Twenty of the world's twenty-six other people are placed
by `citizenSprite()` from shop and interior modules, and sixteen of them pass no
`h` at all**, so they are exactly the default, to four decimal places. That is
the crowd of one height he is looking at, and the fix for it is in
`ct/citizens.ts` and the `int-*.ts` callers — **none of which this item names, so
I reported it rather than reaching for it** (BUILDER-BRIEF §9). It is the biggest
single thing left on this request.

## What I did fix, inside `ct/crowd.ts`

**`hs`/`ws` are now a property of the PERSON, not of the cast member.**
`bodyScale(p)` takes the role's numbers, widens the deviation, and adds a small
per-instance jitter. `strideFor` and the walking cadence both read the finished
`hs`, so a taller person's legs still swing correctly — the item was right that
`strideFor` already handles it, and it only does if you pass it the real number.

**Its own random stream, not `ct/rng.ts`'s.** GOTCHAS §2: one seeded `rnd()`
whose ORDER is load-bearing, and a draw inserted at BUILD time moves every tree
height and pigeon in the world. This file's own comment records that its `rnd()`
runs at runtime only. Seeded, so the six are reproducible and `fp` still has a
stable world.

**Widened ASYMMETRICALLY, upward.**

## ⚠ The measurement that changed the answer: `hs` is not a height

`citizenPlane` is 1.9 m and the PERSON is not — four empty rows sit under the
shoe and there is headroom above the hair. `scripts/probes/w63-figure-rows.mjs`
reads every atlas back and counts opaque rows: **the figure is 55 or 56 of 64,
so 1.633–1.662 m at `hs` 1.**

**My first cut widened the deviation symmetrically by 1.45 and put the shortest
walker at 1.434 m** — a ten-year-old on the pavement, which is precisely what the
row warns against, and I would not have seen it from the plane height. The probe
is the only reason it did not ship.

It also showed the band was sitting **low**, not high: the street ran 1.51 m to
1.78 m, so everybody was between 5'0" and 5'10" and nobody was tall. The
widening therefore goes mostly **up**.

| | shortest | tallest | spread |
|---|---|---|---|
| before | 1.512 m | 1.780 m | 0.268 m |
| **after** | **1.496 m** | **1.881 m** | **0.385 m** (+44 %) |

Per person, after: 1.496 · 1.534 · 1.567 · 1.719 · 1.791 · 1.881 m — six
heights, no two within 3 cm.

Width moves with height but not in lockstep (`W_FOLLOWS_H = 0.55` plus its own
jitter), because scaling height alone is what makes a sprite read as stretched.
`ws` is capped at **1.12** on purpose: the collider is a fixed ±0.25 m box, and a
body drawn wider than the box it carries is a person you can walk through the
edge of. The authored maximum was 1.10, so this moves that ratio by 1.8 %.

**`build` is untouched**, as the row insists — it is a silhouette baked into the
atlas and it is what stops the tall ones being the short ones blown up.

## The three interacting rows

- **93 (seated figures clip).** Unaffected, and I did not settle it by argument.
  `ct/crowd.ts` contains no occurrence of `seated`, never calls
  `citizenPlane(true)`, and its six meshes carry no `userData` at all; the 14
  seated figures are all `citizenSprite` instances from interior modules and the
  probe reports their heights identical before and after. Then **`seats-walk` was
  run on BOTH builds** — the pre-change `ct/crowd.ts` checked out of
  `02e9b62de~1`, rebuilt, re-run:

  ```
  before   116 FAIL   103/219 seats sit, lock, and stand clear
  after    116 FAIL   103/219 seats sit, lock, and stand clear
  ```

  **Identical.** Those 116 are pre-existing and none of them is mine — every
  failing seat is at x ≥ 198, i.e. inside a room, and the six walkers never leave
  the block (|x| ≤ 8). Seat 1 is the documented first-warp-after-page-load false
  negative (`notes/AUDIT-INSTRUMENTS.md` §345). **`seats-walk` being 116 red on
  mainline is worth a row of its own; it is not this one.**
- **173/174 (crowd steering).** Confirmed unaffected: the avoidance footprint is
  `x ± 0.28` and the collider `± 0.25`, both **widths**, both untouched. And
  walked rather than argued — see below.
- **172 (vertical variety in the park).** Same underlying complaint; the
  `citizenSprite` finding above is most of it.

## Proof

| | |
|---|---|
| `scripts/crowd-walk.mjs` on the built bundle | **all pass** — *"all 6/6 feet planted on the floor beneath them, worst gap 0.000 m"*, so nobody floats or sinks at any of the new scales; tightest gap past a stopped citizen **1.92 m**, so the 2 m lane is intact |
| `scripts/feet-check.mjs` | 16 profile cases, every toe points the way it walks — the new strides are still drawn right |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, no new console errors |
| `node scripts/health.mjs` | WORLD OK, exit 0, build `02e9b62de` |
| `npx tsc --noEmit` | clean |
| street frame | `/tmp/w63-crowd-after.png` — two walkers side by side outside the THRIFT, feet on the same pavement, ~1.88 m against ~1.57 m |

**Every exit code above was taken from the command itself, not after a pipe.**
`node scripts/feet-check.mjs | tail` reported `0` while the script had aborted
with *"MEASURING THE WRONG WORLD"* — I had committed after building, so the dist
was one commit stale and `reportWorld` correctly refused. That is the `$?`-after-
a-pipeline trap the brief warns about, caught live.

## My own verdict on the after-image

`/tmp/w63-crowd-after.png`. Two people outside the thrift store at the same
distance on the same pavement: the man in the blue coat is a head taller than the
woman in the green dress, and the difference reads instantly. Neither looks
stretched — the width moved with the height — and neither looks child-sized.
Before this, the same pair differed by about half that.

**Honest reservation:** with six walkers spawning 16 m apart down the block, you
almost never see two at once until they have been walking for a while. The frame
above needed **45 s of settling** to exist. So the street-level experience of
"different heights" is still mostly a *sequence* of people rather than a crowd,
and that is a density question, not a height one.

## Found and NOT fixed — for the desk to queue

1. **THE BIG ONE: 16 of 26 `citizenSprite` figures pass no height at all.**
   Exactly 1.900 m each, to four decimals. Five more share 1.843 and two share
   1.881, so the whole non-walking population of the world has **six distinct
   heights across twenty-six people**. The fix is either a default jitter inside
   `citizenSprite()` (`ct/citizens.ts`, one place, catches every caller) or an
   `h` at each of the ~20 call sites in the `int-*.ts` files. **Neither file is
   named by item 187.** The `ct/citizens.ts` version is one function and would
   close this request properly.
2. **`ct/crowd.ts`'s six meshes carry no `userData` at all**, so nothing that
   filters on `userData.citizen` can see them — `ct/slots.ts`'s `cabinetAhead`
   and my own `ct/library-pc.ts` finder both skip citizens that way and would not
   skip a street walker. Harmless today (both are indoors) and a real trap.
   One line: `mesh.userData.citizen = true` beside the existing `o.solid(box)`.
3. **The 0.90 floor on `hs` bites for the smallest cast member**, so its jitter
   is one-sided. Correct behaviour — it is a floor in metres wearing a scale's
   clothes — but worth knowing before anyone tunes `H_JITTER` up.
