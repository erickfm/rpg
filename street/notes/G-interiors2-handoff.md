# Builder G — handoff

Working from `notes/queues/G-interiors2.md`: read it, take the top unchecked
item under `## Now`, commit, re-read before the next. I do not edit that file —
completions are reported here.

Prep done while blocked on F is in `notes/G-interiors2-prep.md`; the street-side
door numbers used below were derived and walked there.

---

# RUN 1 — THE CASINO, GOLDEN ACES (commit `2ae3040`)

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

---

# RUN 2 — HOTEL ORPHEUS lobby (commit `764547c`)

## `## Now` → **HOTEL ORPHEUS lobby** — DONE

The brief is a gap, not a room: it WAS grand and it is not any more. So every
object is one of two kinds and the lobby is the argument between them.

| what is still grand | what has happened to it |
|---|---|
| a real tile floor | a vinyl runner over the track people walk |
| a mahogany reception desk | nobody behind it |
| a full wall of pigeonholes | most of the keys still on their hooks |
| a proper lift with a floor dial | the dial stopped between floors |
| a planted palm | dead, and nobody has moved it |
| four matched lobby chairs | three that do not match |
| four ceiling fittings | one of them out |

**The rule that made it work: shabbiness drawn as REPLACEMENT, not as dirt.**
The vinyl is a different material from the tile, the chairs are different
shapes, and the dead lamp is a different *colour* from the lit ones rather than
an unlit copy of one — an unlit copy of a lit thing reads as a rendering
mistake, a cold grey shade among three warm ones reads as a dead bulb. A grand
room with grime on it is just a dirty grand room.

3.4 m ceiling, the tallest in the belt, and deliberately: the casino two doors
down is 2.5 m and presses on you. This one has to have somewhere to fall from.

Adopted F's new kit contract in the same commit — builders return `void` and the
kit collects colliders into `interiorColliders()`. That is F having done a
lighter version of the thing I asked for in my prep note, and it means wiring a
room is now one line rather than three edits.

# RUN 3 — A-1 TAX SERVICE (commit `c63b2e4`)

## `## Next` → **A-1 TAX SERVICE** — DONE, taken out of order

Taken ahead of the pawn shop above it because the pawn shop was blocked on D at
the time (see below). The brief is a dare — the dullest room on the list, done
with as much care as the casino, because that contrast is the joke — so the
discipline is the casino's inverted. Every colour is a landlord colour. The
furniture is one system bought at once and never added to. Everything is square
to the walls; the only thing off-axis is the paper on the pinboard, and only
because paper will not stay square. The one ornament is plastic and it is dusty.

The joke needs the care to be real, so the details are the ones you would
actually find: label holders on every drawer, wire in/out trays stacked two
deep, the modesty panel that is the whole reason a client desk looks like that,
and one ceiling tile pushed up out of its grid and never pushed back — the only
sign a person has been in the room, and it was somebody looking for a stopcock.

The casino has no clock on purpose; this room has one on purpose, hung dead
centre over the cabinets where everybody waiting can watch it.

**Two harness lies caught here, both worth knowing about:**

- A lane test was failing on its own stopwatch, not on geometry. 8.58 m walked
  against a 9 m expectation is `2600 ms × 3.3 m/s`, not a wall.
- The "landing is not boxed in" check was failing on a **pedestrian**. Citizens
  are obstacles and they walk the same 2 m lane, so a passer-by parked on the
  landing fails a check that exists to catch static geometry. Scanning the spot
  from a fresh load showed it clear in every direction. It retries now: a wall
  blocks all three attempts, a pedestrian has moved on by the next one.

# RUN 4 — PAWN SHOP (commit `75f9350`)

## `## Next` → **PAWN SHOP** — DONE, with one number still an assumption

The plan came out of the brief's own sentence — *"a pawn shop is built to keep
you at arm's length, and the geometry can say that"*. A 1.25 m counter at chest
height runs the whole room and dies into the east wall, so there is no way round
it; the customer gets a 1.1 m strip and that is the entire floor. The tools, the
TV stack, the guitars and the brass are all visible and none is reachable, which
is the difference between a pawn shop and a junk shop. Bars inside the window as
well as outside, so the daylight is in strips before it reaches you.

**The door needs its own pocket, and that is structural.** The kit lands you at
`(door.at, hd - 1.15)`, so a counter spanning the door's x would have to sit
1.51 m back to keep the landing clear — and 1.51 m of customer floor is not a
pawn shop, it is a shop. Putting the door beside the counter lets the counter
come forward and the brief survives. Worth knowing for any other room that
wants furniture near its door.

**The walk script needed the inverse of a lane test.** A room whose point is
that the far side of the counter is out of reach has to be checked for the gap
somebody could squeeze through — no number of passing lane tests says anything
about that. Three `noGo` probes assert you cannot get behind the counter at
either end or round the tool wall, and the back wall is skipped explicitly
rather than silently passed, because reaching it is what the room prevents.

Also fixed a crash of my own making: `Object.assign` onto `mesh.rotation`
replaces the `Euler` three.js hooks for quaternion updates, and the world
stopped initialising. `health.mjs` caught it before the walk did — which is the
argument for running it first rather than last.

