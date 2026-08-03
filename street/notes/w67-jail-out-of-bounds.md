# Item 175 — the jail's side, and why two green checks sat over it twice

Worker sixtyseven, 2026-08-02. Port **4230**.

> *"side of the jail are still bugged and allow for out of bounds."*

---

## The hole, and why "still"

**Root cause in one line: the flank screens added for item 0 close the flank
line from `BX` to the fence — the YARD half — and nothing ever closed
`site.minX` to `FX`, the FORECOURT half, so the front of the same building kept
the identical hole that block was written to fix.**

The geometry, measured on this tree rather than reasoned about
(`scripts/probes/w67-jail-gap-find.mjs`):

- The side street's flanking buildings **stop at the frontage**. Their faces are
  at **z −108.32** (south) and **z −97.85** (north).
- The jail's site runs **z −110 … −96**.
- That leaves a slot **1.68 m wide on the south flank and 1.85 m on the north**,
  between the neighbour's face and the site edge.
- `JAIL.FORE` sets the building back 4 m, so the slot is **in front of the
  facade**, beside the forecourt, where the building's own mass cannot close it.

`groundAt` is continuous over the whole area — **this was never a floor hole**,
which is worth saying because that is the first thing anyone checks. It is a
collider gap, and only walking finds it.

**Through it the player is outside every collider in the world.**
`scripts/probes/w67-jail-escape.mjs`, 112 scripted walks from a ring of starts:
**69 escaped**, finishing as far north as **z −84.95** and, to the south, at
**z −110.60 — which is `crosstown.ts:1216`'s own world clamp.** Standing on the
last half-metre of the world with sky on three sides.

## The fix

The same idiom as the yard screens, with a different run: a stone-then-brick
screen along each flank line from the site's west edge to the building face,
with its own `ctx.obstacle`. Textures sized to **their own** run rather than
reusing the yard screens' (§7b), which is the same reason the yard screens do not
reuse `stoneFlank`.

**It costs the 2 m lane nothing.** The walls stand on `Z_S`/`Z_N`, the site's own
edges, which are 1.68 m and 1.85 m *outside* the corridor the player walks. The
containment check measures this rather than asserting it: **13.50 m of
unobstructed z** across the forecourt afterwards.

## Why the two existing checks were green — the part the item cared about most

`scripts/w15-jail-walk.mjs` has six legs: approach the facade, cross the
forecourt, cross the yard to the fence, the south screen wall holds, walk back
out along the flank, floor continuous. **Every one of them is aimed along the
site's centre line `CZ`, or at a wall someone already knew about.** Leg 4 walks
at the *yard's* south screen — the wall that exists. Nothing walked the
forecourt flanks, because nobody had thought of them, and not having thought of
them is precisely why the gap was there.

**That is GOTCHAS 79 in a different costume.** `masonry.mjs` reported green while
examining zero faces; these report green while examining only the routes their
author enumerated. A walk check built out of remembered routes can never find a
hole nobody remembered.

**So the new check asserts a PROPERTY, not a route.**
`scripts/w67-jail-contained.mjs` walks outward from the middle of the side
street and asserts that **no sequence of walks can put the player outside the
jail's own site**. Two design points that are load-bearing:

- **It never teleports past a wall.** Warping to the far side of a boundary and
  reporting "I am outside" proves nothing about reachability and would fail on a
  perfectly sealed building. Every walk starts from somewhere the fill has
  already legitimately reached. My first discovery probe did teleport, and it
  reported 16/16 "escapes" from two start points that the player cannot actually
  reach — I did not act on those, and they are why the shipped check is a fill.
- **A budget that runs out is REPORTED, not swallowed.** The first fill did not
  converge (0.5 m cells, sixteen directions: 220 walks left 198 places
  unexplored), and the check said so and went red rather than printing
  "contained" off partial coverage. That guard caught my own run before it
  caught anything else, which is the only reason I trust the green one.

Converged by coarsening the dedupe to **2 m cells** — still finer than the
1.68 m slot it is hunting, so nothing it needs can hide between samples — and by
scoping the frontier to the jail's neighbourhood, which is stated in the file
rather than implied.

## Proof it can fail

`canfail` case **`jail-forecourt-open`**: it removes the forecourt obstacle and
**leaves the wall standing**. That reproduces the actual fault — a wall you can
see and walk through — rather than deleting geometry, which would be a fault any
screenshot catches. A mutation has to break the symptom, not the diagnosis.

## Found and NOT fixed — for the desk

- **`O-jail-walk.mjs` and `w15-jail-walk.mjs` are still route-based and I left
  them alone.** The item offered "amend them" or "a containment sweep"; the
  sweep is the answer to the class of bug, and rewriting two working checks into
  a third copy of it would be three things to keep in step. **They are not
  wrong — they are narrow**, and they still guard the routes they name.
- **The forecourt now has a 1.5 m dead alcove on each flank**, between the
  neighbouring building's face and the new wall. The player can walk into it and
  back out; it is inside the site and inside the world. Sealing it flush would
  mean moving the wall out to meet the neighbour's face, which is a decision
  about the *street's* geometry rather than the jail's, and it is not this item.
- **This is a class, not an instance.** The same shape — a site whose z span is
  wider than the corridor that feeds it — is possible at every other published
  site. The containment sweep is written against the jail specifically; **making
  it take a site name and running it over `park`, `lot` and `jail` is a small
  change and probably the highest-value follow-up on the board.**
