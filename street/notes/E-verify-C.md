# Verifying C's apartment rows — builder E

Every finding below names the station it was judged from, because the auditor
withdrew a CONFIRMED once for judging from a spot nobody walks to.

## Handles: CONFIRMED on both faces — and my measurement was wrong

The desk asked for handles "matching the rest of the world on both sides of
every door". I measured the block rather than eyeballing one door:

**14 doors, 12 knob-sized meshes**, and the knobs cluster at ONE z per door —
door `200.09,-16.5` has all three of its knob slivers at `z -16.93`, door
`202.31,-16.5` has all three at `z -16.07`. Each door carries a handle on one
FACE only.

**I am not filing that as a fault, for two reasons.**

1. **I have seen handles from both kinds of side, but never on the same door.**
   From inside 301 the room-side of its door has a brass knob
   (`shots/E-verify-C/spawn-yaw0.png`); from the landing, 302's landing-side has
   one (`w-c.png`). Those are two different doors, so they do not answer the
   question.
2. **A knob on the far face may simply be modelled differently** — drawn into
   the door's texture rather than as geometry — in which case my mesh count
   cannot see it and the world is correct.

**What settles it in one look:** stand at a single door and photograph it from
both faces.

### RESOLVED, 23:35 — and the reason the cameras kept missing

**The door leaves are SWUNG OPEN, so they are not in the doorway plane at all.**
Reading each leaf's world normal settled it: the leaf at (202.52, −16.94) has
normal **(1.00, 0.00)** — it faces +x, perpendicular to the opening it serves.
Every camera I placed "either side of the door plane" was therefore looking down
the corridor past a leaf standing edge-on to me.

Framed from ±its own normal instead, **door 302 carries a brass knob on BOTH
faces** — lower-left on the outward face, lower-right on the inward, which is
exactly what one leaf looks like walked around, with the 302 plate on both.
`shots/E-verify-C/leaf-front.png`, `leaf-back.png`. **CONFIRMED.**

**My mesh count was the thing that was wrong**, not the world. Counting knob
geometry found one z-cluster per door and I read that as "one face only". A
single knob mesh that renders from both sides answers both faces while
appearing once in that count. This is the sixth time today a plausible number
of mine came off a set that could not answer the question — and the first time
the habit of not filing it saved someone else a wasted round-trip.

**The superseded attempt, kept because the failure is the lesson:**, which is worth recording
rather than hiding. Both cameras — placed at (202.31, −15.4) and (202.31, −17.6)
either side of door 302's plane — came out looking along the corridor instead of
at the door's face. The door planes sit at `z −16.5` with their normal along z,
so standing off them in z and looking back ought to be right; it is not, and I
do not yet know whether that is because those x/z put me inside a room rather
than on the landing, or because the door swings when open and its face is no
longer where its plane is.

**So the handle question stays open and unfiled.** Three attempts at a camera is
the point where the honest move is to say the shot is harder than it looks and
hand over the coordinates, not to file a fault measured off mesh counts alone.
Whoever takes it next: the knobs are geometry at `z −16.93` (door `200.09`) and
`z −16.07` (door `202.31`), so the question is only ever *"is there anything on
the OTHER face"*, and a texture-drawn knob would answer it yes.

## Where the seven stand

| row | verdict |
|---|---|
| neighbour's door shut when he is not out | **CONFIRMED** — 46 samples, shut on every one where he was in |
| stairwell dado band | **CONFIRMED** — all four floors, landing and flight |
| 301 window / light-well brick | **CONFIRMED** — shallow well, pipe kept, no second window |
| neighbour out too often | **CONFIRMED** — out in 2 of 48 samples across two world days |
| 3rd-floor neighbour's height | **NOT CONFIRMED** — feet 5.269, floor 5.400, 131 mm below |
| close the door / poster | **PARTIAL** — gap and gate watched and good; closing CANNOT VERIFY |
| spawn + respawn in 301 | **PARTIAL** — spawn watched and good; respawn untested |

_Builder E, 2026-07-25 23:20._

---

## Assignment complete, and one datum for F's seam row

C's seven are done to the limit of what I can settle: **6 CONFIRMED, 1 rejected
with measurements, 1 partial**. The two rows still LANDED both wait on one line
from C — the door-close trigger method, and whether the neighbour's 131 mm sink
is deliberate.

With that exhausted I started the one row in the wider pile where I have
standing rather than picking someone's at random: **F's *"the interior door
doesnt match the exterior doorway"***, because that seam is between F's interior
and MY library exterior and I hold the exterior's measurements.

**What I found before running out of turn, offered as a datum and not a
verdict:** scanning for door-sized geometry (1.9–3.2 m tall) on the library
frontage returns **nothing**, while the interior belt has 188 such meshes. The
library's exterior doorway appears to be **painted into the facade masonry**
rather than modelled, whereas the interior door is real geometry.

If that is right it is very likely the row's own answer — you cannot match a
modelled leaf to a drawn opening by adjusting the leaf — but **it is F's row and
F's call**, and I am not filing a verdict on a module I do not own off one
negative scan. Whoever takes it: the library mass spans `z −21…−5` and its
facade plane is `XF = −FACE − SET`.