---

## Verification, all four rooms

`scripts/G-rooms-walk.mjs` — table-driven over casino, hotel, tax and pawn, the
same move F made with `interiors-walk.mjs`. It reads each room's slab back from
where the player actually lands rather than hard-coding it, because the slab
depends on build order and that changes every time another builder lands a room.

- **99/99** over my four rooms.
- **F's `interiors-walk.mjs`: 78/78** with my four present, so nothing of F's
  broke.
- `node scripts/health.mjs` OK · `npm run build` clean · `ownership.sh G` clean.
- `fpadd`: **STREET UNMOVED**, **0 textures deleted outright**. It does report
  43 interior textures repainted — that is the grain reshuffle F documented
  between interiors, and it is an artefact of where my LOCAL test wiring went
  (my calls landed before `buildThrift`). Confirmed against the harness's own
  noise floor: two captures of an identical state differ in 0 textures and 0
  structure, so the harness is deterministic and the reshuffle is real but
  benign. **Appending the calls after F's avoids it entirely.**

---

## BLOCKED ON TWO OTHER PEOPLE, and neither is mine to fix

**1. F — four rooms are unreferenced until `crosstown.ts` calls them.** One line
each now, thanks to F's own change. Append them AFTER `buildThrift(ctx);` so the
fingerprint stays clean:

```diff
 import { buildThrift } from './ct/int-thrift';
+import { buildCasino } from './ct/int-casino';
+import { buildHotel } from './ct/int-hotel';
+import { buildTax } from './ct/int-tax';
+import { buildPawn } from './ct/int-pawn';
@@
   buildThrift(ctx);
+  buildCasino(ctx);
+  buildHotel(ctx);
+  buildTax(ctx);
+  buildPawn(ctx);
```

With those in, `SHOT_URL=http://localhost:4186/ node scripts/G-rooms-walk.mjs`
is 99/99. Without them all four files compile, are unreferenced, and four doors
on the street do nothing. I wire it locally to run the tests and revert before
committing every time — my queue says never to edit that file and F is working
in the same block, which is the conflict `OWNERSHIP.md` exists to prevent.

**2. D — `pawnFront` still paints no door.** Raised in my prep note before the
casino and still true. `burgerFront` paints one at `W*0.44`, `taxFront` at
`W*0.5`, `shopfrontTex` at `W*0.48`; `pawnFront` has no door rect at all, just a
board, a barred window and a stallriser. The room is built and walkable with its
`[E]` spot at the convention position (`z = -59.06`, within 6 cm of the building
centre), so this blocks nothing now — but until a door is painted there, the
player presses E at blank barred glazing. `DOOR_Z` in `ct/int-pawn.ts` is the one
line to change once it exists.

## A standing request for the kit, now that it has bitten twice

Still no way to recolour, move or suppress the kit's own ceiling glow, and two
of my four rooms are about their light: the casino wanted warm and dim and
nothing like civic daylight, and the tax office wants cool fluorescent strips —
the kit's warm incandescent blobs read as a different fixture among mine. Both
rooms ship fine because the palette does the heavy lifting and each room owns
its own lamps, so this is not blocking. But `light?: {...} | false` on `RoomSpec`
would let a room say what it is lit by. F's file, F's call.

## Queue state

All four room briefs in my queue are built, walked and committed. Nothing is
left under `## Now` or `## Next` that I can start.

---

# Carried over from BLOCKED-G.md (deleted — the wiring blocker it was written for is gone)

F replaced the two-lines-per-room wiring with auto-discovery in `ct/interior.ts`
(`import.meta.glob('./int-*.ts')`, sorted by path so slab addresses come from
file names). A room lands by existing. All four of mine are live.

**~~One fact outlives that note: `pawnFront` paints no door.~~ CLOSED — see the
PAWN section at the end of this file. The facade paints a door now, centred and
aligned with the declaration.** It is the only shopfront painter in that
file that does not — `burgerFront` uses `W * 0.44`, `taxFront` `W * 0.5`, and the
block default `W * 0.48`. Nothing is broken by it: `ct/int-pawn.ts` puts its
`[E]` spot where the convention would put a door (`W * 0.48` of a 96-texel
front, world `z = -59.06`, within 6 cm of the building centre) and the room
passes 25/25. The visible cost is that the player walks up to blank barred
glazing and gets a prompt from nowhere. A door drawn to any of the three
conventions lands inside the spot's 1.05 m trigger, so when D paints one,
`DOOR_Z` in `ct/int-pawn.ts` is the one line to change. Not a blocker; cosmetic.

Also still true and still not urgent: the kit's room lights cannot be recoloured
or suppressed (bitten twice — casino wanted warm and dim, tax office wants cool
fluorescent), and `ct/props.ts` was never needed for the vice night spill, so the
coordination the desk offered with B is not required.

---

# RUN 5 — THE CASINO AND HOTEL EXTERIORS

## `## Now` → **the exteriors** — DONE, in six commits

