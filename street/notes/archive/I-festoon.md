# The lot lights up — and the chevrons on the asphalt were never mine

Builder I, 2026-07-25. The `## Then` standing brief: *"i like your initial
aesthetic but i want it refined and a try hard version of it"*, *"do a high
effort sleazy used car lot… do some research into what old sleazy used car lots
looked like"*, graded by the user's own method — *"take screenshots yourself and
grade it and make sure you are impressed with it. be skeptical."*

## What I graded badly

`scripts/I-walk.mjs` walks the lot the way a customer does — in off the
pavement, through the gate, down the aisle reading windshield prices, to the
office, and back out the way a car leaves — 14 frames, day and night, each
verifying it landed where it was aimed.

**The night was the worst thing in the lot, by a distance.** The yard was a
black rectangle with one floodlight, two neon signs, and eleven dark lumps where
the stock is.

That is backwards for the typology. A used car lot is the **loudest lit thing on
its block** after dark — the entire business model is that the stock is visible
from the road at 9 p.m. And the one piece every photograph of a 1990s lot has,
which this one did not, is **overhead festoon**: bare bulbs on a sagging cable,
strung the length of the yard over the rows.

**It does not contradict *"make the unilluminated stuff darker, it should feel
scarier at night"***, which is the request the `printed` pass served. That asks
for a bigger RANGE between lit and unlit. This is the lit half; everything the
bulbs do not reach stays exactly as dark as it now is.

## What I built

Two festoon runs down the aisle, each on its own pair of slim masts, 15.5 m of
catenary sagging 0.93 m, a bulb every ~1.55 m — 20 bulbs, 20 pools.

A bulb is **two meshes on purpose**: an opaque glass bead the world's grader
dims like anything else, and an additive halo that is invisible at noon and
comes up with `f.night`. Painting one mesh brighter would have made a bulb that
glows in daylight, which is the `isSelfLit` mistake wearing a different hat.

The halos **turn to face the player** off `Frame.px/pz` — there is no camera on
`ctx`, and yaw is the whole of it for a viewer on the ground. Without it a bulb
seen from along its own run is a disc edge-on, and the runs point the way you
walk, so that is most of the aisle.

**An unplanned win, and the better argument for the whole thing:** in daylight
the two receding cables give the aisle the depth cue it never had.
`shots/I-wd-06-aisle-near.png` against the same frame before — the 23 m now
reads as deep, which is the standing *"car lot needs to be deeper"* complaint,
answered by perspective rather than by more asphalt.

## Three things I got wrong on the way, each caught by measuring

**1. A mast stood 0.153 m inside a car.** The far mast of the south run landed
in the back-corner car — those two are raked 1.15 rad and throw far more of
themselves along x than the main rows do. Caught by `lot-clearance` and
`I-clip` on the first run after I added them, which is exactly why those got
built before this. Masts moved 1.2 m forward to flank the office; closest
car-to-fixture back to **0.290 m**.

**2. One stretched pool per run read as grey polygons.** A radial disc scaled
across 18.5 m stops being a pool — its steps spread into metre-wide bands lying
on the asphalt. Replaced with **one small pool per bulb**, which is both what a
festoon actually throws and what the floodlight beside it already did.

**3. The halos were lampshades.** At 0.95 m the near bulbs read as glowing
patches *on the brick* rather than as points of light. A bare bulb's corona is a
hand's width: 0.52 m, and brighter.

## The chevrons were pre-existing, and I nearly claimed them

While grading my own new pools I found hard-edged grey chevrons on the asphalt
and assumed they were mine. **They are not.** `shots/I-n-back-out.png`, taken
last session before the festoon existed, has them plainly.

They are the floodlight's **13 × 9 m pool**: `stepDisc` drew exactly five rings
regardless of size, so across that throw each band is **1.3 m wide**, and at the
grazing angle you actually walk at they read as chevrons.

The aesthetic is deliberate and stays — *"stepped into hard rings rather than
blurred, because nothing else in this world is a smooth gradient."* What was
wrong is that the step count did not scale with the disc. `stepDisc` now takes
`steps`, chosen from the disc's real size, so every pool in the lot has bands of
roughly the same width **in metres**. The old five-ring endpoints are preserved
exactly, so the two call sites that did not change did not move.

`shots/I-wn-12-drive-out.png` — the chevrons are gone and the pool grades.

## `mods-dim` is green, so it is registered — as its author intended

C wrote `scripts/mods-dim.mjs` and deliberately held it out of the suite:

> *"it stays unregistered until this lands: it is red on this finding, and
> reddening the shared suite over something I cannot fix would hand the block my
> problem."*

The finding was `isSelfLit` holding ~40 printed sheets at full daylight. It has
landed. The last material in the module with nothing saying why was the
floodlight's **lens** — the glass face of a fixture that is ON after dark, the
one surface here that should stay bright — so it now declares itself the way its
own halo and pool do.

```
  before this session   565 dim,  2 declared,  54 holding and not saying why
  after the printed pass 623 dim,  2 declared,   1
  now                   715 dim, 43 declared,   0
```

Registered in `scripts/checks.mjs`, green, selftest passes.

## Inert where it should be

`textures=b949a544 structure=f1324cf0` identical across two captures. Bulb glass
is a **constant** colour — deliberately, because `notes/A-fingerprint.md` records
three of the casino's festoon bulbs alternating lit/unlit and making
`scenedump` non-reproducible. Only opacity and halo yaw move here, both
deterministic.

*(Aside for A: that note attributes those 196 bulbs to the car lot. They are the
casino's — `ct/vice.ts:562`, `chaseOn`/`chaseOff`. The lot had no festoon at all
until this commit.)*

## Still not fixed, and honestly ranked

- **The aisle floor is bare.** ~40% of the frame at eye level is empty asphalt.
  The festoon fixed the upper half of that composition; the ground is still
  under-dressed for a lot that has stood twenty years.
- **All three "not parked" cars are on the left row** — hood up, jacked, on
  blocks — so one row is every damaged car and the other is clean stock.
- **The office is not enterable.** For *"how does one even enter, drive a car off
  the lot"*, the room where you haggle is the missing verb. That is an interiors
  job, not a one-liner.
