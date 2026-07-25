# Builder G — handoff

Working from `notes/queues/G-interiors2.md`: read it, take the top unchecked
item under `## Now`, commit, re-read before the next. I do not edit that file —
completions are reported here.

Prep done while blocked on F is in `notes/G-interiors2-prep.md`; the street-side
door numbers used below were derived and walked there.

---

# RUN 1 — THE CASINO, GOLDEN ACES (commit `TBD`)

## `## Now` → **THE CASINO — GOLDEN ACES** — DONE, but **it needs three lines
from F before anyone can walk into it.** See "For F" below. Everything else is
verified.

Rebased onto `add-stick-and-city98` at `ea641af` first. New file,
`ct/int-casino.ts`, 300 lines. Nothing else in `src/` is touched.

## The kit's test: the casino has no window, and the kit did it

My queue set this as the first real test of the kit — *"if it cannot omit a
window, tell the desk rather than working around it."* It can. `RoomSpec.window`
is optional and the front wall is built from the runs between its openings, so
leaving the key out gives a solid wall with only the doorway in it. No kit
change was needed and I have not asked for one.

The walk test proves it rather than assuming it: a probe walks at the front wall
at an x that would be glazing on any other room, and is stopped by wall.

## What the room is

The brief was that this should be the least like the street outside of anything
on the list, so every choice is bent to one idea — a casino is built to make you
lose the thread, of the time, of the weather, and of the way out:

- **no window and no clock**, so there is no daylight and no hour;
- **2.5 m ceiling** over a 1.62 m eye. The kit's own note says a casino "wants
  more"; it wants the opposite, and 0.88 m of headroom is what makes the
  mirrored panels press down instead of being a ceiling you never look at;
- **carpet doing far too much** — a gold diamond lattice, teal rings inside it,
  gold stars on the crossings and cream pips in the middle. No one motif is
  loud; four at once is;
- **two slot banks**, each two rows back to back facing outward, so you walk
  aisles and never see the room;
- **one felt table**, because that is as much table as a neighbourhood casino
  can justify — tables are where the house pays staff;
- **the cage** on the back wall, the furthest point from the door.

Everything here is unlit `MeshBasicMaterial`, so "dim" is not a lighting change,
it is the palette: dark walls, dark ceiling, dark carpet, and the only bright
things in the room are the things a casino wants you looking at — the reel
glass, the felt, and the cage.

## Two things I got wrong, both found by looking

**The mirrored ceiling shipped as a skylight.** First version was a pale
blue-grey panel with a warm highlight raked across it — which is exactly what a
mirror looks like *in daylight*, and it read as frosted glass with the sun
coming through, in the one room whose premise is that there is no daylight. A
mirror has no colour of its own; it is as bright as whatever it reflects, and
this one reflects a dark red room. Redrawn near-black with a faint maroon wash
and thin gold glints. One redraw, so it is not at the two-failures line.

**The light pools were painting the ceiling, not the room.** They hung 0.09 m
under it, and additive blending brightens whatever is *behind* the plane — so
each pool put a blown-out white patch on the mirrors directly above it. Dropped
to 0.35 m below the ceiling and the alpha cut from 0.55 to 0.38.

One more pass after that, which was a quality call rather than a defect: 36
identical cabinets read as a texture repeated rather than a room somebody
filled. There are three cabinet types now — different topper colour, different
reel symbol, and one older cream-bodied machine kept on — laid out by a
**hand-written sequence, not a random draw**. GOTCHAS §2: there is one seeded
`rnd()` and its order is load-bearing, so a new module drawing from it would
move every tree height and pigeon in the world.

## Verification

`scripts/casino-walk.mjs` (new), same shape as F's `diner-walk.mjs` and
including its harness fix — a probe that never moved has not tested anything, it
started inside a collider's pad, so that fails loudly instead of reporting "the
wall held". **26/26.** It caught two real harness lies of my own: the eye-height
probe was hunting the camera in the scene graph where it is not a child, and the
door-approach probe started inside bank B's collider pad.