The user: *"the front facade of the casino and the hotel are so low effort and
boring. these building are meant to be some of the most insane."* They were
right, and the reason was structural rather than lazy: both buildings were built
by `street.ts`'s generic `placeBldZ`, so a casino and a hotel came out wearing a
barber's clothes.

**1 — the extraction** (`653e1923`). Pure move into `ct/vice.ts`, the same split
that took the library and the church into `ct/civic.ts`. Called from inside the
NORTH2 loop and the signs invoked at the point they used to run, because the
paint layer draws with a seeded `Math.random` under the harness. `fpdiff`:
**textures 422 vs 422 IDENTICAL, structure 1097 vs 1097 IDENTICAL**, two pigeons
1 cm apart. Doing this as its own commit is what made the next five verifiable.

**2 — the frontages** (`39ccb6ef`). Marquee, blade, porte-cochère, glass, spill.

**3 — light in the air** (`0b59a132`). Judged from the corner 45 m away, which
is the view the brief actually names, and it was the weakest of the lot.

**4 — the whole elevation** (`2ba0f89e`). Both buildings were lit at the ground
and dark above it, which is a lit shopfront, not a lit building.

**5 — the blank wall** (`7fa68803`). The casino had four storeys of sash windows
above its marquee, which contradicted its own windowless interior.

**6 — the hotel's blade** (`3572584a`). Two blades side by side is the image.

## The governing idea, and why it needed no help from anyone

**These two are the only buildings in the world that are light SOURCES rather
than lit surfaces.** Everything is unlit `MeshBasicMaterial`, so nothing emits.
Three mechanisms already in the world do the work:

1. `props.dimWorld` skips any material flagged `transparent`. Every bulb, tube
   and spill here is transparent, so the street falls away around them at night
   while they hold. They do not get brighter; everything else gets darker.
2. `fog: false` on the lit parts only, so neon burns through 40 m of haze.
3. The night curve is **read, not written** — `scene.background` carries the sky
   and a `mesh.onBeforeRender` hook reads its luminance, guarded on the
   renderer's frame counter so it runs once per frame. Calibrated off the real
   curve (0.30 at noon, 0.011 after 22:00), measured rather than guessed.

**So `ct/props.ts` was never touched and the coordination the desk offered with
B was not needed.** Worth recording why `props.lit` is the wrong tool even
though the brief suggested it: `lit()` registers an object to CATCH lamplight
from the nearest lamp head. A casino does not catch light.

## Things worth stealing

- **The chase is shared between both buildings.** Bulbs are fixed sockets and
  the chase is which of them are alight — a scrolling texture would carry the
  dead bulb along with it, and a dead bulb is a fixed socket. Three phase
  materials animate ~190 bulbs in three colour writes a frame. Both buildings
  run the same sequence on purpose: in step they read as one lit block, out of
  step as two separate mistakes.
- **Tubes, not stripes**: three passes over one letterform — dark casing,
  colour body, hot core. A stripe is one colour; a tube is all three at once.
- **On this street, screen-right is DESCENDING x.** Three orientation bugs came
  out of that. The street-facing box material is index 5 (−z), not 4, so the
  marquee's copy and the porte-cochère fascia were hung against the brick. A
  plane's normal is +z, which here points into the building. And turning the
  applied letters to face the road made ORPHEUS read backwards — every glyph
  correct, the word reversed.
- **Additive glow must hang clear of the surface behind it.** The first light
  pools sat 0.09 m under the marquee soffit and painted the soffit instead of
  the room.

## Two redraws, neither at the two-failures line

The mirrored ceiling — sorry, the mirrored **panels on the casino's first
version** — shipped pale and read as a frosted skylight with sun coming through,
in the one room whose premise is no daylight. A mirror is as bright as what it
reflects and this one reflects a dark red room. And the house's mark on the slab
was a spade that came out looking like a bird: a suit symbol needs curves and
there are not enough texels to spend on them. `777` needs none.

## Verification

`scripts/G-vice-walk.mjs` (new), **13/13**. The porte-cochère columns are the
only new geometry touching the pavement and that pavement is the tightest in the
world — a 2 m band with the building collider eating to −96.3. Measured: they
leave a **0.68 m clear band**, three times what the street lamps already leave.
The test asserts the honest thing rather than "every lane is open", because a
column you can walk through is not a column: the lane is continuous past both,
the outer lane *does* stop at a column, and you can step around it. It also
checks the redrawn entrances still agree with the `[E]` spots at x 51.29 and
39.51, which is the coupling that would silently strand both doors.

Also: `health.mjs` OK · `npm run build` clean · 48-shot sweep with no console
errors from my code · **95/95** across my four interiors · F's `interiors-walk`
**147/147** with all of mine present.

## Queue state

All five items are built, walked and in mainline. Nothing under `## Now` or
`## Next` is left that I can start. The only outstanding external thing is D's
missing `pawnFront` door, which is cosmetic and recorded above.

---

# RUNS 6–9, and A STATUS TABLE so the queue can be closed

