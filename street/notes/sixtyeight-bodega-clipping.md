# Item 177 — the bodega: crowded, and things intersect each other

Worker **sixtyeight**, 2026-08-02. `src/proto/ct/int-bodega.ts` only.

The user: *"bodega is a bit crowded and lots of clipping inside."*

## Root cause, in one line

**Both halves of his complaint are the same two fixtures.** The coffee station
was *relocated* to the front-left — its own comment records the move, and the
reason for it — onto floor the deli case already occupied, and nothing
connected the two coordinates. `hd - 2.2` and `hd - 1.5` are each individually
reasonable, which is exactly why re-reading either line could never catch it.

## What was actually wrong, measured

`scripts/probes/w68-bodega-clip.mjs` sweeps the whole room, because he said
*"lots of clipping"* — plural — and the pair he framed is a sample.

| | before | after |
|---|---|---|
| collider floor shared by two fixtures | **0.198 m²** | **0** |
| interpenetrating carcass volume | **0.157 m³** | **0** |
| clear width at the mouth of the left aisle | **0.51 m** | **0.98 m** |
| left aisle walked front-to-back | **blocked at 0.31 m** | **11.18 m** |
| standable floor | 46.54 m² | **47.10 m²** |

**The clipping.** The coffee bench ran **0.36 m into** the deli case: case
z 4.44…5.16, bench z 3.40…**4.80**. At 0.157 m³ it was the largest fixture
overlap in the room *by a factor of ten* and the only one that was not a wall
corner. Three separate mesh pairs reported it — the bench carcass, its top, and
the urns — because all three stand on the same wrong coordinate.

**The crowding, which I did not expect to be the same fixture.** The case's
right end reached local x −1.70. The left aisle's mouth runs from there to the
second gondola run's face at −1.19: **0.51 m against a 0.72 m player.** So the
**left aisle could not be entered from the front of the shop at all** — you had
to walk the middle aisle down to the cooler and come back up. That is *"a bit
crowded"* in its most literal possible form, and it is a thing no screenshot
shows. The item was right to insist on walking it.

## The change

Three edits, and none of them is a nudge:

1. **The case declares its own extents once.** `-hw + 1.6` and `hd - 1.5` were
   each typed three times across four lines, `2.2`/`0.72` twice, and the coffee
   station had a fourth independent opinion about where the case ends. Now
   `DELI_W/H/D`, `DELI_X`, `DELI_Z` and a derived `DELI_FRONT`.