The room's lanes are set by three colliders that nearly meet, so each is walked
as a route rather than measured in plan: the aisle between the banks both ways,
the gap between the banks and the felt table, the aisle in front of the cage,
and past the table on the wall side. The felt table was resized down from
2.2 m to 1.9 m for exactly this — at 2.2 it closed the wall side to a 0.28 m
band and made the corner a wedge (GOTCHAS §9).

Also: `node scripts/health.mjs` OK · `npm run build` clean · the way in from the
side street, the way out, and *not* being sucked straight back in · the room
still lit at 2am (0/275 materials dimmed).

**Fingerprint, via F's `fpadd.mjs`: 0 lost textures, 0 lost structure —
`ADDITIVE — nothing that existed before was changed or removed.`** The only
`places` differences are seven pigeons drifting, which GOTCHAS §1 calls the
noise floor.

## The street-side numbers

Derived from `street.ts`'s NORTH2 roster and then walked, not eyeballed:

| | |
|---|---|
| GOLDEN ACES spans | x ∈ [45.45, 57.00] on the side street, facade z = -96.0 |
| painted door | u = 0.4946 of a 92-texel shopfront → **x = 51.29** |
| `[E]` spot | (51.29, -97.0), r 1.05 — walked into, capsule stops 0.67 m off the facade |
| step out | (52.84, -97.25), yaw 0, at KERB_H |

The step-out goes 1.55 m *along* the walk rather than back from the door. The
north side-street walk is only the 2 m band z ∈ (-98, -96) and the building
collider eats down to -96.3, so there is about a metre of standing room — you
cannot clear a 1.05 m trigger by stepping back without stepping into the road.
That gives 1.57 m of separation and the kit's own check passes silently.

---

## FOR F — the room needs three lines in `crosstown.ts` and they are yours

`ct/interior.ts` registers the way in and the way out, so I did not have to
touch the entry point for those. But the **build call** is still wired by hand,
the way `buildDiner` is, and that wiring is yours per your queue. My queue says
never to edit `crosstown.ts`, and you are adding the burger barn and the thrift
store to the same block, so a drive-by from me is the conflict `OWNERSHIP.md`
was written about. I wired it locally to run the walk test, then reverted it —
`scripts/ownership.sh G` is clean.

Three lines, in the interior-belt block that must stay last:

```diff
 import { buildDiner } from './ct/int-diner';
+import { buildCasino } from './ct/int-casino';
@@
   const dinerColliders = buildDiner(ctx);
+  const casinoColliders = buildCasino(ctx);
@@
     ...dinerColliders,
+    ...casinoColliders,
```

With those in, `SHOT_URL=http://localhost:4186/ node scripts/casino-walk.mjs`
is 26/26. Without them the file compiles, is unreferenced, and the door on the
side street does nothing.

**This is the same two-lines-per-room tax for the hotel, the pawn shop and the
tax office**, and E's library and C's room 301 after that. Worth deciding now
whether the kit should take a `ctx.obstacle()`-based self-registration instead —
`obstacle` is already on `CtxBuild` — so a room is one call rather than a
three-point edit in the most-contended file in the project. Your call, your file;
I am not asking for it, only flagging that it recurs nine more times.

## Next up

`## Now` still has the **HOTEL ORPHEUS lobby** under the casino. Its door
numbers are already derived and walked (x = 39.51, same walk, same kerb height)
in `notes/G-interiors2-prep.md`. Not started.

`## Next` is the pawn shop and the tax office. **The pawn shop is still blocked
on D**: `pawnFront` in `street.ts` paints no door at all — board, barred window,
stallriser, and no door rect anywhere — so there is no world position for its
`[E]` spot to sit on. Raised in my prep note; still true as of `ea641af`.
