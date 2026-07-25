# Lane audit — sidewalk encroachment across the whole block

**Branch** `audit/seams`, base `add-stick-and-city98` @ `a7d228d5` · read-only ·
nothing under `street/src/` touched. Instrument: `scripts/lane3.mjs`.

Measured against **`__ct.colliders()`** — the array `fp.ts` actually tests
against — so these are not proxies. A gap below 0.72 m means the player is
physically stopped. 164 colliders, 158 of them static.

## Headline: nothing on this block is impassable, and nothing is urgent

The tightest point anywhere is **0.89 m**, against a 0.72 m player and a 0.80 m
urgent line. **The user's report is real but it is not a passability failure** —
it is that the lane is uniformly tight, and a handful of places make it tighter.

## The number that matters most is the baseline, not the instances

> **The clear lane is 1.70 m, not 2.00 m — before anyone puts anything on it.**

Every building's collider is registered at `FACE − 0.3`, i.e. **0.30 m inside its
own facade**. On the west walk the band runs x −7.00 … −5.00; the wall stops you
at −6.70. So 15 % of the "sacred 2 m" is consumed by collision that corresponds
to no geometry, everywhere, permanently.

That is the same 0.30 m inset behind `notes/interior-audit.md` finding 18 (six of
nine door triggers sitting inside solid). **One fix closes both.** It is worth
more than every instance below put together: give it back and every figure in the
table gains 0.30 m, which moves the whole block from "tight" to "fine".

## Ranked by least clearance

All static. None impassable, none urgent.

| # | clear | verdict | walk | tightest at | free span | pinched between | owning file |
|---|---|---|---|---|---|---|---|
| 1 | **0.89 m** | problem | west | z = −92.9 | −6.64 … −5.75 | park wall/hedge ∣ **lamp post** | `ct/park.ts` (E) + `ct/props.ts` (B) |
| 2 | **0.90 m** | problem | west | z = −71.4 | −6.64 … −5.74 | park wall/hedge ∣ **tree trunk** | `ct/park.ts` (E) + `ct/props.ts` (B) |
| 3 | 0.95 m ×6 | problem | both | z = −22.8, −36.8, −50.8, −64.8, −78.9, −92.9 | ±5.75 … ±6.70 | building wall ∣ **lamp post** | `ct/props.ts` (B) |
| 4 | 0.96 m ×4 | problem | both | z = −29.4, −43.5, −57.4, −85.4 | ±5.74 … ±6.70 | building wall ∣ **tree trunk** | `ct/props.ts` (B) |
| 5 | **1.01 m** over **1.8 m** | tight | east | z = −34.1 | 5.69 … 6.70 | car-lot **A-board** (5.12 … 5.69) ∣ wall | `ct/lot.ts` |
| 6 | 1.11 m | tight | east | z = −5.9 | 5.53 … 6.64 | shopfront projection ∣ wall | `ct/street.ts` (D) |

**Rows 3 and 4 are the block's normal condition, not an encroachment.** Every
lamp post (collider ±5.35 … ±5.75) and every tree trunk (±5.58 … ±5.74) leaves
0.95–0.96 m. Fixing them means moving every lamp and tree on the street; giving
back the 0.30 m wall inset achieves more for one edit.

**Rows 1 and 2 are the park**, and they are only 0.06 m worse than the block's
normal — the park's wall-and-hedge collider takes 0.36 m of walk where a
building takes 0.30 m. Worth a nudge, not an emergency.

**Row 5 is the one genuinely new object making things worse**: the car lot's
A-board sits at x 5.12 … 5.69, i.e. **hard against the kerb**, and holds the lane
at 1.01 m for 1.8 m — the longest sustained pinch on the block. Everything else
in the table is a 0.1–0.3 m pinch point you step round.

## What I checked and found NOT to be a problem

- **The park's bin** — the object in the user's report. It has a collider
  (x −7.26 … −6.74, z −81.76 … −81.24) and 0.26 m of it is on the walk, but it
  stands where the park has railings rather than wall, so it leaves **1.74 m** —
  *wider* than a normal stretch of building. It looks like it is in the lane and
  measurably is not the constraint.
- Bodega crates, payphone, hydrant, bus bench and pole, tree pits, gate piers,
  bunting poles, fence pickets: all present in the collider list, none producing
  a gap under 1.20 m.
- Side street north and south: **no stretch under 1.20 m at all.**

## Two false-positive classes I hit, because they will bite the test too

**1. The collider list contains moving bodies.** Citizens carry a ±0.25 m box
that follows them and they walk the lane. Sampled once, a pedestrian near the
kerb reads as a **0.75 m URGENT pinch** — and my first run produced six of them,
at plausible-looking regular intervals, all of which evaporated on a second
sample. `lane3.mjs` samples twice 1.5 s apart and drops anything whose bounds
moved (6 of 164). **Any permanent test must do this or it will cry wolf every
run.**

**2. Walk-based probing does not work here.** My first instrument walked the
player across the lane with real key input. It cannot: warping to the building
face puts the player *inside* the wall collider, so every face-outward
measurement is meaningless, and the numbers it produced (a recurring "0.41 m")
were an artifact. Calibrating on an empty stretch is what exposed it. The
collider list is both exact and ~2 s instead of ~10 min.

## Does this want a permanent test? Yes — and it is cheap

**Strongly yes, and this is the clearest case for one I have seen in this
project.** The lane is a *global invariant violated by local edits*: five
builders added furniture today and not one of them can see the others' work, so
no builder can measure it and the desk cannot either. That is the exact shape of
thing a test exists for, and an audit only tells you about the day it ran.

For **builder A**, who owns `scripts/**`:

- **No new export is needed.** `__ct.colliders()` is already exposed
  (`crosstown.ts:508`), which is what makes this a two-second check.
- **Assert the minimum static gap ≥ 0.80 m** (the urgent line) and **warn under
  1.00 m**. Today's world passes at 0.89 m, so it goes green on landing and
  stays honest.
- **Also assert the baseline** — the clear kerb-to-wall span, currently 1.70 m.
  That catches a regression in the wall inset itself, which is the thing that
  actually matters and which no per-object check would notice.
- **Sample the collider list twice and drop movers**, per the false positive
  above. Without it the test fails randomly depending on where four pedestrians
  happen to be standing.
- `scripts/lane3.mjs` is the working implementation to lift from; it runs in
  about two seconds and needs no screenshots.

The one judgement call for the desk: **at the current 0.30 m wall inset, six
lamp posts and four trees sit permanently at 0.95 m.** A test asserting ≥ 1.00 m
would fail on landing against furniture nobody wants moved. Either assert 0.80 m
now and tighten to 1.00 m after the inset is given back, or fix the inset first
and assert 1.00 m immediately. I would do the latter — the inset fix is one
number and it also closes interior finding 18.

## Coverage

- Static colliders only, by design; moving bodies are reported as a class and
  excluded individually.
- Sampled every 0.10 m along each walk. A pinch narrower than 0.10 m in its run
  direction could fall between samples.
- **Colliders, not meshes.** Anything that overhangs the walk without a collider
  — bunting, fascias, stallrisers, the sign boards — does not appear here. It
  cannot narrow the lane, but it can look like it does, and the user's original
  complaint was partly visual. A mesh-based overhang pass is a separate job.
- The alley, the park interior and the car lot interior are not walks and were
  not swept.
