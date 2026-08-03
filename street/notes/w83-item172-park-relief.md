# w83 / item 172 — the park's ground, and who owns a site's floor

**The user:** *"try to add some y diversity here. the height is soooo flat."*

He was right, and `ct/park.ts` already knew why. Everything below is measured on
the **built bundle** (`vite preview`, port 4391), not only on dev.

---

## The headline numbers

Swept on a 0.2 m grid over the whole 32 × 30 m site with the world's own floor
picker (`scripts/probes/w83-park-relief.mjs`):

| | before | after |
|---|---|---|
| **RANGE** | 0.366 m | **0.568 m** (+55%) |
| **GRADE** | 1 in 9.4 | **1 in 9.4** (unchanged) |
| **STEP** at the grass/path join | 0.3 mm | **0.0 mm** |
| **FLOOR** | 0.140 m | **0.057 m** (constraint: ≥ 0.056) |
| mound height | 0.30 m | **0.485 m** (+62%) |
| tree canopy tops | 6.76–9.54 m, sd 0.97 | **5.77–10.73 m, sd 1.73** |

**The grade is not a regression on any reading**, which was the deciding
constraint — see "the one dial" below.

---

## Two things the item got wrong

1. **"the current composite is 1 in 12."** It is not, and has not been for as
   long as the crown existed. Measured **1 in 9.4** before I touched anything —
   and `ct/park.ts`'s own comment already said the crown took it "from 1 in 12
   to 1 in 9.1". The 1-in-12 figure is the *pre-crown* number.
2. **"the trees are all roughly one canopy height."** Measured 12 trees before
   changing them: canopy tops **6.76–9.54 m, a 2.79 m spread, sd 0.97, 9 of 12
   distinct**. The source has drawn height from `6.6 + t2()*2.8` all along. I
   widened them anyway, because height diversity is the actual ask — but the
   claim as written was false.

---

## What changed

### `Site.displace` — a module can own its site's ground (`ct/ctx.ts`, `ct/street.ts`)

This is the item, and the previous author had already named it: *"If
ct/street.ts ever lets a module own its site's ground, the crown can come off
and the hollows can be real."*

`openSite`'s ground plane was **one quad**, and one quad cannot be given a
shape. It is now subdivided at **1.5 verts/m — the density `ct/park.ts:771`
already builds its field mesh at**, derived from the consumer rather than
picked — and `Site.displace(fill)` hands it to the module that fills the site.

**It moves vertices; it builds nothing.** Replacing the geometry would create a
`BufferGeometry`, and three spends four `Math.random()` calls per object on
`generateUUID` — under the seeded stream that moves every tree and pigeon built
afterwards (GOTCHAS §2). Nothing is constructed, so nothing downstream shifts.

### The crown is off (`ct/park.ts`)

The `+0.10 m` crown and the `Math.max(0, …)` clamp were two halves of one
workaround for an opaque plane the module could not move. Both are gone.

### Gaussians → one bounded-slope primitive (`land`)

A gaussian is the wrong tool here for two reasons that between them cost this
park most of its height:

- **peak slope is 1.65× its average** (`A/(σ√e)`), so a third of the grade
  budget goes on one band. `land` ramps its slope in and out and is linear
  between: **1.25×**. Same budget, 32% more height.
- **it never reaches zero**, so every feature sits in every other's skirt. The
  old file records a −0.09 m dish that measured **+0.15** because the mound was
  still 0.11 m tall under it 4.6 m away. `land` is exactly zero past `r1`.

### Rim mask → an edge wedge

`* smoothstep(inset/5.5)` forced relief to zero at the paths by **multiplying**,
which adds the mask's own slope to the mound's. Not theory: the first sweep of
this rewrite came back **1 in 5.7**, and the arithmetic accounts for it exactly
(0.1206 of mound + 0.0669 of mask = 0.1764). Clamping `|relief| ≤ inset × 0.13`
states the constraint directly and **can only remove slope**.

### The site plane is sunk 30 mm under the grass

Once *both* surfaces are curved, a 3 mm gap is not enough: they are tessellated
at 0.657 m and 0.667 m and neither grid's vertices land on the other's, so each
sags up to **5.2 mm** mid-facet out of phase with the other and the site's grey
can stand **2.2 mm proud of the grass**. GOTCHAS §6 with a curve in it. The sag
ramps from zero over the first 0.6 m inside the field boundary, so the surfaces
still meet flush where the grass ends. The floor picker is untouched — it
answers `relief`, not the plane.

---

## A rule worth keeping: a hollow may not sit on a mound's flank

Measured, not reasoned. Two features were built and then **measured out**:

- a **south-east corner fall** (−0.083 m). Every position it can take is inside
  the mound's descending flank, and a hollow on a descending flank *adds*:
  **1 in 7.1** at x −19.60 z −85.80.
