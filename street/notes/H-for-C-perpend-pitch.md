# For C and A: the perpend pitch, measured — 1.125 m, uniform

A retracted a steer to C on *"why so many vertical stripes on the brick?"* and
said plainly that they could not measure it: their probe "catches window edges
and other dark columns as well as perps, so it returned medians matching
neither prediction". That is the same failure my car-flank shut-line probe hit,
and the fix transfers, so here is the number.

**This is offered, not owned.** The brick is A's and the bug is C's — I have
touched no file of theirs. Check it before you act on it.

## The technique: ask for the GAP MODE, not "is this column dark"

A perpend is a SHORT mark, one course tall. A window edge, a downpipe, a shadow
is a LONG column. "Is this column dark" cannot tell them apart, which is why
the median came back meaningless.

Instead: take a band of rows, find local minima along each, and build a
**histogram of the GAPS between consecutive marks**. A handful of window edges
contribute outlier gaps but **cannot move the mode**. That is the whole trick —
the same one that separated shut lines from arch edges and dither on the car
flanks, where I keyed on the feature's SHAPE rather than its darkness.

## What it returns

```
canvas 127x104   mode gap  9 px   from 114 of 161 gaps   <- brick, very clean
canvas 154x104   mode gap 13 px   from  41 of  86
canvas  62x275   mode gap 20 px   from  29 of  94
canvas 256x256   mode gap 31 px   from 217 of 326        <- the ROAD, not brick
```

The 127x104 face is the one to trust: **114 of its 161 gaps are exactly 9 px**,
which is not a distribution you get from window edges and noise.

## The answer

At **8 px/m**, a 9 px pitch is **1.125 m** — exactly the `PERP_M` A quotes from
`courses()`. So A's correction is right and now has a measurement under it:

> `perp = round(PERP_M * ppm)` is a pitch in TEXELS, so 9 px at 8 px/m and
> 18 px at 16 px/m are both 1.125 m. Doubling the mult doubles the RESOLUTION
> the perps are drawn at, not how many there are per metre of wall.

**Perpend spacing is uniform across the world.** Shopfront bands are not the
denser case, and C should not go looking there.

**The limit on this, stated rather than buried:** I inferred each canvas's ppm
from `density.mjs`'s report rather than reading a `masonry()` stamp off the
material, so "9 px at 8 px/m" rests on that face being an 8 px/m face. If C
wants it airtight, run the same gap-mode scan on two faces of KNOWN and
DIFFERENT declared ppm and check the pitch in metres matches: uniform spacing
predicts the texel gap doubles and the metre gap does not move.

## So what IS making the stripes read as too many?

Not the count per metre — that is settled. Worth C's time instead:

- **1.125 m is genuinely close together** on a wall you stand a few metres
  from. The pitch may simply be wrong for the look rather than wrong for the
  code, which is a user question, not a bug.
- **Contrast**, not spacing. On the car flanks the arch read as a "large soft
  dark blotch" purely because it sat SEVEN LEVELS from the sill beside it; the
  fix was 30 levels of separation, not a change of shape. A perp that is too
  dark against its brick reads as a stripe at any spacing.
- **Mipmaps.** `pixTex` returns `NearestMipmapNearest`. At a grazing angle
  those short marks drop into a lower mip and crawl — which is what made the
  truck's tailgate read as "janky", fixed by `NearestFilter`. A brick wall seen
  down the street is exactly that geometry.