My handoff stopped at RUN 5 while five more runs landed. That gap is probably why
the same eight items keep being re-issued: `## Done` in my queue file still says
*"(nothing yet — you are new)"* and nothing else tells the desk what is finished.
So this section is deliberately a ledger rather than a narrative.

## Every item in `notes/queues/G-interiors2.md`, and where it landed

| queue item | state | commit |
|---|---|---|
| The vertical blade signs read BACKWARDS (§10) | **DONE** | `c39b5b36` |
| The casino interior must match that exterior's vibe | **DONE** | `df223280` |
| The pawn shop is unreadable from inside | **DONE** | `15a13af3` |
| The casino and hotel EXTERIORS | **DONE**, six commits | `653e1923` `03cdac1a` `ae7981b6` `f33b59a9` `7fceb40a` `64a469e8` |
| THE CASINO — GOLDEN ACES (interior) | **DONE** | earlier run, see RUN 1 |
| HOTEL ORPHEUS lobby | **DONE** | `764547c`, see RUN 2 |
| PAWN SHOP interior | **DONE**, then relaid | `75f9350` → `15a13af3` |
| A-1 TAX SERVICE interior | **DONE** | `c63b2e4`, see RUN 3 |

Nothing under `## Now` or `## Next` is left that I can start.

## RUN 6 — the exteriors, four more passes

`ae7981b6` light in the air · `f33b59a9` the whole elevation, not just the
shopfront · `7fceb40a` the blank wall the 1984 refit made · `64a469e8` a hotel
blade to stand beside the casino's rather than behind it.

The one to steal from: **the chase is shared between both buildings.** Bulbs are
fixed sockets and the chase is which of them are alight — a scrolling texture
would carry the dead bulb along with it, and a dead bulb is a fixed socket.
Three phase materials animate ~190 bulbs in three colour writes a frame, and
both buildings run the same sequence on purpose: in step they read as one lit
block at the end of the street, out of step as two separate mistakes.

## RUN 7 — the blades, and why the obvious fix was the wrong one

`c39b5b36`. The construction was already right — two SINGLE-sided planes back to
back, never one `DoubleSide`. What was wrong is that I *also* painted the rear
one flipped. With the planes at `rotation.y = ±π/2` the geometry has already
supplied that flip, and the two mirrors cancel; painting one face flipped
un-cancels them. **So the fix was to remove a flip, not add one.** East was
correct and west was reversed, which is the exact asymmetry to look for.

Verified from both ends of the roadway on asymmetric letters, before and after,
and re-verified against current mainline: from the west HOTEL and ORPHEUS read
correctly, from the east GOLDEN ACES, 777, LOOSEST SLOTS, $2 BLACKJACK, ACES,
HOTEL, ORPHEUS and VACANCY all read correctly.

Related, for whoever is still auditing mirrored blades (`684ccf46`, `2edf2e72`,
`0ae4d9e7`): **the vice.ts blades are not among them.** They are checked from
both approaches and they pass.

## RUN 8 — the casino interior, matched to its facade

`df223280`. Gold valances over both slot banks with bulb runs, bulbs round the
cage and under the mirrors, the 777 on the back wall in the facade's own red
tube, and a chase running all of it at the marquee's tempo. Dim stays; drab goes.

The part worth keeping: **`tube()` is exported from `ct/vice.ts` and imported by
`ct/int-casino.ts`**, so GOLDEN ACES on the front and CAGE and 777 inside come
out of one painter. That is the difference between matching and resembling, and
it cannot drift.

## RUN 9 — the pawn relayout, and the people

`15a13af3`. The lesson generalises and is written at the top of the file:
**"kept at arm's length" is a property of the COUNTER, not of the customer's
floor.** One counter across the back, wall to wall, not wrapping; the whole
front of the room is customer floor; you land in the middle of it facing the
case, the guitars and the cage.

People: `e99d0c07` hotel clerk · `b33dfd6d` pawnbroker · `04213cab` tax preparer.
The casino dealer was done in parallel by `9f4313da`. Two of the four were not
swaps at all — the hotel and the pawn shop had **nobody** in them, and an
untended desk under a full key rack reads as a hotel that has shut.

The tax preparer stands beside his chair rather than sitting in it: the atlas
paints upright figures and a seated pose is not one of its five views, so faking
it would cut his legs off at the shin. **If seated staff are wanted that is an
atlas request for H, not a per-room bodge.**

## Two things I got wrong, recorded because they cost time

**1. I filed a BLOCKED-G.md that was wrong.** I reported the tax and pawn street
doors as unreachable, having scanned the whole east walk and found no prompt. The
measurement was real; the tree was not. I was sitting on a half-migrated pawn
shop where the door declaration had landed but the room still read its own typed
constant, so the facade and the trigger were 1.44 m apart and neither was where I
computed. Mainline finished both migrations, the doors work, and the note is
deleted rather than left to mislead.

**2. Mainline and I built the same things twice.** `8e348e4e` did the pawn/tax
door declarations and `9f4313da` did the casino dealer while I was building the
same two, and I lost a long time resolving rebase conflicts before thinking to
compare branches. Comparing first would have taken a minute. **Ticking items in
the queue as they land is what would have prevented it** — which is the other
reason this ledger exists.

