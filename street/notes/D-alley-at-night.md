# The alley at night, measured — and nothing is wrong with it

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