- a **north-west swell** (+0.18 m). I expected this to be free, since a rise
  opposes a mound in the saddle between them. **It is only free on the line
  joining them.** Off that line — x −28.20 z −82.60 — climbing east *and* north
  climbs both: 0.111 of mound + 0.027 of swell, **1 in 8.0** against 1 in 8.6
  for the mound alone. Costed out, it buys a second crest for 0.034 m of range,
  which is the wrong way round when the complaint is about height.

Both are documented in the source with their numbers so the next person does not
re-derive them.

---

## The one dial, and the ceiling above it

`MND_H` is the only amplitude left and grade scales linearly with it:

- `0.485` → **1 in 9.4**, range 0.568 m ← what shipped, matching the old grade
- `0.570` → 1 in 8.0, range 0.653 m

**I chose the first deliberately.** The item calls the grade non-negotiable, so
delivering +55% relief at *identical* grade is a result nobody has to weigh
against a constraint. **If the desk decides a 1-in-8 lawn is fine — a real grass
bank is 1 in 4 — that one number buys another 40% with nothing else touched.**

**The hard ceiling, for whoever comes next.** Relief must be zero where the grass
meets the loop, because the paths are laid level. That puts the whole run inside
the **field**, which is **17.75 × 16.5 m**, not the site's 32 × 30. A landform
zero on a rectangle's boundary cannot exceed `grade × inradius`, so 8.25 m of run
at 1 in 8 caps it near **1.0 m however it is shaped**. To go past that, **the
loop itself has to be draped on the relief the way the desire lines already
are** — and that moves the benches (item 170) and the shelter (item 171), so it
was out of scope here. It is the next real move on this park.

---

## Verification

- **WALK, 25 legs, GREEN** (`w83-park-walk.mjs`) — a transect grid across the
  whole site in both axes plus four legs that must climb the mound. Eye rides
  the floor within 0.045 m; **0.0 mm of step over grade**; 0 console errors. All
  four approaches reach the crest (north +0.329, south +0.388, west +0.470,
  east +0.302, crest floor 0.625 m).
- **Regression guard on the shared builder.** `openSite` serves the park, the
  lot and the jail. `SITE=lot` → **RANGE 0.000 m, dead flat**; `SITE=jail`
  → complete. Subdividing the plane deformed nothing that did not ask for it.
- `npm run sweep`: 96 shots, **0 STATION MISS, 0 COVERAGE**. `health.mjs`:
  WORLD OK. Typecheck clean.
- Shots I looked at: `shots/w83-park-{gate,inside,crest,oblique,dish}-built.png`.
  The crest view is the one that sells it — you are visibly standing above the
  lawn looking down at the gate. No z-fighting on the grass.

## My instruments were wrong three times before the world was wrong once

Worth recording, because it is the house pattern:

1. The relief probe's self-test ramp was **1 in 16 written as 1 in 8**, plus an
   unintended 0.75 m cliff. Caught by its own self-test, before any number about
   the park was believed. It now runs **three known grounds — ramp, cliff, and
   flat** — and the flat one is the case that matters: a probe that reports
   relief on level ground makes a fix look done.
2. The canopy probe selected "a DoubleSide alphaTest plane" and reported **51
   trees with canopies from 0.31 m to 8.06 m** — it was measuring the shrub
   layer. Filtering by size would have been circular, so it keys on the 0.3 m
   bark trunk instead. 12 trees.
3. The walk harness asserted against `rig.pos.y`, which `fp.ts:211` sets to a
   **constant eye height**. It reported "NOT ON THE GROUND, drift 0.218 m" — and
   0.218 m was exactly the mound's height at that sample point, so it had
   rediscovered the mound and called it a bug. It also had the yaw convention
   upside down and marched ten legs into the north flank wall from 1.6 m away,
   then called them STUCK. `camY()` is the eye's real world height, and a leg
   that stops is now checked against `__ct.colliders()` before it is a failure —
   a planted park is *meant* to stop you.

## Found and not fixed

- **The mound's bench and tree stand higher now.** `mndX`/`mndZ` did **not**
  move — the crest is where it was, so nothing shifted in x or z — but the
  ground under the bench at `mndX+2.1` and the tree at `mndX-0.7` rose with the
  mound. That is the intent ("up 0.45 m, with a view of where you came in", now
  0.485). Flagging it because item 170 holds the benches.
- **`SITE=jail` shows a 0.14 m step at x 57.00 z −96.00**, the exact site
  boundary where the forecourt meets the roadway. Pre-existing, not mine, and at
  a boundary rather than in the walkable interior — recorded, not chased.
- Pre-existing reds untouched and inherited: `[interior:hotel] NO BUILDING NAME`
  still warns in the sweep.