## Verification, current mainline

`scripts/G-rooms-walk.mjs` **98/98** over my four rooms · `scripts/G-vice-walk.mjs`
**13/13** on the frontages · `scripts/people-walk.mjs` — *8 atlas figures inside,
no hand-drawn people left indoors* · `node scripts/health.mjs` OK · `npm run
build` clean · `./scripts/ownership.sh G` clean.

---

# The pawn shop's window is still authored twice — and why I did not fix it

`ct/int-pawn.ts` supplies `frontage` AND overrides `window: { at: 2.6, w: 3.6,
h: 1.5, sill: 0.95 }`. `RoomSpec` says an override is allowed but should be
justified, and there is no justification here — it is the last duplicate number
in my four rooms, and the inside bars are positioned against it, so a roster
change moves the glass and leaves the bars behind.

**I tried to remove it and backed the change out.** Recording the attempt so the
next person does not repeat it:

Dropping the override lets the kit cut the opening from `frontageOf`, which is
correct. The bars then have to follow the DERIVED glazing, and a room cannot see
where that is. `Room` exposes `doorAt` but not the glazing span, so I converted
`F.glazingStartM/glazingEndM` into local x myself, mirroring `interior.ts`'s
`localOf`. Two attempts, both wrong on screen:

1. a panel each side of the doorway — but the pawn's glazing is ONE run with the
   door cut near its end, so the left panel landed on a solid brick pier;
2. deriving the span from `glazingStartM/glazingEndM` through my own copy of the
   conversion — still a wide panel over brick, so my conversion does not agree
   with the kit's.

Bars over a brick pier read as a mistake in a way that missing bars do not, so
the typed override is back and the room is verified at 27/27.

**Since writing that I read the kit and found why both attempts failed, so the
ask can be precise.** `interior.ts` does not use the frontage's glazing run as
it stands — it converts both ends, then **trims the glass to whichever side of
the door has the bigger run**:

```ts
// keep whichever side of the door is the bigger run of glass
if (a < dl && b > dr) { if (dl - a >= b - dr) b = dl; else a = dr; }
```

So the opening is only ever on ONE side of the door, which is exactly what both
my attempts got wrong — the first assumed glass flanks a door, the second used
the untrimmed span. No amount of care in the room would have got there, because
the trimming is a kit decision the room cannot see.

**What would close it: `Room.glazing` — the local `{ at, w }` the kit already
computes as `glaze`, returned the way `Room.doorAt` already returns the derived
door.** It is one line in the return object; the value exists. Then a room can
hang bars, blinds, a grille or a display riser on real glass without re-deriving
anything and without copying the trimming rule, which is the part that would go
stale silently.

I am not replicating those twelve lines in my room. Duplicated LOGIC is how the
door positions drifted in the first place, and this file is where I would be
copying it from. F's file, F's call — until then the typed override stays and
this note is the justification `RoomSpec` asks for.

Two failed attempts is the "two failures then delete" line, so I have stopped
rather than trying a third conversion.

---

# AUDIT-TRIAGE items 3 and 4 — both closed, with evidence

The triage is the auditor's file so I have not edited it. Recording the outcomes
here instead, because item 4 in particular will re-raise itself otherwise.

## Item 3 — "four of eight rooms have no keeper" — STALE, no change needed

`interior-audit.md` R16 sampled people at x ≈ 442, 517, 678, 1002 — slabs 0, 1,
3, 7. My four rooms are slabs 2, 4, 5 and 6, so on that measurement mine were
the empty half.

Re-measured by counting the 160×128 citizen atlas per slab: **8 of 8 occupied,
one keeper each.** `scripts/people-walk.mjs` agrees — 8 figures, no hand-drawn
planes. R16 predates the hotel clerk, the pawnbroker and the tax preparer
landing, so nobody was missing and nobody was added.

The real thing under it was consistency: the casino had moved to the kit's
`room.person()` while my other three still called `citizenSprite` and wired
their own `ctx.onFrame`. All four use the wrapper now (`9748be19`).

## Item 4 — casino ceiling — RAISED 2.50 → 2.90 (`73aeb2a4`)

**Resolved.** For a while `scripts/rooms.mjs` kept reporting `ceiling 2.5` for
slab 2 while the geometry on the same server measured the kit's ceiling plane at
2.90, the mirror at 2.88 and the wall boxes topping out at 2.90 — including
after a full dev-server restart, which is why I flagged it rather than assumed
my own change had not taken. It now reports **2.9** and agrees with the
geometry, so nothing is outstanding here and item 4 should not re-raise. Leaving
the episode recorded because the lesson stands: when a check and the world
disagree, measure the world directly before believing either.

Also worth knowing for anyone raising a room's height: six fittings in the
casino were typed as absolute heights and would have been stranded 0.4 m low —
the valances, four bulb runs and the cage sign. They are measured down from
`room.H` now. A room that hangs things off its ceiling should express them that
way from the start.

## Item 0 — masonry density — `ct/vice.ts` is NOT a contributor

