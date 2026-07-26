# The fleet, one careful pass, each side checked on its own

Folding the door misalignment and the texture review together as instructed.
This supersedes the four ranked findings in `H-fleet-texture-review.md`: two
were right, one was wrong and is retracted here, one is still open.

## The sentence that is part of the deliverable

**I checked each side of every vehicle separately.** Not by looking at one flank
and reasoning about the other — by reading each face's OWN painted texture and
converting its texel columns to car-local metres through THAT FACE'S OWN UVs.
The two columns in every table below are two independent computations over two
different sets of vertices and two different canvases. Where they agree, they
agree because they were each measured, not because one was negated.

## 1. The mirror — FIXED, and it was in two places, not one

`[sideT, sideT, ...]`: one texture handed to both side faces of a box. A
BoxGeometry's opposite faces carry UVs running in opposite world directions, so
the near flank painted correctly and the far one back to front. Measured on the
geometry, all four kinds agreeing:

```
  -x face   z = +len·u + faceZ0     u = 0 is the FRONT   <- matches the painter
  +x face   z = -len·u - faceZ0     u = 0 is the REAR    <- reversed
```

Both flanks now get their own paint, mirrored at the single place every
feature's column is derived, so a feature added later cannot forget it.

Shut lines read back out of each flank's own texture, in car-local metres:

| | +x flank | −x flank | plan |
|---|---|---|---|
| sedan | −0.98, 0.19, 1.08 | −0.98, 0.19, 1.08 | −1.0, 0.2, 1.1 |
| hatch | −0.83, 0.75 | −0.83, 0.75 | −0.85, 0.75 |
| pickup | −1.01, 0.46 | −1.01, 0.46 | −1.0, 0.45 |
| van | −1.44, −0.14 | −1.44, −0.14 | −1.45, −0.15 |

**And the same fault was on the pickup's bed** — the vehicle in the user's
shot. `outM` was one texture for both walls and both tailgate faces. Verified
against ground truth rather than against itself: the rear wheel is at z = 1.65,
and the arch now lands at **1.621 on the −x wall and 1.652 on the +x wall**,
from texel columns 27–42 and 15–30 respectively — the same world position within
one texel, reached from two different column ranges because one face is mirrored
and the other is not. Before, the +x wall put the arch at about z 1.25: 0.40 m
from its own wheel, on every pickup.

## 2. The doors — FIXED

With both flanks reading the same, the sedan's remaining misalignment became
measurable. Its panes put the rear pillar at (1.05 + 1.15) / 2 = **1.10**; the
shut line was painted at **1.40**. So the pillar had no shut under it, the shut
had no pillar over it, and the quarter light at [1.15, 1.35] fell INSIDE the
rear door instead of behind it. The shut moves to 1.10, which answers both
halves of the request at once — the divider is now at the same x as the shut
line below it, and the quarter window is behind the back door.

Hatch, pickup and van already agreed and are untouched. Handles sit on rows 3–4
of a 20-row flank, i.e. just under the window line, on every kind.

**The greenhouse was never mirrored.** `loftCabin` gives both side quads the
same `uOf(z)`, and the panes read identically on both flanks on all four kinds.
My first probe said otherwise and was wrong: it was picking up the windshield,
rear glass and roof quads, whose vertices sit at BOTH x signs with u pinned to
0 and 1, which dragged them into the fit.

## 3. The coachline through the arch — RETRACTED, I was wrong

I reported this as HIGH, "confirmed visually". It is not true, and a character
dump of the flank shows why: the arch ellipse is filled AFTER the stripes, so it
covers them. At the chrome strip's row, inside the arch's column span, the
texels read arch colour, not chrome. The stripes do not cross the arch.

I called it from a screenshot. The thing I was actually looking at is finding 4.

## 4. The dark blotch — HALF FIXED, and the other half needs a ruling

Two contributors, and they are separable:

- **The mottled boundary — fixed.** `dither()` ran last, scattering 120 random
  texels across the arch as well as the body, so its edge broke up. A hard edge
  reads as an arch; a mottled one reads as a stain. The grain now goes down
  first and the arch is cut into it. Same body grain, clean arch edge.

- **The arch and the sill are the same colour — NOT fixed, deliberately.**
  Measured off the painted texture: the rocker shadow is `rgba(0,0,0,0.35)` over
  the body = 90,84,58, and the well is `body × 0.34` = 83,78,52. **Seven levels
  apart.** They merge into one dark mass across the bottom three quarters of the
  flank, which is the "large soft DARK BLOTCH". It also broke one of my own
  probes: asked for the darkest run on the bottom row, it returned the whole
  panel.

  I have not changed it because the instruction was explicit: *"The bed floor,
  the wells and the arch paint you already fixed are good — do not disturb
  them."* Darkening the well to about `× 0.18` (→ 62,58,40) would separate it
  from the sill and still carry the body's colour, well clear of the tyre's
  16,17,20. **That is a one-line change and it needs a yes.**

## 5. Texel density — STILL OPEN, and still blocked on the same question

Unchanged from the review: the flank canvas is a fixed 96 × 20 whatever the
panel's real length, so density runs 20.9 px/m on a van to 47.1 on a hubcap, and
every flank is anisotropic — texels about twice as tall as they are wide. That
is the largest change of the four and it touches every canvas.

**The question I was told to ask rather than answer by reading A's file, still
unanswered:** how does the masonry helper derive its canvas — round to whole
texels per metre and accept a fractional canvas, or fix the canvas and accept a
fractional density? The fleet has panels from 0.34 m to 4.6 m, so the rounding
rule decides whether a hubcap and a van flank can share a density at all.

## Untouched, as instructed

The wheel wells, the bed floor and the arch paint colour.
