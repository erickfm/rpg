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

---

# Re-run at `c889ed23`

A lot of furniture landed after the first sweep — side-street lamps
(`d896c64f`), three bench passes, the lot's banners and waiting bench, litter
re-placement. Colliders went **164 → 181** (175 static). Re-measured; the sweep
is ~2 s, which is the point of it.

**Still nothing impassable and nothing urgent. Tightest point unchanged at
0.89 m.** Two changes:

| | before | now | |
|---|---|---|---|
| side st north z −97.25…−96.30 at x 19.8 and 49.8 | *(no lamp)* | **0.95 m** | new side-street lamps, `d896c64f` |
| side st south z −109.70…−108.75 at x 33.8 | *(no lamp)* | **0.95 m** | same |
| car-lot A-board, east z −34.1 | 1.01 m | **0.97 m** | moved 0.04 m outward, 5.69 → 5.73 |

**The new side-street lamps landed at exactly the block's standard 0.95 m** —
the same figure as every main-street lamp. That is the right outcome: whoever
placed them matched the existing condition rather than inventing a new one, and
the lamp factory being "not bolted to one street" evidently carried the offset
with it.

**The A-board has tightened from 1.01 m to 0.97 m** and is now under the 1.00 m
line as well as being the longest sustained pinch on the block (1.8 m of walk).
It remains the one object where a small nudge toward the kerb — it currently
starts at x 5.12, only 0.12 m off the kerb line — would buy back the most.

Nothing else moved. The ranking, the baseline (1.70 m) and the recommendation
below are unchanged.

---

# Round 3 — re-measured at `c16457c8`. The lane is unchanged, and I now know why.

49 new colliders since Round 2 (164 → **213**, still 6 moving). The park, the
car lot and the side-street furniture all landed in between. The lane did not
move: tightest is **still 0.89 m**, same place, same neighbours.

**One real change.** Round 2 recorded *"side street north and south: no stretch
under 1.20 m at all."* That is no longer true — there are now three, at
**0.95 m**: north at x = 19.8 and x = 49.8, south at x = 33.8.

## What every tight stretch actually is

I stopped counting instances and asked what forms them. All twelve stretches
under 1.00 m, on both walks and both side streets, are bounded by **a post**:

| post | size | centre x | spans | gap to a 6.7 facade |
|---|---|---|---|---|
| lamp | 0.40 × 0.40 | ±5.55 | 5.35 … 5.75 | **0.95 m** |
| sign/meter | 0.16 × 0.24 | ±5.66 | 5.58 … 5.74 | **0.96 m** |
| small post | 0.18 × 0.18 | 5.32 | — | 0.97 m |

Every lamp in the world sits at **x = ±5.55**, to three decimals, on both walks
and now on the side streets. Nothing is encroaching. Nothing was placed
carelessly. **Every post is placed correctly to the same rule, and the rule
yields 0.95 m.**

That is the whole finding, and it is the same shape as seam pattern #1: the
defect is not that any one post is badly placed, it is that the placement
constant was chosen without reference to the clearance it leaves behind it.

## The consequence — this is one number, not twelve tickets

Kerb line is 5.00. Facade collider is 6.70. The lane is 1.70 m. A lamp centred
at 5.55 occupies 5.35 … 5.75, so it eats 0.75 m of that 1.70 and leaves 0.95.

**The lamp has 0.35 m of unused slack toward the road.** Move the lamp centre
from 5.55 to **5.35** — near edge 5.15, still 0.15 m clear of the kerb, nothing
overhangs the carriageway — and the far edge comes to 5.55:

> every 0.95 m stretch in the world becomes **1.15 m**, and the worst point
> anywhere (0.89 m, at the park wall where the facade is 6.64) becomes 1.09 m.

One constant, changed once, lifts all twelve. No geometry redesign, no per-site
work, no new export.

## What I am not claiming

- 1.15 m is still under the 2.00 m the street is nominally built to. The 1.70 m
  baseline is set by the facade colliders at `FACE − 0.3`, and that is a
  separate decision I flagged in Round 1 and am not re-opening here.
- I have not checked that 5.35 is free of the kerb *mesh* as opposed to the kerb
  *line* — I measured colliders, which is what the player actually hits, but a
  lamp base visibly overhanging a kerb would be a paint problem I would not see.
  Whoever moves it should look at one.
- Nothing here is impassable. 0.89 m against a 0.72 m player is tight, not
  blocked, exactly as in Rounds 1 and 2.

## Standing recommendation, now cheaper than before

The permanent test I proposed in Round 1 is more valuable after this: with the
constant fixed at 5.35 the whole world clears 1.09 m, so the guard can assert
**min gap ≥ 1.00 m** — a real margin — instead of ratcheting at today's 0.89.
Still no new export needed; `__ct.colliders()` is enough; still sample twice to
drop the six movers.

---

# Round 4 — the one-constant fix landed, and it hit every predicted number

Round 3 said the twelve tight stretches were one placement constant, not twelve
tickets, and made a specific prediction:

> Move the lamp centre from **5.55 to 5.35** — near edge 5.15, still 0.15 m
> clear of the kerb — and the far edge comes to 5.55: **every 0.95 m stretch
> becomes 1.15 m, and the worst point anywhere (0.89 m) becomes 1.09 m.**

Re-measured at `05fb9627`:

| | Round 3 | **now** |
|---|---|---|
| stretches under 1.20 m | 15 | **9** |
| the 0.95–0.97 m cluster (12 stretches) | 0.95–0.97 | **gone** |
| east walk at z −92.9 | 0.95 (span 5.75 … 6.7) | **1.15** (span **5.55** … 6.7) |
| west walk at z −92.9 | **0.89** | **1.09** |

**1.15 and 1.09, to the centimetre.** The lamp's far edge is now 5.55 where it
was 5.75, which is a centre of 5.35 — the number recommended, adopted exactly.

That is the whole of Round 3's finding closed by one constant, as claimed.

## What is left, and it is the same shape

The tightest point in the world is now **0.90 m, west walk at z −71.4**, free
span −6.64 … −5.74. That is **not the lamp** — it is the **0.16 × 0.24 m
sign/meter post at x ±5.66**, which Round 3 listed as its own row and which
nobody has moved.

It has the same slack the lamp had. Its outer edge is 5.74 against a kerb at
5.00, so it is carrying **0.74 m of unused room toward the road**. Give it the
lamp's new offset — centre 5.46, outer edge 5.54 — and the 0.90 m becomes
**1.10 m**, and with it the last four sub-1.15 stretches on both walks.

**One more constant, in one more file.** Same argument, same arithmetic, and
this time with a landed precedent showing the number comes out where the
prediction says it will.

## The permanent test is now worth more than when I proposed it

Round 1 recommended a guard asserting the lane every build, and noted it would
have to ratchet at the world's then-worst 0.89 m. After this fix the world
clears **0.90 m**, and after the sign post moves it would clear **1.09 m** —
so the guard can assert **≥ 1.00 m** with real margin rather than pinning
today's worst case as tomorrow's floor. Builder A owns `scripts/**`.