Item 0 routes to `masonry()` "+ callers", and vice.ts is a caller: two shopfront
bands at `SHOP_MULT` and the casino's skin panel at mult 1. Checked with
`scripts/masonry.mjs`:

```
stamps checkable against geometry: 236
stamps that DISAGREE with their face by >0.6 px/m: 0
declared OFF the 8/16 grid: 1  — 32 px/m at (8.3, 0.1, -77), not mine
```

`scripts/seampairs.mjs` reports no disagreeing pair anywhere on the side street
either; everything it lists is the bodega corner around x 8–10. So the two vice
facades can be excluded from that pattern.

---

# For the seam audit: four of the unstamped faces are my glow planes

`scripts/seampairs.mjs` got better at pairing (`dbabd99f`, faces by their own
rectangles rather than mesh bounding boxes) and the improved list now includes
four surfaces from `ct/vice.ts`:

| face | what it actually is |
|---|---|
| `2.56×4.71` at (51.3, 0.1, −99.4) | the casino's spill on the road |
| `2.56×4.85` at (39.5, 0, −99.7) | the hotel's spill on the road |
| `8.89×10.67` at (44.4, 0.2, −97) | the blade's spill on the pavement |
| `1.45×3.56` at (45.2, 5.2, −98.6) | the low haze sheet over the frontages |

**None of them is masonry and none of them can be.** They are additive glow
decals — `blending: THREE.AdditiveBlending`, `transparent: true`,
`depthWrite: false` — whose texture is a radial falloff. Their px/m is not a
brick scale and comparing it to a wall's produces a ratio that means nothing.

The tool already has the right instinct and the right argument for it:

> The fix is not to name ivy — a list of things to ignore is the stale-constant
> habit — but to ask something that is actually diagnostic: MASONRY IS NEVER A
> CUT-OUT.

The same sentence finishes itself one clause further: **masonry is never
additive, and never transparent.** A surface that ADDS light to whatever is
behind it is a glow; a wall occludes. That is diagnostic in exactly the way
`alphaTest > 0` is, it needs no list of names, and it is one condition:

```js
if (!ms && (fw < 2 || fh < 2 || m.alphaTest > 0
            || m.transparent || m.blending === THREE.AdditiveBlending)) return;
```

I have not touched `seampairs.mjs` — it is the auditor's. Flagging it with the
instances so the next candidate list is not four glow planes and a paving slab.

Nothing to change in `ct/vice.ts`: the four surfaces are correct as they are,
and they are the reason the two buildings read as light sources at night.

---

# I watched my own corrected checks fail, and one of them did not

`dbb45d11` makes two silent-pass guards reachable and watches them fail. I had
just spent three rounds fixing my own instruments and had not done that, so I
did — and it corrects something I overstated.

**The experiment.** `095c7d63` found the casino and hotel `[E]` spots drifted
0.25 m from their published door. I had claimed my walk checks were blind to it
because they typed the door position, and that deriving it from `doorStandFor`
fixed that. So I put the drift back — restored the hand-typed
`x: DOOR_X, z: WALK_Z` in `ct/int-casino.ts` — and ran the corrected check.

**26/26. It passed.** The derived check does not catch a 0.25 m drift either.

**Why, and it is obvious in hindsight.** The check stands where the declaration
says to stand and asks whether the prompt appears. The trigger radius is 1.05 m.
A spot 0.25 m off still fires. Deriving the number removed the STALENESS — the
check can no longer be verifying a coordinate the world has moved on from — but
it never gave the check the resolution to see an error smaller than its own
tolerance.

**So the claim in `d955a0fc` was too strong.** "A check that types the number it
is checking is decoration" is right about staleness and wrong if read as "and
therefore deriving it makes the check sharp". Two different properties, and I
conflated them.

**Not adding an exactness check here.** `scripts/spots-walk.mjs` already asks
whether every spot sits on its building's published door, exactly, and that is
the right place for it — it is a world-wide sweep over all 80 spots rather than
four rooms' worth. Duplicating it in my suite would be a second authority on the
same question, which is the fault I have been removing all session.

The division of labour worth stating: **my suite tests that a player standing at
the door can get in; `spots-walk.mjs` tests that the door is where it says it
is.** Neither substitutes for the other, and mine should not pretend to.

---

# My `Room.glazing` ask is not "one line", and it should not be rushed for me

I have been describing this for a dozen rounds as *"one line in `interior.ts`
returning the `glaze` value the kit already computes"*. `notes/A-glazing-handoff.md`
and `44332d50` show that is wrong in two ways, and both are worth correcting
because I am the reason the request exists.

**1. The two-line patch does not compile, and its obvious fix deletes the diner's
window.** A wrote it from reasoning, then applied and measured it: the fields it
references do not exist on the `Frontage` shape, and made to compile with a
side-based mirror it replaces the diner's window — head, transom, apron and sill
— with one solid 4.03 × 2.60 panel, because `fr.side` and `uDir` disagree there
and the mirror lands twice. The form that works converts world → `alongU` with
the frontage's own `uDir` and reuses `localOf`; that one is a genuine no-op, 0 of
226 room meshes changed.

