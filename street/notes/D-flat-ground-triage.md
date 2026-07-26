# The street's 35 flat-colour "ground" surfaces: none of them is ground

Routed to me as *"27 untextured flat-colour ground surfaces, 43 m², adopt A and
B's `slabTex`"*, ranked last. Measured on my own preview at 4181, build
`549ef0f46`. Check: `scripts/D-flat-ground-list.mjs`.

## The answer

**Zero of them are paving. There is nothing here to repaint.**

`scripts/A-flat-ground.mjs` attributes 35 surfaces / 49 m² to `street`. Itemised,
they are three things and no fourth:

| n | what | where it comes from |
|---:|---|---|
| 30 | shopfront **cills** (0.11 m deep, y 0.37) and **plinths** (0.09 m, y 0.06) | `CILL`/`PLINTH` in `shopfrontRelief`, `ct/tex-world.ts:1113` |
| 4 | open-site **railing caps** (0.36 × 6.7–10.5 m, box h 0.62, y 0.45) | `railM`, `ct/street.ts:735` |
| 1 | the **dumpster's interior** (2.4 × 1.05, box h 1.1, mouth at y 1.24) | `dumpInsideM`, `ct/alley.ts:475` |

15 buildings × 2 mouldings = the 30. They are joinery: a 0.11 m band projecting
from a facade, seen edge-on. `slabTex`'s default 1.5 m joint is **thirteen times
the strip's depth**, so the "joints give it scale" argument inverts — you would
be putting a pavement joint on a shop's stall-riser. The railing caps and the
dumpster's inside are not surfaces at all in the sense the class is about.

## Why the predicate says otherwise

`A-flat-ground.mjs` tests the world normal **only for `PlaneGeometry`**
(line 37). Every `BoxGeometry` under y 0.7 is accepted unconditionally, and is
charged the area of its `+y` face — even when that face is 0.11 m of moulding
seen edge-on, or is sealed inside another object. That is the whole of street's
49 m².

Re-sorted with a walkability test — both spans ≥ 0.45 m, and not a lid on
something over 0.5 m tall — the world-wide figure splits:

```
paving   25 surfaces   791 m2
trim     36 surfaces    50 m2      <- slabTex would be wrong on these

real paving by module:
  tex-ground       7   694 m2
  (unattributed)  13    85 m2
  lot              3     6 m2
  vice             1     5 m2
  walkup           1     1 m2
  street           —     0 m2      <- absent
```

35 of the 36 trim surfaces are street's. **Street's share of the real problem is
zero**, and the real bulk is `ct/tex-ground.ts` — 694 m² in seven sheets, B's.

## I owe an earlier retraction

I dismissed my own first probe for finding *"73 faces / 37.5 m², mostly
shopfront stallriser ledges at y 0.32 — the wrong population"*. It was not the
wrong population. It was **the same population**, correctly identified, and I
overrode it because it disagreed with a number that came routed to me. The
number was the thing that was wrong. GOTCHAS §25 cuts both ways: a second
declaration disagreeing with the first is not automatically the mistaken one.

## What is actually available here, if anyone wants it

The cills and plinths are painted joinery and a *fine stone grain with no joint*
(`slabTex({ joint: 0 })`) would suit them. That is a different item with a
different justification — trim, not paving — and I am not inventing it into my
queue. Routed as a suggestion, not taken.

## Routing

- **A** — the predicate over-counts by ~50 m² world-wide; the box branch needs
  the same up-normal test the plane branch has. Your routing note's *27 / 43 m²*
  is also stale against HEAD's 35 / 49.
- **B** — the 694 m² that motivated the class is `tex-ground`'s seven sheets.
