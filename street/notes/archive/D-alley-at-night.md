# The alley after dark and in the rain, measured — and nothing is wrong with it

A null result, filed with its numbers. `ct/alley.ts`'s own `tag()` comment ends:

> *"Found by SHOOTING THE ALLEY AT NIGHT, which nobody had done — all eight
> alley shots were 13:00. A check could not have told me: the tags were exactly
> as bright as they were designed to be."*

That was one shot, one fault, one fix. Nobody has had NUMBERS for the alley after
dark, so I took them — and they say the alley is fine, which is worth writing
down as firmly as a fault would have been.

## What I thought I saw

At 23:00 (`shots/Dn-mouth.png`) the dumpster, the milk crates and the paper
litter look conspicuously brighter than the brick behind them. That is the
GOTCHAS §22 silhouette — *"a prop that set both stood at full daylight brightness
at midnight while the block behind it went dark"*.

## What is actually there

Night/day luminance ratio per material, over the alley's own box
(x −13.6…−7, z −43.5…−37), sampled at 13:00 and again at 23:00:

```
   4.5%   n=24   flattened cardboard   opaque
   4.5%   n=12   folded newspaper      opaque
   4.5%   n=10   milk crate            opaque
   4.5%   n= 2   the cat               alphaCut
   4.5%   n= 1   the alley floor       opaque
   4.9%   n=16   street (shells etc)   opaque
   6.2%   n= 2   the alley flanks      opaque
  11.5%   n= 2   graffiti: KOBRA, SNAK alphaCut
  39.8%   n= 1   graffiti: REZO        alphaCut
```

**Everything the eye called bright is at 4.5%, the same as everything else.** The
litter is not glowing; it is pale tan against near-black brick, and a ratio is
not a contrast. The eye compares neighbours, the number compares a thing to
itself, and on this evidence the eye was wrong.

## The one real outlier is the lighting model working

REZO sits at z −37.05. The alley runs −43.5…−37, so that is the MOUTH, on the
street. KOBRA (−39.3) and SNAK (−43.45) are deep inside and both land on 11.5%,
the value `ct/alley.ts` already documents for the tags. REZO is 3.5× brighter
than its two siblings because it is the one within reach of the street lamps.

Same art, same construction, same material, different result — and the
difference is where they stand, which is what a lamp is for.

## Filed as nothing, deliberately

§22 ends: *"And check before you file. I reported this twice as a bug in
`ct/props.ts`. It was not."* This is the third time that trap has been walked up
to and the second time it has been walked away from with numbers rather than an
impression.

`scripts/nightgrade.mjs` agrees over the same box: 0 materials graded and not
moved, 0 DoubleSide cut-outs in the transparent sort queue, and the 3 it lists
under §22 are FrontSide, where the sorting harm cannot reach them.

## What changed, and it is one line

`scripts/D-look.mjs` takes `SHOT_HOUR` now, defaulting to 13. Looking at any of
my areas after dark used to mean editing the script, which is why all eight alley
shots were taken at 13:00 and why the tag fault survived as long as it did.

```sh
SHOT_HOUR=23 SHOT_URL=http://localhost:4181/ node scripts/D-look.mjs mouth drain
```

The default stays a DAY hour on purpose: `D-walk` measured that at a night hour a
600 ms settle reads the ungraded world one run in eight, and `lib/clock.mjs`
returns when the grade is actually on screen rather than after a sleep.


---

# In the rain: it soaks, and it correctly does NOT puddle

Second condition, same method, and both halves came back null. Filed so the
investigation is not repeated.

## It soaks, and the file said otherwise

`ct/alley.ts` carried a measurement in the present tense with no "after" beside
it — *"road 67.1 → 28.0, −58%; alley floor 54.4 → 51.1, −6%. The street soaked
and the alley stayed dry, in the same downpour."* Read today that says the fault
is open. Re-measured from material colours, standing in the alley, 13:00 dry
against 14:00 raining:

```
road planes   -12.1%
alley floor   -12.1%     the same, to three figures
```

The `wet()` call registers the floor with `updateRain` and it works. The comment
now records the repair as well as the fault.

## No water gathers at the drain, and that is CORRECT

Counted at 14:00 with the rain on: **69 flat translucent ground sheets elsewhere
in the world — 38 props, 24 lot, 6 vice — and 0 in the alley.** The five sheets
inside the alley box are the litter's own contact shadows, at the five litter
positions, not puddles.

The alley is the one place in this world with a deliberately designed low point,
so "no puddle at the low point" looks like a gap. **It is the design, and the
design is already written down four lines above the drain:**

> *"What a yard gully actually leaves is DAMP — the paving stays wet longest
> where the water sits longest, so it darkens toward the drain smoothly and has
> no edges at all."*

A gully that works does not pond. Standing water at a functioning drain would
contradict both the rationale the user approved and the radial wash that replaced
the sixteen-stroke starburst they rejected. **So: do not add puddles to the
alley.** That is the finding — a decision recorded, not a defect.

## Two ways the measurement was wrong first

- **Ask the world which hours rain.** `props.ts` publishes `rainAt` on
  `scene.userData` so nothing mirrors the formula. I took "a rainy day hour" from
  another builder's note and used 15:00, which is DRY; the first comparison was
  dry against dry and correctly showed 0.0%.
- **Never measure the road by pixels.** Cars and pedestrians cross the frame: the
  same dry hour read **57** in one pass and **32.9** in another, a spread of 24
  with nothing changed. The alley read 42.9 three times running because it has no
  traffic. GOTCHAS §29 — say whether the number describes an empty world or a
  lived one — and a road luminance is a lived number whether you meant it or not.

The control is what caught it: three dry hours against each other *before* any
rain comparison. Spread 0.0 in the alley, spread 24 on the road.