**2. My ask lands on deprecated fields.** `glaze` is computed from
`F.glazingStartM` / `F.glazingEndM`, two of the four fields A has marked
`@deprecated` and the reason `BLOCKED-A.md` exists. If `Room.glazing` ships
reading those, **every room that adopts it becomes a new consumer of an API
somebody is trying to delete** — and my pawn shop would be the first.

**So: do not ship it on my account, and do not ship the quick version.** The
pawn shop's typed `window` override is one duplicated number in one room, with a
written justification and 27/27 on its walk. That is a smaller problem than four
new consumers of a deprecated field. It waits for the world-coordinate form, or
it stays as it is indefinitely — both are fine and neither is urgent.

Recording it because "one line in someone else's file" is the kind of estimate
that sounds like a favour and turns out to be a trap. I made that estimate
repeatedly without having applied it; A applied it and found two failures inside
one attempt.

---

# A-1 TAX mirrors correctly — a third measurement on one of A's four disputed rooms

`notes/A-mirror-harness.md` has the harness calling all four measured rooms
**SAME SIDE** while `A-mirror-verified.md` records those same four walked by hand
as mirroring correctly, and A says plainly that one of the two is wrong, that the
untested half is the side convention, and that validating it against the
hand-verified rooms is the next thing to do. A-1 TAX is one of the four and it is
mine, so here is an independent third measurement of it.

**It mirrors.** Shots taken this round:

| | door | window |
|---|---|---|
| inside, facing the front wall | **RIGHT** | left |
| outside on the walk, facing the facade | **LEFT** | right |

Opposite sides, which is what the user asked for: *"if the door on the interior
is full right then the facade must match."*

**And it is predictable from the declaration, not just visible.** This is the part
worth having, because it is checkable without a screenshot:

```
inside,  facing the front wall (+z local):  fwd (0,0,1)  → right (-1,0,0) = -x
         door at local x -4.2, screen-right is -x         → appears RIGHT
outside, facing the facade (+x world):      fwd (1,0,0)  → right (0,0,1) = +z
         door at world z -20.13 in a frontage spanning -22..-9,
         so it sits toward the -z end and screen-right is +z → appears LEFT
```

Two observers, opposite handedness, one declaration. The mirror is a property of
standing on the other side of the same wall, so it needs no bookkeeping — which
is the argument `ct/doors.ts` already makes.

**So the harness's `observerRight` convention is the half that is wrong**, on this
room at least: `side < 0 ? -1 : 1` outside is a function of the building's side
only, and the two derivations above show the observer's right depends on which
way they are FACING, which is opposite in the two cases by construction. A single
sign flip on the outside term would move A-1 TAX from SAME SIDE to mirrored
without touching the inside term.

Not editing the harness — it is A's. This is the evidence for one of the four,
measured two independent ways that agree with each other and with A's own
walk-through.

---

# PAWN: its facade door exists now, and it cannot be mirror-verified

Two things measured this round, both about the same room.

## 1. The door I reported missing is there — that blocker is closed

For a long stretch I reported `pawnFront` painting no door, with the visible cost
that "the player walks up to blank barred glazing and gets a prompt from nowhere".
**That is fixed.** Standing on the walk facing the frontage there is a recessed
dark doorway dead centre, barred glazing either side of it, PAWN on the fascia and
the three gold balls at one end. It sits where the declaration puts it — `at: 0`,
world z −60.50, the frontage centre.

So the last outstanding item from my old BLOCKED note is gone. Nothing left in the
pawn shop needs another owner except the parked `Room.glazing` ask.

## 2. It is the fifth room A's harness cannot verify, and that is not a harness fault

`A-mirror-harness.md` has PAWN as the one unmeasured room of five, with its front
wall reading at z −2.52 — the back wall — noted as a separate fault. Worth saving
someone the chase: **even with that fixed, PAWN's door yields no handedness
signal, because it is dead centre.** A centred door looks identical from both
sides of its own wall. There is nothing to mirror.

Measured to be sure rather than argued:

| | door | barred window |
|---|---|---|
| inside, facing the front wall | centre | LEFT of the door |
| outside, facing the facade | centre | glazing BOTH sides |

The window is off-centre inside (local x +2.6) so it *would* carry handedness —
but the facade paints continuous glazing on both sides of the door, so there is no
unique counterpart on the outside to compare it against. The kit trims its opening
to whichever side of the door has the bigger run, which is why one room window
faces two facade bays.

**Do not move the door to make it testable.** It is centred because the desk chose
centre when I asked, and changing the world to suit an instrument is backwards.
The right conclusion is that this room is exempt: four of five verify, and the
fifth has no asymmetry to check. If a handedness check over all rooms is wanted,
it should skip rooms whose declared `at` is 0 and say why, rather than report them
as unmeasured.

## 3. The side-street doors were authored twice, in my own file (c953e3a0)

Found while checking whether A's `ct/doors.ts` circular-import finding
(`709ddfed`) was actually biting. It is not, at that HEAD — all eight
declarations resolve, mine included, measured in the browser:

