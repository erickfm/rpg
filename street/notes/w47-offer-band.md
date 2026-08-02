# w47 — the offer band: the casino door, and the instrument that can see it

**Item 98 (claimed), and most of item 99 (not claimed, still TODO).**
Port **4185** (dev) and **4196** (built bundle preview). Both shut down at the end.

**I did not change one line of world code.** `fp.ts` is held by item 85 (w40, live
throughout my run — checked at claim and again at 20 m), and my brief and
BUILDER-BRIEF §9 both say do not edit a file another item holds. So this is a
diagnosis plus the missing instrument, and item 98 goes back on the board with
the fix specified and measured but not applied.

---

## Root cause, one line

**`lookTolerance` clamps `atan2(r, d)` into `[0.20, 0.26]` rad, and a constant
angle is a *cone* — its lateral half-width shrinks to nothing as you reach the
door, while the aim-free `touching` disc only ever reaches `r + 0.15`, leaving a
dead ring between them that you walk straight through.**

Both halves of the user's sentence are that one clamp, and the two sides of it
do opposite damage:

| clamp side | effect | his words |
|---|---|---|
| ceiling `min(0.26, …)` | closes the corridor as you arrive | *"then a distance i can't enter"* |
| floor `max(0.20, …)` | holds it open at 6 m — 1.22 m wide where honest geometry gives 1.05 | *"a distance far away i can enter (i dont like this)"* |

`src/proto/fp.ts:683-719` (`lookTolerance`), `:786` (`touching`), `:798`
(`looked`), `:732` (`reach = 6`).

---

## THE ITEM'S STATED CAUSE WAS WRONG, AND SO WAS THE OBVIOUS FIX

Item 98 offered *"there may be two different spots competing (a building
entrance spot and the door itself) with different radii"*. **There are not.**
There is exactly one spot within 14 m of the SEVENS door — `into SEVENS`,
r 1.05, at (51.29, -96.75) — and the instrument reports `[nothing offered]`
inside every dead band it finds. The far offer and the near offer are **the same
spot winning twice**, through two different acceptance regions with a hole
between them.

The item also pointed at `atan2(r, max(0.35, d))` "narrowing with distance" as a
candidate. It is the opposite: **the atan2 is the only part of that line that is
the right shape**, and the clamp is what breaks it. Removing the clamp is the
obvious fix and **it is still not sufficient** — see below.

---

## The plot he asked for — SEVENS, walked

Every column is 0.25 m of approach; `#` offered, `.` dead. Far left, the door at
right. This is the live world today, and it is identical on the built bundle.

```
─ SEVENS  →  "into SEVENS"   spot r=1.05 at (51.29, -96.75)
  lat +0.0 m: ok   offered 5.85 m → 0.09 m                     contiguous
  lat +0.5 m: GAP  DEAD 1.80→1.33 m  (0.47 m of walking)
      8.3m |.........#################..###  | 0m
  lat +1.0 m: GAP  DEAD 3.84→1.24 m  (2.60 m of walking)
      8.3m |.........########...........#    | 0m
  lat -0.5 m: GAP  DEAD 1.80→1.33 m  (0.47 m of walking)
      8.3m |.........#################..###  | 0m
  lat -1.0 m: GAP  DEAD 3.84→1.24 m  (2.60 m of walking)
      8.3m |.........########...........#    | 0m
```

`lat` is how far to one side of the door your walking lane is. **Dead centre it
is fine** — which is exactly why warping to the stand point has never caught it.
One metre off centre, and the door is offered from 5.9 m, dies for **2.6 m of
walking**, and comes back only when you are 1.2 m from it. That is the user's
three zones, reproduced on the first run, symmetric in ±offset.

## IT IS EVERY DOOR IN THE WORLD, NOT THE CASINO

**37 of 60 walked legs fail, across all 12 declared doors.** The casino is where
he happened to notice it. The instrument's sweep:

| door | r | worst dead band |
|---|---|---|
| FIRST FEDERAL | 1.05 | 3.84 → 1.25 m (2.58 m) |
| BODEGA | 1.80 | 3.84 → 2.00 m (1.84 m) |
| BURGER BARN | 1.05 | 3.79 → 1.23 m (2.57 m) |
| **SEVENS** | 1.05 | **3.84 → 1.24 m (2.60 m)** |
| DINER | 1.05 | 3.88 → 1.27 m (2.61 m) |
| JAIL | 1.05 | 3.88 → 1.27 m (2.61 m) |
| LIBRARY | 1.60 | 3.89 → 1.77 m (2.12 m) |
| PAWN | 1.05 | 3.84 → 1.24 m (2.60 m) |
| A-1 TAX | 1.05 | 3.86 → 1.28 m (2.59 m) |
| THRIFT | 1.05 | 3.88 → 1.21 m (2.67 m) |
| ST BRIGID | 1.20 | 1.80 → 1.49 m (0.31 m) |
| HOTEL ORPHEUS | 1.05 | approach truncated — no verdict |

**Every door is offered from 5.85–6.00 m.** That is `reach = 6` and it is the
whole of the far offer he does not want.

---

## How the diagnosis was proved, not argued

The dead zone's **outer edge does not move with the spot's radius**: it sits at
3.84–3.89 m for r = 1.05, 1.20, 1.60 **and** 1.80 alike — 0.09 m of total
movement — while the **inner** edge moves 0.75 m over the same range, tracking
`r + 0.15` exactly. Nothing that depends on `r` can produce a fixed outer edge.
Only a constant can, and the constant is 0.26 rad.

That is a measurement, not a reading of the source. To be sure the explanation
*is* the world's, `scripts/probes/w47-band-model.mjs` replays the predicate over
**the recorded trajectory of every walked leg** — real x, z and yaw, frame by
frame — and scores it against the real prompt string:

```
BURGER BARN 100.0%   SEVENS 100.0%   DINER 100.0%   LIBRARY 100.0%
PAWN 100.0%   A-1 TAX 100.0%   THRIFT 100.0%   HOTEL ORPHEUS 100.0%
BODEGA 99.6%   FIRST FEDERAL 97.0%   JAIL 92.5%   ST BRIGID 48.8%
OVERALL 3524/3677 = 95.84%
```

Eight doors at **100.0%**. The residue is line-of-sight, which the model does not
have (it needs the scene) — ST BRIGID is behind a churchyard wall, which is why
it is the outlier. **This model is `pickSpot`.**

---

## The fix, run through that validated model

**Candidate A — drop the clamp, keep `atan2(r, d)`. FAILS.** `atan2(r, d)`
compares the lateral offset against the **radial** distance `d` where a corridor
needs the **axial** one. Those diverge as you close, so the corridor pinches shut
in the last metre — a smaller hole in the same place. 3 of 40 lanes still gap.

**Candidate B — `d * Math.sin(offAxis) < s.r`. Contiguous on all 40 lanes.**
That expression is the **perpendicular distance from the spot to the ray you are
looking along**; requiring it to be under `r` says *"the spot is within its own
radius of my line of sight"* — a true corridor of constant half-width.

It is contiguous **provably, not luckily**: walking a straight line at fixed
perpendicular offset `p`, the test `p < r` does not depend on how far along the
line you are, so the offer cannot switch off mid-approach. Either the lane is
inside the corridor and the door is offered the whole way in, or it never is and
you walked past a door 1.5 m to your side — which is correct, not a gap.

Suggested edit, for whoever gets `fp.ts` after item 85 releases:

```ts
// fp.ts:798 — was: offAxis < lookTolerance(s.r, d)
const looked = d < reach && d * Math.sin(offAxis) < s.r;
```

`lookTolerance` then has no caller and should go with it.

### The far offer is a SECOND change and I did not pick its value

Candidate B does **not** fix *"a distance far away i can enter"* — that is
`reach = 6`, `fp.ts:732`. **Do not cut it globally.** Interiors pass the same 6 m
deliberately (`fp.ts:729`: *"6 m is a room's width"*), so a global cut drags every
interior `[E]` in with it. The safe form is a **per-spot reach defaulting to 6**,
with street entrances opting into something shorter. Which number is a question
for the user — 3 m and 4 m are plotted in the probe; I am not going to invent his
taste.

---

## What I built