2. **The bench's z is no longer a coordinate.** `CF_Z = DELI_FRONT - CF_GAP -
   CF_W / 2` — "as far forward as it can go while still clearing the case". If
   the case moves, the bench moves with it. `CF_GAP` is 60 mm and deliberately
   not zero: butted flush, the bench's end face and the case's front face are
   coplanar over the bench's whole footprint, which is a z-fight.
3. **The case stands against the left wall**, `-hw + 0.03 + DELI_W / 2`,
   derived from the wall face. It was floating 0.41 m off it — a strip too
   narrow to walk and too wide to read as joinery, so it was dead floor — and
   that 0.41 m is what was jamming the aisle mouth. A deli case belongs against
   a wall; this costs nothing and buys the aisle.

**I did not empty the room.** The item is explicit — *"a 1997 corner bodega
SHOULD feel dense and stocked… Space is what he wants, not subtraction."*
Fixture count is unchanged; every one of them is still there. The room gained
0.56 m² of floor by moving two things, not by removing any.

## Proof

- `scripts/probes/w68-bodega-clip.mjs` — collider sweep + fixture-cluster AABB
  sweep of the whole room.
- `scripts/probes/w68-bodega-walk.mjs` — **13 assertions, walks with held keys
  and real collision.** Mutation-checked: on the pre-fix bundle it fails with
  the player stopped at z 5.53, 11.1 m short of the back.
- `scripts/probes/w68-bodega-shots.mjs` — the four frames below.
- `scripts/probes/w68-yawcheck.mjs` — which way is `w`. See below.

## I looked at the images

`/tmp/w68-bodega-{before,after}-*.png`, regenerable in one run.

- **`-the-L.png`, before:** the bench's carcass drives **straight through** the
  deli case and out the other side. The case's glass meat display is chopped off
  mid-run by the bench, and the two read as one fused object with no joint
  anywhere. This is the user's photograph.
- **`-the-L.png`, after:** a clean 60 mm shadow gap, the display glass runs its
  full length, and the two carcasses read as an L of separate joinery.
- **`-his-view.png`, after:** from inside the cut door the front-left corner is
  open floor with the case against the wall and the urns square to you.
- **`-left-aisle.png` / `-mid-aisle.png`:** both aisles clear end to end.

## Three instrument faults I caused and corrected — all three passed GREEN first

Half of all "defects" here are the instrument (BUILDER-BRIEF §7) and I supplied
three of them in one item. Every one is written into the probe at the point it
bit, because a fixed check with no note is a check the next person re-breaks.

1. **A 1-D lane derivation reported 0 LANES and still printed `BODEGA WALK OK`.**
   Projecting fixtures onto the x axis lets the cooler — a 7.60 × 0.60 slab
   across the *back wall* — swallow the whole room. The walk phase then ran zero
   routes and the run passed. Fixed by deriving aisles from the 2-D standable
   grid, and by a **population floor** that fails if fewer than two aisles are
   found.
2. **`yaw = Math.PI` walked five routes into the front wall** for 2.4 s each and
   reported the room impassable. Measured instead of assumed
   (`w68-yawcheck.mjs`): yaw 0 → d = (0.00, **−2.36**), yaw π → (0.00, +2.36).
   The 0.05 m each route covered was the wall, not a fixture.
3. **Distance-travelled was the wrong assertion.** Two aisles walked 7.97 and
   8.06 m against a target of 8.88 and read red, when the truth was 3.36 m/s
   sustained for the entire 2.4 s with nothing in the way — the *clock* was the
   constraint. The assertion is now on **where you end up**, with a run long
   enough that time cannot bind.

A fourth, in the clip probe: the first structure filter ("spans most of the
room") missed the walls, because the chamfer leaf is a 1.48 m plane and the
front wall comes in 5.25 m segments. It reported 15 interpenetrating fixtures
of which the top four were all the same door-corner wall. **Full height is the
discriminator that works** — every wall is 2.6 m, the tallest fixture is a
1.95 m gondola carcass, and 2.4 sits between them with 0.45 m either side.

## Found and NOT fixed — for the desk to queue

1. **`ct/interior.ts`: the chamfer door's jambs stand in its threshold.** Two
   0.1 × 2.15 × 0.288 jambs interpenetrate the 1.3 × 0.03 × 0.26 sill, 2.3
   litres each. **Not mine** — item 177 names `ct/int-bodega.ts` and this is the
   room kit, so it is shared by every chamfered room. I also do not think it is
   a defect: a threshold running under the jambs is ordinary joinery, it is
   30 mm tall and it is under the door frame. **Recording it so the next sweep
   does not re-discover it as new.**
2. **The keeper's sprite grazes the counter top by 12 mm** in x. A 1.90 m plane
   against a 0.06 m top; invisible, and arguably right for someone leaning on a
   counter. Measured and left.
3. **The radio sits 10 mm into the counter top.** That is how you place an
   object on a surface without it floating. Not a defect.
4. **I could not find a magazine rack.** The item quotes his screenshot as
   showing *"a magazine rack… very close in on the right"*; `int-bodega.ts`
   contains no magazine rack and no newspaper fixture. The only things on that
   side are the main counter, the lottery machine and the cigarette rack
   *texture* behind the counter. Either he means one of those, or it is outside
   this room. **Worth putting the screenshot in front of someone**, because I
   may have fixed the left of his frame and left the right of it alone.
5. **Item 174's `solid` vs `citAvoid` two-list gap:** the item asked me to say
   if I found it indoors. **I did not look for it** — no pedestrians walk inside
   the bodega, so there was nothing to observe. Not evidence either way.
6. **I did not coordinate with item 115** (the library's crowding, the same
   complaint in another room), because it was not in flight while I held this.
   My working definition of "not crowded" here was **"every aisle walks end to
   end for a 0.72 m capsule, and the floor is one connected region"**, which is
   mechanical and portable. If 115 is picked up, that is the definition to argue
   with or adopt.

## Other checks

- `npx tsc --noEmit` — clean.
- `npm run sweep` — 96 shots, **0 STATION MISS, 0 COVERAGE**, no findings.
- `node scripts/health.mjs` — `WORLD OK`, exit 0, against build `d4e1906b0`.
- Console errors across every probe run: **0**.
- `fp`/`fpdiff` deliberately **not** used: this moves geometry, which is the one
  case the texture hash cannot survive.
