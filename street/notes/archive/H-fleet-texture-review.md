# Fleet texture review — findings, before any fixing

Asked for as a survey to be ranked, not a fix. Nothing in this note has been
changed yet. The bed floor, the wheel wells and the arch paint colour are
deliberately untouched.

## Method, and the sentence that is part of the deliverable

**I checked each side of every vehicle separately.** Four kinds — pickup, sedan,
hatch, van — from four positions each at standing height in daylight (13:00):
the +x flank, the −x flank, the front and the rear. Sixteen frames,
`shots/fleet-<kind>-<side>.png`. I did not shoot one flank and reason about the
other, because the fault below is *precisely* the one that survives that
mistake.

---

## 1. The two flanks are not the same car — HIGHEST

The user: *"the worker doesnt realize they need to confirm the logic
independently per side of the car."* Correct, and here is the mechanism.

`ct/cars.ts:550` builds the body slab with `[sideT, sideT, …]` — **one texture
handed to both the +x and the −x face**. A `BoxGeometry`'s opposite side faces
carry UVs that run in opposite world directions, so a shut line painted at world
z appears at z on one flank and at its mirror on the other.

The greenhouse does not mirror. `loftCabin` builds its own UVs from
`uOf(z) = (z − zbf) / (zbr − zbf)`, a function of world z applied identically to
both sides, so the B-pillar sits at the **same** world z on both flanks.

One is mirrored and one is not, so they can agree on exactly one side:

```
sedan, panel −2.25 … 2.25, shut lines painted at z = −1.00, 0.20, 1.40

  painted z    +x flank    −x flank      miss vs nearest glass pillar
    −1.00        −1.00       +1.00              0.05 m
    +0.20        +0.20       −0.20              0.30 m
    +1.40        +1.40       −1.40              0.50 m
```

Visible in `fleet-sedan-xplus.png` (handles under pillars, reads as doors) against
`fleet-sedan-xminus.png` (lines in the wrong places). **Every kind has this** —
it is one shared line of construction, not a sedan bug.

## 2. The dark blotch is the arch ellipse plus the dither pass — HIGH

Identified, as asked. It is not a bleed or a smear: it is the wheel-arch
ellipse, and two things make it read as one.

- **It is nearly the whole panel.** `ary = 0.38 × 40 = 15` rows drawn on a
  20-row canvas, centred on the bottom edge, so the arch occupies rows 5–20 —
  three quarters of a flank that is only 0.50 m tall.
- **`dither(g, 96, 20, 120)` runs AFTER it**, scattering noise across the
  ellipse's edge, so the boundary breaks into mottling instead of reading as a
  line.

`fleet-pickup-xminus.png` is the clearest frame.

## 3. The coachline runs straight through the arch — HIGH

Confirmed visually in the same frame. The stripes are full-width fills —
`g.fillRect(0, y, 96, 3)` — so the belt line, the chrome strip and the rocker
shadow all cross the arch region. A real coachline stops at the panel edge.

This one is cheap: paint the stripes, then the arch, then re-paint nothing —
or clip the stripe runs to the arch's x span.

## 4. No two panels share a density — MEDIUM, but it is the root of 2 and 3

The flank canvas is a fixed 96 × 20 **whatever the panel's real length**:

```
panel                 canvas   real metres     px/m across × up     ratio
flank, sedan          96×20    4.50 × 0.50     21.3 × 40.0          0.53
flank, hatch          96×20    3.80 × 0.50     25.3 × 40.0          0.63
flank, pickup         96×20    3.00 × 0.50     32.0 × 40.0          0.80
flank, van            96×20    4.60 × 0.50     20.9 × 40.0          0.52
bed side, pickup      derived  1.80 × 0.63     32.0 × 40.0          0.80
bed floor, pickup     derived  1.48 × 1.80     16.0 × 16.0          1.00
hubcap                16×16    0.34 × 0.34     47.1 × 47.1          1.00
```

Two separate problems in one table. **Across vehicles**, density varies 20.9 to
47.1 px/m, so a van's flank detail is half the size of a pickup's. **Within a
panel**, every flank is anisotropic — texels roughly twice as tall as they are
wide — which is the "stretched" reading, and it is why a 0.38 m arch radius
comes out 12 texels wide and 15 tall.

## What I did NOT find

Front and rear faces read cleanly on all four kinds — grille, lamps and bumper
are symmetric and correctly proportioned (`fleet-van-front.png`). The tailgate
is clean since the dither fix. No fault found on the roof or bonnet panels.

---

## The proposed pass, for ranking

The discipline named for this is A's masonry rule: **derive every canvas from the
surface's real metres at ONE density**, so nothing is stretched relative to its
neighbour and a feature crossing two panels lines up.

For the fleet that means one `PX_PER_M` for bodywork, each canvas sized
`round(w · PX_PER_M) × round(h · PX_PER_M)`, and the flank's two faces given
their own textures — or their own UVs — so the mirror stops happening. Finding 1
is *not* fixed by density alone; it needs the mirrored face addressed
explicitly, and it is the one I would do first whatever the ranking.

**A question I am supposed to ask rather than answer by reading A's file:** how
does the masonry helper derive its canvas — does it round to whole texels per
metre and accept a fractional canvas, or fix the canvas and accept a fractional
density? The fleet has panels from 0.34 m to 4.6 m, so the rounding rule decides
whether a hubcap and a van flank can share a density at all.

Order I would suggest, given free choice: **1, then 3, then 2, then 4** — the
mirror is a correctness fault, the coachline is cheap and visible, the blotch is
mostly fixed by clipping the dither to the panel, and the density pass is the
largest and touches every canvas.