- **`scripts/approach-band.mjs`** — the item-99 instrument. Walks an approach
  holding `w`, records position, yaw and the **HUD's own prompt string** on
  **every rendered frame**, and asserts the offer band is contiguous. Sweeps
  every declared door × 5 lateral offsets from the world's own registries
  (nothing hand-typed). `--only`, `--offsets`, `--plot`, `--dump`, `--selftest`.
  Red on the casino today; will go green when the band is fixed.
- **`scripts/probes/w47-band-model.mjs`** — the trajectory replay above.
- **`scripts/probes/w47-casino-spots.mjs`**, **`w47-what-blocks.mjs`**,
  **`w47-id-blockers.mjs`** — one-shot measurements, in `probes/` per §7a.

**The oracle is `#ct-prompt`'s text — the literal string the player reads.** It
deliberately does not call `pickSpot`; an oracle sharing the implementation's
assumptions is not independent about them, which this project has already paid
for once (`crosstown.ts:1597`).

**Sampling is per rendered frame and termination is on world state** (the player
stops moving, or passes the target) — never a fixed wait. `dt` is clamped at
0.05 s so a fixed `waitForTimeout` covers an unknown distance.

---

## Things I got wrong, and what they cost

**I claimed a second defect twice and it was my instrument both times.** The
sweep first failed 9 legs as "BLOCKED — cannot reach the door". Naming the
blockers from the collider registry: HOTEL ORPHEUS is a **parked car** (userData
`tyre, wheelbase, steer, hoodTop`) at `groundAt 0`, i.e. on the road; ST BRIGID
is a **kerbside lamp post** (`lampPart`). Every leg starts 8 m out down the
door's normal, and 8 m out from a side-street door **is the roadway** — so those
legs were walking across the street into correctly-placed scenery.

I then tried to rescue the verdict by classifying the blocker as pavement or
roadway from `groundAt`, and **that was wrong too**: the lamp post straddles the
kerb line, so a probe past the stopping point reads "pavement". A truncated leg
now carries **no verdict at all**, and that is recorded in the file.

---

## Not fixed, for the desk to queue

1. **The fix itself — item 98 stays open.** `fp.ts` was held by item 85 for my
   whole run. **These are two symptoms of one function and want doing together.**
   Item 85's complaint (the bed winning when you face the door) is about the
   `bestNear`/`bestLooked` *tiering*; mine is about the *shape* of `looked`.
   Candidate B does not touch the tiering, so they should compose — but whoever
   takes them must run `approach-band.mjs` **and** item 85's check, because I
   have not been able to prove that composition.
2. **The far offer needs a per-spot `reach`** — a real API change to `pickSpot`
   and every `ctx.spot` caller, and a number that wants walking with the user.
3. **`scripts/approach-band.mjs` is not wired into anything.** Per §7a it only
   graduates when something calls it; it wants a `package.json` entry
   (`"band": "node scripts/approach-band.mjs"`) and a line in `bugsweep`. **I did
   not add it — `package.json` is not named by my item (§9) and five builders are
   running.** One-line follow-up.
4. **The instrument approaches head-on and cannot model a pavement walk.** That
   is its main known gap and the reason finding 2 above is unproven either way.
   A pavement-following approach would also let it judge whether street furniture
   really does obstruct the sacred 2 m lane.
5. **`interiors-walk.mjs` and friends still warp** — 13 `warp()` calls in that
   file alone. Nothing has been migrated. The class of bug this instrument exists
   for is still invisible to every other check in the repo.

## Verification

- `node scripts/bugsweep.mjs` → **0 STATION MISS**, 0 COVERAGE, no new console
  errors (only the pre-existing THREE.Clock and Canvas2D warnings).
- The finding is **identical on the built bundle** (`vite preview`, port 4196):
  SEVENS dead 3.85→1.23 m against dev's 3.84→1.24 m.
- **No `fp before`/`after`/`fpdiff` is offered, deliberately.** `git diff --stat`
  against my claim point shows **five new files under `scripts/`, zero lines of
  `src/` changed**. That is a stronger proof the world did not move than a pixel
  diff with a 20% noise floor.
- `--selftest` passes: a synthetic trace with a hole is caught, a solid one is
  not flagged, never-offered and trailing-off are correctly not gaps.
