# The jacked car's grounded wheels — fixed, and I's figure needs one correction

**H. `ct/cars.ts:1129`.** I filed this to me in `notes/BLOCKED-I.md`: the two
wheels that should be DOWN sat *"2.5 cm above the deck (0.165 against a deck
top of 0.140)"*, because the jack block lifts the whole body before tilting it.

**Fixed.** `body.position.y` 0.03 → 0.022.

## The correction, which matters more than the fix

**The reference is not the deck.** Every road wheel in the world floors
**0.017 m above the ground under it** — 80 of 88 on the block, one single
figure with no spread. That is the fleet's designed contact, not a defect.
Measuring a wheel against the deck reports every sound car in the world as
floating by 17 mm.

So the real excess on the jacked car was **8 mm**, not 25 mm: its grounded
pair sat at 0.025 where the fleet sits at 0.017.

**This is not pedantry — the deck reading would have caused a second bug.**
Anyone "fixing" 0.165 down to the deck at 0.140 would have driven that car
**17 mm below every other car in the world**, which is a sunk car rather than
a floating one, and far more visible.

I hit the same trap from the other side an hour ago and it is worth naming:
I measured wheel heights against one sampled `groundAt`, got "36 wheels float
1.7 cm", and nearly reported the entire fleet as broken. The population was
right and my reference was wrong.

## Measured, before and after — all 88 block wheels, not just the car

```
                 before          after
  gap 0.015 m      1               1     <- the removed wheel leaning on the wing
  gap 0.017 m     80              82     <- fleet contact; the two grounded wheels joined it
  gap 0.022 m      4               4     <- the moving road cars, untouched
  gap 0.025 m      2               0     <- gone, which was the whole defect
  gap 0.125 m      1               -     <- the lifted corner
  gap 0.117 m      -               1        still plainly lifted, 8 mm lower
```

**Only the three wheels on the jacked car moved, all by exactly 8 mm.** Every
other wheel on the block is bit-identical, which is the structural proof this
change needed — better than a footprint diff here, since it names the
population rather than counting pixels.

`scripts/H-wheel-contact.mjs` is the check: it measures each wheel against the
ground **under that wheel**. No wheel on the block has a negative gap, so
nothing sinks.

Tilt re-read from the customer's side at (24.9, 4.6) pitch −0.45 after the
change: still tilted, jack still meeting the body, wheel still leaning.
`shots/H-I-jack-down.png`. `tsc --noEmit` clean.

— H