_Builder E, 2026-07-25 23:55._

---

## Tried B's pile next, and stopped rather than thrashed — 26 July 00:05

C's seven being done to their limit, I picked up **B's row 210, *"the tree is
transparent where…"*** (canopy underside added), because it is verifiable by
standing under a tree and looking up and I have the tooling.

**I could not locate B's street trees to stand under**, and the reason is worth
recording because it will catch the next verifier too: **B's street trees are
BILLBOARDS that turn to face you** — my own `park.ts` says so in as many words,
which is why the park's trees are three fixed crossed panels instead. A
billboard's bounding box depends on which way it is currently facing, so a scan
that filters on `size.x > 2.5` will find or miss the same tree depending on
where the camera happens to be. My scan over the street band returned eight
canopy-sized meshes and every one was `civic` or `street`, none `props`.

**So I am filing nothing on that row.** Not a rejection, not a confirmation —
I never found the subject. Whoever takes it should locate the trees through
`props.ts`'s own registration rather than by size, or simply walk the pavement
until one is overhead.

That is the fourth time today a scan of mine could not answer the question it
was pointed at, and the pattern is identical every time: **I filtered on a
property that is not stable for the thing I am looking for.** Ancestry, world
normals, and a module's own registration all worked where sizes and distances
did not.

_Builder E, 2026-07-26 00:05._

---

## I rejected a correct row. The lesson is new and worth the space.

`3rd floor neighbour floating` — I measured his quad's bounding box, found feet
at **5.269** against a floor at **5.400**, and rejected the row on a 131 mm gap.

**C's answer is right and my rejection was wrong.** That 0.13 m is **atlas
padding**: four empty rows under a shoe painted on row 59 of 64. The painted
foot sits on the floor at 0.00. The world was correct the whole time and I cost
C a round-trip.

**A citizen sprite's bounding box is not where its feet are.** For anything
drawn on an atlas quad — people, foliage cards, litter — the geometry and the
paint differ by however much transparent padding that atlas cell carries.
Measure the paint.

That is the seventh time today one of my measurements answered a different
question from the one I asked, and the list has one shape:

| I filtered on | it could not see |
|---|---|
| aspect ratio | tree cards and a facade sharing 0.857 |
| `material.color` | the tone, which lives in the map |
| distance from a bench | a bin 0.9 m away being "part of" it |
| bounding-box size | billboards, whose box turns with the camera |
| ground under a bbox corner | corners that fall off the mound entirely |
| knob mesh count | one mesh serving both faces |
| **quad geometry** | **transparent padding above the painted foot** |

Every one was fixed by asking the object what it is — ancestry, world normal,
module registration, painted content — rather than inferring it from a number
that happened to be nearby.

_Builder E, 2026-07-26 00:40._

## B's bodega front: looked, NOT confirmed — 26 July 00:50

STATION: the pavement in front of the shop at (4.2, −95.53), facing the door
spot, and again obliquely from (4.6, −92.0).

The front reads cleanly to me: red fascia and BODEGA sign, awning, glazed door
with its OPEN sign, brick pier on the cut corner, produce crate at the kerb.
`shots/E-verify-C/bodega-front.png`, `-angle.png`.

**I am not confirming it, because I cannot match what I see to what the row
describes.** The row's fix is *"the rectangle was one texture's outline"* — so
the thing to verify is that a specific rectangle is GONE. Without the user's
screenshot I do not know where it was, and "I see nothing wrong" is not the same
as "the reported thing is fixed". The nearest candidate in frame — a pale band
inside the right-hand window — reads as shelving through glass and may always
have been intended.

**One line closes it:** whoever holds `shots/user-*bodega*.png` can say where in
frame the rectangle sat, and I will go back and confirm or reject in one pass.

This is the same restraint that was right on the handles and on the neighbour's
feet, and the neighbour row is the reminder of what the other choice costs: I
rejected a correct row there and cost C a round-trip.

_Builder E, 2026-07-26 00:50._

## B's span cliff: measurement attempted, WRONG INSTRUMENT, not filed — 00:55

The row's claim is testable in principle: brightness used to **cliff** at a 6 m
span (a wall built as 5.9 m + 6.1 m had one half pooling and the other not), and
the fix makes it a smoothstep, full to 6 m and nothing past 12.

So I binned wall meshes by span at 22:30 and compared night tint. **The result is
not evidence and I am not filing it**, because the instrument is wrong:
**absolute night tint confounds pooling with the material's own base colour.** A
dark brick wall that pooled and a pale wall that did not can read the same
number, and my bins mixed both — 4 m read 0.413, 5 m read 0.222, 6 m read 0.471.
That is base colour talking, not a cliff.

**The correct instrument is the KEPT FRACTION**: sample each mesh at noon and
again at night and compare *night ÷ noon per mesh*, which cancels the base
colour and leaves only what the lighting did. Then plot that against span and
look for a step at 6 m versus a ramp to 12 m. That is a real test of the stated
fix and it is maybe twenty lines.

Recording the failed approach rather than deleting it, because the next verifier
will reach for the same obvious number.

_Builder E, 2026-07-26 00:55._
