# eightyseven / item 242 — the pooled vehicles at the world origin

**Fixed, and the row's stated cause was aimed at the wrong population.** All
figures on the built bundle, port **4430**, build `645e7bd7b`.

---

## The row is wrong about which thing is at the origin

The row says *"FIVE pooled car BOXES sit at the WORLD ORIGIN"* and instructs
*"Move them to the same far parking coordinate the rest of the pool uses"*.

**The collider boxes were already correct.** Measured before touching anything
(`scripts/probes/w87-item242-origin-census.mjs`):

```
colliders 533   citAvoid 192
boxes parked exactly at 999:  colliders 20, citAvoid 7
boxes containing (0,0) or centred within 2 m of it:  0
```

`ct/traffic.ts` parks the box at 999 **both** on creation (`:236`) and on release
(`:256`), and always did. Re-checked after 45 s of live traffic: still 0.

**It is the SCENE GRAPH.** Eightyfive's own note
(`w85-item230-grid-raycast.md:142`) says so precisely — *"five car-BODY boxes
(1.8 × 4.5 m, y 0.34…0.84) … bbox centred on x 0, z 0"* — found by
`world-contained.mjs`, which traverses the **scene**. The row compressed "car
body bounding boxes" into "collider boxes" and sent the fix at the wrong array.

Measured, meshes within 3 m of the origin: **44**, every one `visible=false` —
the five car bodies at exactly eightyfive's dimensions, plus roofs, glass and
sixteen wheels.

## Root cause, one line

`ct/traffic.ts:202` did `scene.add(c)` on every pooled vehicle and set only
`visible = false`, **leaving each group at its default `(0,0,0)`** until its first
activation; and `clear()` parked the **box** at 999 while leaving the **mesh**
wherever its run ended.

**Hidden is not absent.** `scripts/world-contained.mjs` deliberately ignores
`visible` (GOTCHAS 79 — an authoring fact should not depend on a runtime flag),
so those bodies made **(0, 0) read "floored" with every ground plane deleted**,
and (0,0) is the coordinate every probe in this repo reaches for first as a
control or sentinel. Eightyfive caught it only because its road sentinel could
not be made to go void; **a check that merely returned a slightly wrong number
would have been believed.**

## The fix

One named constant, `IDLE_XZ`, used by the **mesh and the box alike**, applied at
**construction as well as on release** — the two were previously authored in
different places and only one of them was right. `park(c)` is the single writer.

`pose()` overwrites the group's position outright on activation, so parking
cannot affect where a vehicle drives.

| | before | after |
|---|---|---|
| meshes within 3 m of the origin | **44** | **1** |
| …and the survivor | — | an 11 × 14 m hidden `tex-ground` plane, **not a vehicle** |

## Traffic and collision are unchanged — watched, not asserted

The row warns these boxes enter `citAvoid` and `actorBoxes`, that `traffic.ts`
rewrites their extents every frame, and that `crosstown.ts:603` records a bug
where a moving box was read out of `colliders`. So I watched the world run for
**90 s** (`w87-item242-traffic-unchanged.mjs`):

```
traffic pool identified at load: 6 groups standing at the idle coordinate
visible-vehicle samples                                     53
...with a vehicle-sized citAvoid box travelling with them   53
...WITHOUT one (collider left behind)                        0
visible vehicles sitting at the idle coord   (must be 0)     0
hidden vehicles NOT at the idle coord        (must be 0)     0
driven envelope  x 1.35…50.49   z -101.65…7.09
console errors: 0
```

The envelope covers the **main street and the side street**, so both route
families still run. `scripts/world-contained.mjs` — the check that was being
misled — passes: **20386 reachable cells, 0 over nothing, 0 console errors.**

## MY OWN PROBE LIED TWICE FIRST, and both are worth recording

Its first run reported `450 hidden vehicles off station` and `6 colliders left
behind`. **Both were the instrument.**

1. **"A top-level Group with `userData.wheelbase`" matches TWELVE groups, not
   six** — the traffic pool *and* the six statically parked cars along the kerb
   and in the lot, which sit at real street positions and are `visible=false`
   under storey culling. 6 parked × 75 samples = **exactly the 450**. The pool is
   now identified once, before any activation, as the groups standing at the idle
   coordinate.
2. **The box filter demanded `depth > 2.5`**, which is a car's length only while
   it drives along **z**. On the side street the same car's AABB is 4.5 in x and
   1.8 in z, so the filter **rejected the very box it was looking for**. The
   driven envelope reaching x 50.49 is what gave it away. Now tested on the long
   and short sides, orientation-independently.

Neither would have been visible without checking the disagreement between two of
my own instruments — the origin census said the pool had moved while the traffic
probe said it had not, and one of them had to be wrong.

## Suite

`npm run sweep` **96 shots, 0 STATION MISS, 0 COVERAGE**. `node scripts/health.mjs`
**WORLD OK, exit 0**. `npx tsc --noEmit` **clean**.

## Found and not fixed — anything else idling at the origin?

**One thing, and it is not a vehicle.** A hidden `tex-ground` plane,
**11 × 14 m, y 0…0, centred (0, 2.6), `visible=false`**. It is a flat zero-height
ground sheet at road level, so it does not float a floor over void the way the
car bodies did — but it *is* still a hidden mesh at the origin, and it is
`mod=tex-ground`, a different module and outside this item's file. **Reported for
the desk to rule on** rather than moved: unlike the vehicle pool it may be a
deliberate swapped-out ground variant whose position is meaningful.

Also carried forward from eightyfive's note and **not** actioned here (both are
its own findings, not mine, and both are other files): `w75-site-contained`'s
AABB floor predicate over-claiming by 11660 cells, and its header citing a
screenshot that does not exist.

## Derived or copied

**Derived.** `IDLE_XZ` is the pool's own pre-existing 999, hoisted rather than
retyped — the two literals that existed are now one constant, which is the
substance of the row's "named in one place". The probes read the world:
colliders and citAvoid through `__ct`, meshes and positions off the live scene
graph. No coordinate in any probe is copied from the source.