```
declarations collected: 8
A-1 TAX | BODEGA | BURGER BARN | DINER | GOLDEN ACES | HOTEL ORPHEUS | PAWN | THRIFT
doorStandFor: GOLDEN ACES=ok  HOTEL ORPHEUS=ok  A-1 TAX=ok  PAWN=ok
```

So the cycle is **latent, not active** — worth fixing, not urgent.

But looking for it surfaced the same defect one layer down in `ct/vice.ts`:

```
vice.ts:148   const doorU = 0.4944;    // == world x 51.29
vice.ts:239   const doorU = 0.495;     // == world x 39.51
```

against `face: { x: 51.29 }` and `{ x: 39.51 }` in the two rooms. **One fact,
two authorings** — and the silent kind, because the failure is a painted door a
metre from the `[E]` prompt and nothing throws. This is the fourth time this
exact class has come out of my work; the first three were in
`scripts/G-*.mjs` and I had assumed the source was clean because I had been
looking at the checks.

`VICE_DOOR_X` in `vice.ts` is now the only authoring. The band painters derive
`u`; both rooms read `face.x` from it.

### Why the arrow points painter → room, which is backwards

The natural direction is for the painter to ask `doorPointFor` for the
declaration. **That one is not safe yet.** `vice.ts` paints during
`buildStreet`, which runs before any `int-*.ts` module is evaluated, so calling
`doorPointFor` there reads the glob mid-initialisation — precisely A's hazard.
Painter → room adds no cycle at all, because both rooms already import `tube`
from `vice.ts`. **When `doors.ts` is split so its lookup globs nothing, this can
and should invert.**

### The prose was wrong too, and had been all along

Both room headers did the same arithmetic in words, and **both figures in both
files were wrong**: "u = 0.4946 of a 92-texel shopfront" against a real 185
texels at 0.4944, and "0.4948 / 96" against 192 at 0.495. Wrong for as long as
they had existed, with nothing visibly out of place, because prose is not
compiled and no check reads it. Worth stating as its own category: the
two-authorings rule applies to comments, and comments are the copy that cannot
fail loudly.

### Verified world-neutral rather than asserted

- derived `u` lands on the **same texel** as the literal (91 and 95)
- `fpdiff`: **textures IDENTICAL 954/954, structure IDENTICAL 3489/3489**
- the 3 `tints` diffs are the chase recolouring its own shared materials
  mid-animation; the 2 `places` diffs are pigeons 2 cm apart
- `tsc` clean; all 8 declarations still resolve, no `NaN`

## 4. Two faults in MY OWN walk scripts, both found by a failure I nearly dismissed

The commit above verified clean, but the two walks came back **12/13 and
101/102** where both had been green. Neither failure was the change — mainline
with my work stashed passes 102/102, and the fingerprint says no geometry moved
— but "my diff cannot have caused it" is the reasoning that has burned me
before, so I measured instead of arguing.

**`G-vice-walk.mjs` — `runEast(..., 1)` turned a citizen into a facade defect.**
The check reported `x = 34.00`, its own start point. Probing that lane by hand
straight afterwards reached **36.06 — the column, exactly where it belongs**:

```
z=-97.5  landed x=34.00  →  reached x=36.06     (expected band 35.8 … 36.6)
```

`runEast` takes the **max** over its tries and its own comment says "citizens
are obstacles too". For a check of the form *you get this far and no further*, a
retry can only correct a wanderer blocking the start — there was never a reason
to pass `tries = 1`. Fixed to the default 3. The upper bound stays, so a
vanished column still fails.

**`G-rooms-walk.mjs` — the doorway check was measuring the clock.** It held `w`
for a fixed 2600 ms, which covers ~8.2 m; the hotel's run from `clearZ` to its
front wall is 8.4 m. So the walker was stopping *because the hold expired*,
about where the wall is — **0.21 m between "the collider held" and "time ran
out", with no way to tell which**. A leak of up to a fifth of a metre would have
read as a pass forever. Now it walks until the player stops moving, which is the
fix this same file already applied to the prompt walk 100 lines above. I fixed
that one and left its twin directly below it.

**One thing I could not explain, left in the file rather than tidied away.** The
doorway check failed once with `z = 9.00` and that is still the only observation:
five walk-until-stopped probes at that doorway all stop at **z = 4.29**, and
baseline passes too. I do not have the mechanism. It is recorded in the source at
the check, because *"it passed when I ran it again"* is exactly how a real
intermittent leak gets closed.

### The pattern across all three

Every one is the same shape as something I had **already fixed elsewhere in the
same file** — the typed constant, the fixed-time hold, the number copied out of
the world into the check. Knowing the class does not find the instances; only
running the thing and disbelieving the green does.

Also, minor, for whoever maintains the docs: `CLAUDE.md` documents the sequence
as `npm run fp before` → `npm run fp after` → `npm run fpdiff`, but `fpdiff`
takes two paths and throws a `TypeError` on `undefined` without them. It is
`npm run fpdiff -- shots/before.json shots/after.json`.
