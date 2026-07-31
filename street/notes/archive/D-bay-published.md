# The bodega's cut corner is now readable from code, for F

`ct/bodega-corner.ts` exports `BAY`. This note is for **F**, who owns
`ct/int-bodega.ts` and has the live user request that depends on it:

> *"bodega interior is very cramped and also doesnt match the exterior. so if
> the door for the bodega is on a cut corner (literally) then the interior
> should match"*

I have not touched `ct/int-bodega.ts` — `OWNERSHIP.md` says do not edit another
builder's file, and this is the export they would otherwise have to ask for.

## Why this is worth a commit

`ct/int-bodega.ts` currently carries, in a comment:

> *"On the CANTED BAY, cut at 45° across the corner — not on a flat frontage.
> **D reported the geometry: the cut face runs A (7, −94) to B (9, −96)**, so its
> …"*

and, in code, `chamfer: { corner: 'front-right', cut: 2.0 }`, with the 2.0
worked out by hand from `hypot(2, 2)`.

**Every one of those numbers is correct today.** That is exactly what makes it
worth fixing now rather than after it breaks: they were typed out of a note, and
a note cannot notice when the thing it describes moves. This project has hit
that six times — GOTCHAS §20's *"aim from the source, not from memory"*, written
after a stale diner z, a hand-typed room offset and a hand-typed `DZ`.

Two things make the bodega the worst place to leave it:

- **The bay has already been re-cut once**, and the corner attracts more user
  feedback than any other part of the block.
- **The request is specifically that the interior MATCH the cut.** The moment F
  builds to it, the interior depends on these numbers harder than anything in
  the world currently does. A silent drift then reads to the user as the exact
  complaint they just made.

GOTCHAS §22 already names the remedy approvingly, one level up: *"if your module
can publish its own footprint — `ct/lot.ts` exports `LOT.bounds` — do that
instead of writing coordinates into a document."*

## What it gives you

```ts
import { BAY } from './bodega-corner';

BAY.a           // { x: 7,  z: -94 }   cut face start, main-street side
BAY.b           // { x: 9,  z: -96 }   cut face end, side-street side
BAY.cut         // 2.0    how far the corner is cut back along EACH wall
BAY.faceWidth   // 2.828  cut * √2 — the canted face's own width
BAY.centre      // { x: 8, z: -95 }    door centre line
BAY.normal      // { x: -0.7071, z: -0.7071 }   outward, toward the crossing
BAY.shell       // { x0: 7, x1: 10.4, z0: -96, z1: -86 }
BAY.doorWidth   // 1.3
```

`BAY.faceWidth` is the number an interior chamfer wants; `BAY.cut` is the one
that maps to the room kit's `cut:` field, and it is 2.0, which is what is
hand-written there now.

**Endpoints are named `a`/`b` and given in WORLD coordinates, in the order you
meet them walking the frontage — deliberately not "left"/"right".** Those are
the terms that make mirroring gettable-wrong, and GOTCHAS §33 counts four
separate objects in this world that ended up backwards because a front was
expressed relatively.

It is `null` until the corner is built. Every interior runs after `buildStreet`,
so any consumer sees it populated; the type says `| null` so nobody can forget.

## Cross-checked before publishing, not just typed in

Two independent sources agree, which is the point of doing it this way:

| | published `BAY` | `__ct.doors()` for BODEGA |
|---|---|---|
| door centre | `(8, −95)` | `point (8, −95)` |
| outward normal | `(−0.7071, −0.7071)` | `(−0.7071, −0.7071)` |

`doors-declared` in BUILT BUNDLE mode still reports 10 of 10 arriving, so the
new export has not disturbed declaration collection (GOTCHAS §28).

And the values match F's hand-typed pair exactly — so **adopting this changes
nothing in the world today.** That is the whole argument for doing it before the
interior is built rather than after.
