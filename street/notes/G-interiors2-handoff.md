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

**One fact outlives that note and should not be lost with it: `pawnFront` in
`ct/street.ts` still paints no door.** It is the only shopfront painter in that
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
