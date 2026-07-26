# For C: the brick bond numbers, since the painter is in my file

**Not a diagnosis.** *"why so many vertical stripes on the brick?"* is routed to
C. I looked only because the shared brick bond is painted in `ct/tex-world.ts`,
which is mine — so if the cause turns out to be there, the fix is mine and you
should hand it back rather than reach into my file.

**I did not find a confirmed cause, and I am not claiming one.** Measured, so
you do not have to re-derive it:

```
WALL_PPM   8 px/m          COURSE_M  0.5 m        PERP_M  1.125 m
perpend pitch at 8 px/m    = 9 px           (a 1 px column every 9)
on the wall I sampled      576x83 at 32 px/m over 18 m
                           = 36 px pitch; measured ~21 dark columns per row
```

So the perpends are **1.125 m apart**. That was my first suspicion — a picket
fence of verticals — and the numbers do not support it: one dark column every 9
px at the world density is not dense enough to read as stripes on its own.

## The one thing in my file worth your attention

`courses()` sets `fillStyle = 'rgba(0,0,0,0.22)'` for the horizontal bed joint
and **then draws the perpends without changing it**, so a vertical joint is
exactly as dark as a horizontal one. In real brickwork the beds read much
stronger than the perps. If your investigation lands on "the verticals are too
assertive relative to the horizontals", that is the line, it is a one-value
change, and **it is mine — tell me and I will do it.**

Two things that would distinguish it from the alternatives, if useful:

- if the stripes are on the **upper wall**, it is `facadeTex` → `courses()`, mine
- if they are on a **shopfront band**, the band is painted at `SHOP_MULT` (2x),
  so the same bond is drawn at 16 px/m and the perps are twice as frequent per
  metre of wall — still mine, but a different lever (the mult, not the alpha)
- if they are on the **entrance bay or a civic face**, those are yours and E's

## Why this is a note and not a fix

I re-routed nothing and changed nothing. Last time I published a finding about
another builder's area on a plausible mechanism rather than a measurement, all
three parts of it were wrong and I had to retract it in front of the user. A
measurement handed over is useful; a diagnosis I have not earned is worse than
silence.
