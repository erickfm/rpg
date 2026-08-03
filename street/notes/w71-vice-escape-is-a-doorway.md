# Item 222 — there is no world-escape. The "escape" is the party doorway.

Worker **seventyone**, 2026-08-03. **No world file changed.**
`ct/vice.ts` was measured and left alone.

---

## The row's premise does not survive contact

> *"YOU CAN WALK THROUGH THE CASINO AND HOTEL WALLS… A THIRD WORLD-ESCAPE
> CLASS… Casino: 8 escapes out of 24. Hotel: 9 out of 24… The hotel walks
> 6 METRES PAST ITS OWN FRONT WALL."*

Measured on the current mainline build, **with the registered check itself**
(`scripts/interiors-walk.mjs`, run per-room against dev — it cannot run against a
built preview, item 164):

```
casino   24 runs from 6 spread points, 1 escapes
hotel    24 runs from 6 spread points, 0 escapes
```

**1 and 0, not 8 and 9.** And `scripts/probes/w71-where-does-the-escape-go.mjs`
reproduces the check's own runs and **classifies** each endpoint instead of
counting it:

| room | IN-OWN | NEXT-DOOR | STREET | **VOID** |
|---|---|---|---|---|
| hotel | 24 | 0 | 0 | **0** |
| casino | 23 | **1** | 0 | **0** |

```
casino  -x from local -3.79,-8.19 -> (-9.78, -8.19)   NEXT-DOOR hotel
```

**ZERO VOID IN 48 RUNS. Nobody leaves the world.** The single "escape" is a
player walking through the **item-196 party doorway into the hotel** — the
feature the user asked for in his own words, *"i should be able to walk from one
into the other."*

## Why the check says "escape" when nothing escaped

`interiors-walk.mjs:869-871`:

```js
const ex = Math.abs(a[0] - cx) > hw + 0.18 + 0.05;
const ez = Math.abs(a[2])      > hd + 0.18 + 0.05;
```

**It is a per-room box test.** It asks "are you still inside YOUR OWN room",
which cannot distinguish *left the world* from *walked next door*. Item 196 gave
exactly these two rooms — and no others — a doorway to next door. **That is why
casino and hotel are the only two that "leak" and the other ten score 0.** The
population floor the row leans on ("ten rooms at 0 proves the check works") is
real but proves the opposite of what it was read to prove: it identifies the two
rooms with a party doorway, not the two rooms with a hole.

## The walls are not missing — measured, not assumed

`scripts/probes/w71-vice-walls.mjs` takes each room's **declared** extents from
`__ct.roomDims()` and asks what colliders actually stand on them, merging runs
per side and reporting the gaps:

```
hotel   west 26.0/26.0 (100%)   east 23.4/26.0 (90%)  GAP z -10.3..-7.7  2.6 m
        south 11.0/11.0 (100%)  north  9.9/11.0 (90%) GAP x 873.77..874.87  1.1 m
casino  west 33.4/36.0 (93%)    GAP z -10.3..-7.7  2.6 m    east 36.0/36.0 (100%)
        south 11.0/11.0 (100%)  north  8.6/11.0 (78%) GAP x 884.48..886.88  2.4 m
```

**There are exactly two holes per room and both are doors:** the street door in
the north wall, and the 2.6 m party doorway at z −10.3…−7.7 — which is precisely
item 196's `at: -9.0` with a 2.6 m opening. The bank and the diner show the same
shape (a 1.9 m and a 1.15 m front-door gap) and nobody calls those escapes.

**"The rooms grew and the walls did not follow" is not what the geometry says.**
The walls follow the declared footprint on every side.

## Item 196 is intact

Walked, **until progress stopped rather than for a fixed time** (GOTCHAS 30 — a
first attempt with a 2.6 s hold stopped both walks mid-doorway and looked like a
blockage):

```
hotel -> casino (+x)   872.82 -> 890.79   17.97 m   inTarget=true
casino -> hotel (-x)   887.18 -> 869.18   18.00 m   inTarget=true
```

Both directions traverse the whole neighbouring room. **Not touched, not
reverted.**

## Also already fixed: the "no floor plane" instrument fault

The row warns that *"the same two rooms report 'no floor plane found' while a
probe finds 5 and 9 flat meshes at y = 0… know it is lying."* On this build the
hotel now **passes**:

```
ok  hotel: the floor mesh is where the rig thinks the floor is
    lowest floor mesh y=0.01, rig gy=0
```

So seventysix's finding 2 has been closed by somebody since.

## Did 196 cause it or reveal it?

**Neither, as the row means it — because there is nothing to cause.** 196 did
introduce the thing the check trips on: before the party doorway, the casino's
west flank was solid and the box test was accidentally a correct containment
test. It is the doorway that makes a per-room box test wrong, and the doorway is
the feature.

**I could not reproduce 8 and 9 at all.** I did not establish where those came
from. Two candidates, neither verified: 196 landed across four commits
(`b90131235`, `8f784a68d`, `ae06532ad`, `830b0a3c6`) and a run against a
partly-landed tree would see more holes; and `interiors-walk` **must** run
against dev, so a run taken while its author was editing source for item 213
would have HMR reloading the page underneath it — which drops the player back at
spawn and makes every subsequent "walk from local x,z" finish somewhere it never
started from. **That is a guess and I am flagging it as one.**

## What actually needs doing, and why I did not do it

**`ct/vice.ts` needs no change. I made none.** Changing walls to satisfy a check
that is asking the wrong question would have closed the user's doorway or added
masonry the world does not want.

**The fix is in `scripts/interiors-walk.mjs`, which item 222 does not name**
(BUILDER-BRIEF §9). It is small and it is exactly what my probe already does:

> When the endpoint is outside the room's own box, do not count it yet —
> **classify it.** If it falls inside another room published by `roomDims()`,
> that is a doorway and the world is intact. If it is on the street outside a
> declared door, likewise. **Only "no room, no ground" is an escape.**

That turns the invariant from *"you are inside your own box"* into
*"you are somewhere the world admits exists"*, which is what BUILDER-BRIEF §11
actually cares about — and it would keep working when the next pair of rooms
gets a connecting door.

## Found and not fixed

1. **The check change above.** Not my file. Until it lands, **the casino's 1/24
   is a KNOWN-GOOD RED** and should not be chased a third time.
2. **`ct/interior.ts` owns the party doorway, not `ct/vice.ts`.** The row names
   `ct/vice.ts` as the file; the opening is cut by the `PARTY` concept in
   `ct/interior.ts` (see `notes/seventy-orpheus-combo.md`). If any future row
   really does need the doorway changed, that is the file.
3. **`hotel: the customer station comes from the world, not from memory`** fails
   in `interiors-walk hotel`, and **`kit: no kit warnings for these rooms`** fails
   in `G-rooms-walk` on the known `[interior:hotel] NO BUILDING NAME` warning.
   Both are pre-existing, both unrelated to containment, neither is mine. The
   second is the one the builder brief already lists as expected every bugsweep.
