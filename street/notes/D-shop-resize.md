# Shop resizing — four of five landed exactly, and the fifth cannot hold with them

The item says *"Check what builder A landed first — A has given the shopfronts
real depth and this may be partly done."* It is mostly done. Measured from the
live constants rather than eyeballed:

| target | at HEAD |
|---|---|
| shops get a 4.2 m ground floor | **met** — `SHOP_BAND_H = 4.2` |
| ~0.35 m stallriser | **met exactly** — `sg - gi = 0.35` on all six variants |
| sign band ~0.9 m | **met** — `fh` 0.78–1.05, default 0.90 |
| texture 40 → 52 texels | **met** — `shopfrontTex` is 12.38 px/m up, × 4.2 m = **52.0** |
| glazing 1.92 → ~2.7 m | **2.33–2.53 m**, default 2.45 |

## The glazing target is arithmetically incompatible with the other two

The band is 4.2 m and the pieces stack:

```
fy 0.10   fascia offset from the top
fh 0.90   the sign band            <- the item asks for ~0.9
og 0.18   opening top gap
   2.45   GLAZING                  <- the item asks for ~2.7
sg 0.57   sill gap (stallriser 0.35 + glazing inset 0.22)
------
   4.20
```

To reach 2.7 m of glass you must free 0.25 m, and there is nowhere to take it
from that the same item does not also fix:

- from the **sign band** → 0.90 drops to 0.65, below the ~0.9 asked for
- from the **sill** → the 0.35 stallriser drops to 0.10, below the 0.35 asked for
- from the **gaps** → `fy + og` is already only 0.28

**So the five numbers cannot all hold at a 4.2 m band.** What landed keeps the
stallriser and the sign band exactly as specified and lets the glazing take the
shortfall, which is the right way round: those two are dimensions a person reads
against their own body, and 2.45 against 2.7 is not a proportion anyone will
name.

## The question, if the glazing number matters

**A taller band.** 4.45 m gives 2.7 m of glass with the sign band and stallriser
untouched. That is a real change — it moves every shopfront's fascia line and the
first-floor datum above it — so it is not mine to take unilaterally.

Not proposing it. Recording that the item as written cannot be fully satisfied,
which is more useful than quietly landing 2.45 and ticking the box.
