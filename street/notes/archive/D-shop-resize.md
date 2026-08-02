# Shop resizing — four of five landed exactly, and the fifth IS reachable

> **This title used to read "…and the fifth cannot hold with them".** That verdict
> was mine and it was wrong — I had dropped a term from the stack. The retraction
> and the corrected arithmetic are the first section below; the original reasoning
> is kept under it so the error is legible.

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

## RETRACTED — the glazing target IS reachable, and my stack was wrong

**Everything below this heading was my earlier conclusion and it is wrong.** It
is kept rather than deleted because the error is instructive and because the
"incompatible" verdict has been quoted since.

### The error, exactly

I wrote the stack as five terms and folded the glazing inset into the sill:

```
sg 0.57   sill gap (stallriser 0.35 + glazing inset 0.22)     <- WRONG
```

`gi` is not part of `sg`. `BANDS` lists them as separate columns and
`layoutOf` uses them at opposite ends of the opening: `sg` is subtracted from the
opening height to make the glass, and `gi` is the reveal INSIDE the opening,
above and beside the glass. Reproducing the module's own formulas:

```
oy     = fy + fh + og
gh     = (SHOP_BAND_H - oy - 0.05) - sg          glazing height
stall  = SHOP_BAND_H - (oy + gi + gh) - 0.05     stallriser
```

which stacks, for `default`, as

```
fy    0.10   gap above the fascia          }
fh    0.90   THE SIGN BAND                 }  the item asks for ~0.9  — held
og    0.18   gap below it to the opening   }
gi    0.22   reveal inside the opening, above the glass
gh    2.40   GLAZING                          the item asks for ~2.7
      0.35   THE STALLRISER                   the item asks for 0.35 — held
      0.05   bottom margin
-------------
      4.20   = SHOP_BAND_H
```

**Having dropped `gi`, I costed the trim budget at `fy + og` = 0.28 m, decided
0.30 could not come out of it, and concluded the five numbers could not all
hold.** The real trim budget is `fy + og + gi` = **0.50 m**.

### What that means for the request

To reach 2.70 m of glazing while holding the 0.90 m sign band and the 0.35 m
stallriser **exactly**, computed per character rather than for the default alone:

| character | needs | trim budget `fy+og+gi` | verdict |
|---|---|---|---|
| default | 0.300 | 0.50 | reachable, 0.20 m of trim left |
| tax | 0.220 | 0.54 | reachable, 0.32 m left |
| pawn | 0.320 | 0.50 | reachable, 0.18 m left |
| thrift | 0.330 | 0.51 | reachable, 0.18 m left |
| diner | 0.380 | 0.48 | reachable, 0.10 m left |
| burger | 0.420 | 0.47 | **not** — 0.05 m of trim left is not trim |

**Five of six reach it without touching either dimension a person reads against
their own body.** Burger is the exception and it is the one with a deliberately
taller 1.05 m fascia, so it is a decision rather than an obstruction.

### The one real consequence, and it is A's call

`gi` is used on BOTH axes — `gx = ox + gi` as well as `gy = oy + gi` — so
shrinking it for height also thins the side reveals. If that is unwanted, the
clean fix is to split it into a vertical and a horizontal inset, which is a
one-line change in `ct/tex-world.ts`. **That file is A's and I have not touched
it.** This is the arithmetic, published so the decision is about proportion
rather than about whether it is possible.

---

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
