# Builder F — handoff

Working from `notes/queues/F-interiors.md`: read it, take the top unchecked
item under `## Now`, commit, re-read before the next. I do not edit that file —
completions are reported here.

---

# RUN 2 — the BURGER BARN (commit `343ad61`)

## `## Next` → **BURGER BARN interior** — DONE

The user walked up to this building and could not get in. There was no `[E]`
spot and no interior. Both exist now, and the door was the harder half.

### The door is derived, not guessed

The queue said the facade painter draws a door at `W * 0.44` and that the spot
has to land on the world position that corresponds to it. Working it out:

| step | value |
|---|---|
| `burgerFront` paints `fillRect(round(W * 0.44), 23, 4, 25)`, W = 16 × 8 | texels 56…59 |
| centre texel | 58 → **f = 0.4531** |
| west facade is the **+x** face of a box; three.js runs u along **-z** there | `z = cz + w/2 − f·w` |
| BURGER BARN is WEST slot 4 — 9.2 + 10 + 16 precede it from z = 14.2 | spans z −21…−37, cz = −29 |
| | **z = −28.25** |

That is **3.75 m north of the building's middle**. Putting the spot at the
middle — the obvious guess — would have put it in front of the glass.

Proved two ways. Walking: the prompt comes up approaching from the north, from
the south, and straight in from the kerb. Looking: standing on the spot facing
the facade, the painted door strip is dead centre in frame
(`shots/` capture during the run; screenshots are for looking, §1).

### The room

The diner and this are the two ends of the range the other eight interiors sit
between, so every decision is the diner's opposite: tile to the waist and
painted block above, quarry tile instead of a checkerboard, an order counter
you stand at (1.15 m, no overhang, no knee room) instead of one you sit at, a
crew wall of fryers and a warming chute instead of a domestic back bar, three
**different** backlit menu boards, moulded pedestal tables with swivel stools
bolted to the floor, and no soft seat anywhere. Cool fluorescent troffers
against the diner's warm opal domes.

The palette is read off `burgerFront` rather than re-picked — it says "Change
them here, nowhere else" and the walls are `BB_INSIDE`, the colour the facade
paints behind its glass. Walk in and the wall is the colour the street showed
you. Red and beige; the user rejected red/yellow twice.

The left third of the floor is deliberately empty — that is the queue, and
furniture standing in it would be furniture nobody could reach at lunchtime.

### Five things went into the KIT, not into this room

Because eight more rooms are coming and they should inherit the fix:

1. **A fixture, and a stepped glow.** The kit's ceiling light was a bare smooth
   radial gradient — *exactly* what the user already rejected on the walk-up:
   *"there is no fixture at all… it reads as a smudge rather than a light"*,
   *"a smooth radial gradient in a world that is entirely hard-edged
   nearest-filtered texels"*. It was queued to ship nine more times. Now
   `light: { kind: 'dome' | 'troffer' }` hangs a real fitting and the halo is
   quantised onto the texel grid.
2. **`wainscot`** — a tiled dado painted into the plaster. Default tile 0.32 m,
   deliberately larger than real wall tile: at ~12 px/m anything under 0.25 m
   draws a one-texel tile beside a one-texel joint and reads as a dotted line.
3. **Window mullions and a transom.** Six metres of unsupported glass is not a
   shopfront, and as a single pane it was a flat slab taking a third of the room.
4. **`interiorColliders()`** — rooms collect their own colliders, so the array
   in `crosstown.ts` is spread once and never grows again. Adding a room is now
   **one line** in the entry point.
5. **The light housing is painted metal, not the room's trim.** Trim is right
   for mullions and skirting; a light fitting is a bought object. Taking TRIM
   gave the burger barn bright red ceiling troffers.

### A correction to RUN 1

I wrote that building interiors last made them *"provably additive"*. **Only
the street half of that is true.** three.js spends four `Math.random` calls per
object in `generateUUID`, and the fingerprint harness seeds `Math.random` — so
creating *any* object reshuffles the grain of every texture painted after it,
not just `dither()` calls. Interiors therefore repaint each other, and changing
the kit repaints all of them.

That is harmless (the shipped world's `Math.random` is unseeded and repaints
every load anyway), and the property actually worth having still holds: nothing
street-side is created after the belt, so **the street cannot be touched**. The
comment in `crosstown.ts` now says this accurately, and `scripts/fpadd.mjs`
reports it properly — it pairs vanished street positions against new ones
within 0.3 m (a pigeon taking a step, not a prop moving) and matches lost
textures by pixel size to tell a repaint from a deletion. Final run:
**STREET UNMOVED, 0 textures deleted.**

### Two hours lost to a pedestrian, and what came of it

An approach test failed identically on three consecutive runs, which is what a
static collider looks like. It was a **citizen** standing on the pavement — the
timing was reproducible enough to mimic determinism. `crowd.ts` turns a citizen
non-solid after it has blocked you for 1.4 s, so a player who keeps walking
always gets through; my test gave up after 1.5 s. It now holds for 4 s and
watches for the prompt *during* the walk rather than reading it at the end
(4 s of walking is 13 m — it was blowing straight past the door).

What resolved it was a new **`__ct.colliders()`** test affordance. "Is my `[E]`
spot inside something solid?" is the most expensive question in this project —
GOTCHAS §8, and the reason the bodega was un-enterable — and it was previously
only answerable by bisecting the pavement with the player. The suite now asks
it directly: *no static collider is parked on the spot*, with citizen-sized
boxes excluded.

**Desk: `__ct.colliders()` is a read-only debug accessor in the `__ct` block of
`crosstown.ts`, outside my interior-belt carve-out.** It cannot affect world
behaviour. Drop it if you would rather it did not live there.

### Verification

`scripts/interiors-walk.mjs` replaces `diner-walk.mjs` and covers **both**
rooms — three approach directions each, the static-collider check, spawn
facing, floor height, all four walls, the doorway leak, the room end to end
both ways, the way out, the landing not being boxed in, and still lit at 2am.
**48/48.** Plus health OK, 48-shot sweep with no console issues, `npm run
build` clean, and the fingerprint above.

---

# RUN 1 — verify and finish the kit and the diner (commit `34167b1`)

## `## Now` → **Verify and finish the kit and the diner** — DONE

Rebased onto `add-stick-and-city98` first (two commits behind; the rebase is
what brought my queue file into the worktree). Then walked everything.

The queue said to treat every line as suspect. That was the right call —
**six defects, four of them in the kit**, so the fix goes to the nine rooms
still to come rather than to the diner alone.

### What was wrong

| # | defect | where |
|---|---|---|
| 1 | you spawned facing the wall you had just walked through | kit |
| 2 | the whole interior went dark at 2am | kit |
| 3 | you could walk out of the doorway into the dead ground between slabs | kit |
| 4 | stepping out landed you inside the re-entry trigger | kit + diner |
| 5 | the door leaf swung through the jamb | kit |
| 6 | `interiorGround` / `INTERIOR_MAX_X` claimed ground no room owned | kit |

**1 — facing.** The kit jumped you in at yaw `Math.PI`. `fp.ts` has
`fwd = (sin yaw, 0, -cos yaw)`, and the door is in the `+z` wall, so `Math.PI`
points you at the door you just came through. Now yaw 0. You also land a
stride deeper than the trigger rather than on top of it.

**2 — the night sweep, and this one is a trap for every other room builder.**
`props.dimWorld` picks what the night may darken by reading each object's own
`position.x` and skipping `|x| > 100` — and that is the **local** position, not
the world one. The kit parked the room group at its world address and hung
local-coordinate children off it, so to the sweep every stick of furniture
looked like it was standing on the street. 96 of 96 interior materials dimmed
at 2am, in a room whose entire premise is that a lit window at 2am means
something. The group now sits at the origin and `put` writes world positions.
`Room.group` carries the reason in a comment; **add through `put`.**

This is also why the door leaf is swung by arithmetic instead of by a pivot
`Group` — a child of a nested group carries a local position, and the leaf
alone went dark while the room stayed lit. Nested transforms are not free here.

**3 — the room leaked.** The doorway is deliberately a gap in the collider
line so the way-out `[E]` spot stays reachable (GOTCHAS §8 — a collider that
swallows a trigger is how the bodega became un-enterable). But nothing stopped
you *past* it: walking at the door carried you out to z = 8.6, through the
front wall and onto dead ground. Blocked on the **far** face of the wall, which
stops you at z = 3.28 while leaving the trigger at 2.95 comfortably reachable.

**4 — the landing.** Exit put you at `-(FACE - 1.1)`, which is 0.65 m from a
1.05 m re-entry trigger: the street prompt still read `into the DINER` and the
next E — the key you are already pressing — took you back. The diner now steps
out *along* the walk, 1.5 m down it, still inside the 2 m lane. **The kit now
warns** when a spec does this:

```
[interior:diner] stepping out lands 0.65 m from the way-in spot, inside its
1.05 m trigger — you will be sucked straight back in. Move outX/outZ at least
1.40 m clear.
```

**5 — the leaf** was a plane positioned at its centre and then rotated, so its
inner half swung back through the jamb. Hinged on the outer face now.

**6 — addressing.** `interiorGround` returned 0 for *any* x past 400, and
`INTERIOR_MAX_X` reserved sixteen slabs whether built or not — which moved the
world's east bound from 260 to **1680**. Both derive from slabs actually
claimed now. See the bodega note below for what that uncovered.

### The front wall now checks its own openings

Queue item 2 was right that nothing validated the door and window. The wall is
built as the runs *between* its openings, which only yields a wall if they are
inside it and disjoint — and the failure is silent, because negative-length
runs are dropped. You get a room with a hole in it and no clue why. All three
guards were proved by deliberately breaking the spec and reading them back:

```
[interior:diner] the window spans -5.95…3.95 but the front wall only runs -4.48…4.48 — dropped
[interior:diner] the window overlaps the opening at -3.17…-2.03 — dropped
```

The door wins any clash: a room with no window is a room, a room with no door
is a bug.

### Interiors are built LAST, and must stay last

GOTCHAS §2 is about the seeded `rnd()` stream, but the same argument applies to
the paint layer's `Math.random`: the fingerprint harness seeds it, so a module
that paints mid-build shifts the grain of **every texture painted after it**.
Built where it was, the diner made `fpdiff` report *71 textures differ* when
not one had changed. Moved to the end of `makeCrosstown`, it is provably
additive. **Ten interiors are coming — leave the call where it is.**

`scripts/fpadd.mjs` (new) is the diff to use for this programme.
`fpdiff.mjs` compares the sorted dumps index by index, so any insertion shifts
the tail and the whole thing reports as changed. `fpadd` compares them as
multisets and splits the answer into *lost* (must be 0) and *gained* (your new
work). Final state: **0 lost textures, 0 lost structure**; the only street
`places` differences are seven pigeons drifting, which GOTCHAS §1 calls the
noise floor.

### Two style misses, both found by looking

- **The plaster canvas was a fixed 32×54** whatever the ceiling height —
  ~12 px/m across and ~18 px/m up, so texels were half again as tall as wide
  and every speck of grain came out a dash. Sized off the same px/m in both
  axes now, and the dirt is weighted toward the floor: an even scatter over a
  big flat wall two metres from your face read as mould, not plaster.
- **The booths were built for giants** — 2.4 m benches around a 2.2 × 1.1 m
  table, sat next to a 1.15 m door. Right-sized to a 1.35 m bench and a
  1.15 × 0.7 m table, and **three** now fit under the window where two
  sprawled. Three is also what makes it read as a diner rather than a room
  with tables in it. They block as **one** collider, not nine: the dividers
  are 0.25 m apart, narrower than the 0.72 m player, so per-bench boxes only
  create slots you wedge into.

Formica also had the GOTCHAS §5 problem — one unrepeated tile stretched over
whatever it landed on, 10 px/m across the counter and 55 px/m across a table,
which is why the tables looked strewn with crumbs next to a clean counter.
Repeat derives from metres now.

### Verification

`scripts/diner-walk.mjs` (new) drives the real rig — enter from the street,
facing, floor height, the floor mesh agreeing with the picker, all four walls,
the doorway, the lane both ways, the way out, the landing not being boxed in,
and the room still lit at 2am. **21/21.** Plus `health.mjs` OK, 48-shot sweep
with no console issues, `npm run build` clean, fingerprint additive.

Two of its checks are there because the harness lied to me first: three probes
originally started inside a collider's 0.36 m pad, where the rig cannot move in
*any* direction, and reported "the wall held" having never taken a step. It now
fails a probe that does not move.

---

## FOR THE DESK — two things that are not mine to fix

**1. `ct/bodega.ts` has a gap in its east wall at z ≈ -21.** Sprinting east
from inside the bodega goes straight through it. This is **pre-existing** — the
old `maxX: 260` bound was covering for it — but moving that bound out to the
interior belt un-hid it, and you could then run 200 m across the dead ground
toward the slabs. I put a wall back at x = 260 in the interior-belt block,
which restores exactly the old behaviour, rather than reaching into a file I do
not own. The gap itself is still there behind it. `bodega.ts` has no entry in
`OWNERSHIP.md`.

**2. `scripts/ownership.sh F` flags `src/proto/crosstown.ts`.** Expected — my
queue grants me "the interior-belt wiring in `crosstown.ts`, which is otherwise
desk-owned", and the script does not know about that carve-out. My diff there
is confined to it: the import, the build call, the collider spread, the east
wall above, the `maxX` bound, and the `groundY` branch. Nothing else.

## FOR BUILDERS G, E AND C — the kit's rules

You furnish in local coordinates and the kit does the rest. Three things will
bite you if you go around it:

1. **Place through `room.put`, never `room.group.add`.** The group is at the
   world origin on purpose; local-positioned children get eaten by the night
   sweep. Same reason: no nested pivot groups for furniture.
2. **Read the console.** The kit warns about openings that do not fit and about
   an exit that lands inside its own trigger. Both are silent bugs otherwise.
3. **Your exit must land ≥ trigger radius + 0.35 m from the way-in spot**, and
   prefer landing *along* the walk rather than out toward the kerb — the 2 m
   lane is sacred (GOTCHAS §9).

If the kit is missing something you need, ask me and I will add it — per the
queue, `ct/interior.ts` is not yours to edit.

---

## Next up (as of RUN 1)

`## Next` in my queue is the **BURGER BARN** interior, then the **THRIFT
STORE**. — *Burger barn done in RUN 2 above; thrift store not started.*

---

# QUEUE EMPTY — state, and one thing I found but did not build

My queue file still lists 20 open items; all 20 are landed except the two in
`notes/BLOCKED-F.md`. Verified against the running world rather than from
memory:

| suite | result |
|---|---|
| `world-wired.mjs` | 8 interiors on disk, 8 in the world |
| `interiors-walk.mjs` | 195/195 across all eight rooms |
| `spots-walk.mjs` | 79 live `[E]` spots, all reachable and attached |
| `seats-walk.mjs` | 56/57 |
| `people-walk.mjs` | no hand-drawn people left indoors |
| `steps-walk.mjs` | both flights climb and descend |
| `park-walk.mjs` | every open site walkable to its far edge |
| `unstick-walk.mjs` | 177/177 traps release the player |
| `jump-walk.mjs` | lands you on the floor you left, everywhere |
| `E-walk.mjs` (E's) | 18/18 |

## Blocked, both measured, both in files I do not own

1. **A 0.4 m post pinches the side-street walk outside the casino** to 0.43 m
   of standing room, on the approach to a door. GOTCHAS §9. H or D.
2. **The church flight stops 0.44 m short of its doors**, inside
   `placeChurchEast`'s blanket footprint box in `ct/street.ts`. D.

## A decision, not a blocker

Neither civic flight leads anywhere — no `[E]` at the top of either, and
neither building has an interior. My recommendation is a **locked-door
response** rather than two more rooms: a climb that ends in a prompt is honest,
a climb that ends in nothing is not, and four rooms already in the world are
ahead of it in value. Content call, so I have not made it.

## What I found looking, and deliberately did not build

**The diner's left wall is blank** — the whole west third of the room is bare
plaster. The counter is along the back, the booths line the window, and that
leaves a dead wall you face every time you walk in. It is the same class of
note as *"bodega is a bit small and sad"*: not a bug, a room that has not been
finished. A jukebox, a cigarette machine, a coat rack, a payphone or framed
photographs would each fix it, and the diner is the reference interior so
whatever goes there sets the pattern.

I have NOT built it. Nobody asked for it, my queue is empty rather than
urgent, and the last several things I shipped at the end of a long stretch each
needed a follow-up commit to repair — the burger barn's seating rows alone took
three passes because each fix broke a different constraint. Adding furniture I
cannot fully walk afterwards is how that happens again. It wants its own item
with room to verify.

---

# Interior floor texel density is CORRECT — do not "fix" it to 8 px/m

`notes/interior-audit.md` tabulates interior floors at 18–36 px/m next to the
project's stated "~8 px/m", and the triage rightly did not route it. Recording
why, because the table on its own reads like a defect and the fix would make
every room wrong.

Measured across all eight interiors: floors run **19–27 px/m**.

The 8 px/m in `START-HERE.md` is the FACADE grid — `shopfrontTex` builds its
canvas as `wMeters * 8` and every painted shopfront is exactly that. The
GROUND is a different grid and always has been: `asphaltTex` is a 64 px tile
over 3.4 m, which is **18.8 px/m**, and every road and pavement in the world
is drawn at it.

A floor is ground, not facade. The kit's default lino is 32 px over 1.6 m =
20 px/m, which lands on the road's grid, and the rooms that lay their own
floor — the diner's checker, the burger barn's quarry tile — sit between 19
and 27. That is the right neighbourhood.

Two entries in the measurement above are small props, not floors: a 0.62 m cat
at 38.7 px/m and a 0.76 m card at 42.1. Small objects carry more texels per
metre by construction, and neither is a surface anyone walks on.

**If this is ever revisited, the number to compare against is 18.8, not 8.**

---

# QUEUE RECONCILIATION — all 20 items, against what actually landed

The desk owns `notes/queues/F-interiors.md` so I have not edited it. This is
the audit it needs to retire them. Every row verified against the running
world, not against memory.

| # | line | item | landed as | verified by |
|---|---|---|---|---|
| 1 | 31 | `civicSeats()` called from nowhere | `f532b6a`, then `c20ba4a` gave civic.ts `ctx` so the export is gone | both benches prompt |
| 2 | 72 | bodega `[E]` not on its facade door | `3474e81` | 2/3 approaches, E enters |
| 3 | 100 | bodega interior small and sad | `ba7a82a` — rebuilt on the kit, crammed | 24/24 |
| 4 | 121 | church steps cannot be climbed | `53550b6` + `edc034d` — they climb; **stops 0.44 m short**, see BLOCKED-F | steps-walk |
| 5 | 148 | diner seating: booths perpendicular, lining the window | `768c0b4` | 24/24, 13 seats |
| 6 | 187 | flip the authority: interior declares | `7b5ded0` | mirror 3/3 |
| 7 | 227 | interiors and exteriors agree on handedness | `4ef227e` | mirror-walk 3/3 |
| 8 | 269 | tax service `[E]` not on its door | `4762f7e` | room/painter agree to 0.01 |
| 9 | 296 | wire `courtGround` | `53550b6` | E's own E-walk 18/18 |
| 10 | 329 | generalise the glob | `9f2b3d2` | 8 on disk, 8 in world |
| 11 | 378 | park and car lot not in the world | `053db46` | walk into both |
| 12 | 410 | diner prompt on the BANK, then sweep every spot | `58cc650` + `1921bc7` | 79 spots reachable |
| 13 | 442 | interior people on the 8-angle atlas | `e931276`, `650fc90`, `a171f7a` | people-walk: none left |
| 14 | 471 | jump higher, gravity stronger | `10c16a0` | jump-walk 7/7 |
| 15 | 494 | stuck protection | `b54d3ec` | 177/177 traps release |
| 16 | 539 | derive door and window from the facade | `635acc0`, direction flipped by `7b5ded0` | 8 doors publish |
| 17 | 576 | three finished rooms not in the world | `27c5139` | casino/hotel/tax enterable |
| 18 | 612 | every seat sittable — `ctx.seat()` | `b353954` | 56/57 |
| 19 | 648 | re-anchor the diner | `58cc650` | 24/24 |
| 20 | 667 | thrift store interior, 12.5 m | landed earlier; re-anchored `4ef227e` | 27/27 |

**19 of 20 are complete.** #4 is partial and blocked: both flights climb, but
the church stops 0.44 m short of its doors inside D's footprint box.

Everything the auditor routed is also closed — triage #2 (thrift card,
`9c06410`, re-measured this session at 0.02–0.04 m), #3 (keepers, G), #4
(casino ceiling — it was my docstring, `8d14f83`). Triage #1 is `ct/props.ts`,
B's.

## What is actually left

1. **The church flight, 0.44 m short** — D's footprint box. `BLOCKED-F.md` §2.
2. **A 0.4 m post pinching the casino's pavement to 0.43 m** — H or D.
   `BLOCKED-F.md` §1. Note this is tighter than the 0.90 m squeeze the
   auditor's triage calls "the tightest in the world".
3. **Casino and hotel room specs still hand-type their door** even though they
   now declare it — same five-line conversion as the tax office. G's, or grant.
4. **One burger stool** with no standable point in its trigger.
5. **A decision, not a fix:** neither civic flight leads anywhere. My
   recommendation is a locked-door response over two more rooms.

---

# RUN N — the queue is empty; four commits, and two of them are corrections of mine

`095c7d63` `0ecfd662` `bf9bcf58` `55b59c25`. Nothing left in
`queues/F-interiors.md` that is not blocked on another owner.

## 1. The spot sweep asks instead of guessing (`095c7d63`)

`spots-walk.mjs` tested "orphaned" as *is there anything solid within 3 m*. I
had already proved that useless on myself — moving the thrift's declaration
onto the park frontage did not fire it, because the building line is continuous
so a spot sliding along it still has masonry nearby.

Doors declare now, so it asks: a spot whose label names a declared building must
stand on that building's **published** door. Exact, and it cannot go stale
because both sides come from the same declaration.

**It found a real drift on its first run.** GOLDEN ACES and HOTEL ORPHEUS
declared their doors but their room specs still hand-typed `[E]` at
`WALK_Z = -97.0`, while the published stand point is `-96.75`. 0.25 m. That is
the exact risk I had named in the previous commit and left as a future problem;
the probe turned it from a worry into a measurement in one run. Both derive
from the declaration now — **8 of 8 rooms sit exactly on their published door.**

## 2. Both civic flights lead somewhere (`0ecfd662`)

The user: *"Do NOT leave a flight of steps that leads to nothing."* I had this
in `BLOCKED-F.md` as "needing a decision, not a fix" with my recommendation
already attached — wrong twice, since it was not blocked on anyone and the
user had already decided it in that sentence.

`ct/civic-doors.ts`. Not new rooms: **the kit's degenerate case.** The kit owns
door → room, so a door with no room is still the kit's to answer for, and the
answer is a locked door.

**Nothing about where the doors are is typed.** A flight of steps is already a
declaration — a raised patch of ground somebody built to be climbed — so the
module scans the ground picker, clusters the patches, and takes the far edge of
each landing from the street as the doorway. A third civic flight needs no
edit. `claimed()` yields the door the moment a real room registers for that
building, so **E's library interior takes it over without E knowing this file
exists** — the nine-times-repeated "last line lives in someone else's file",
pointed the other way.

`scripts/civic-doors-walk.mjs` climbs both and checks four things: silent from
the pavement below, present at the top, answers `[E]`, lapses. It caught the
door announcing itself locked before anyone touched it (`tried = 0` reads as
"pressed just now" in a page's first seconds), and caught itself:
`keyboard.press()` is down+up inside one frame and `[E]` is edge-triggered off
a once-per-frame key sample, so the press is never seen. It passed at the
church and failed at the library on nothing but timing.

## 3. `fp` reports a difference that is not there (`bf9bcf58`, `notes/F-fingerprint-phase.md`)

Proving item 2 moved nothing: textures identical, objects identical,
`structure` **different and reproducibly so** — from a module that creates no
three.js objects at all.

It is the casino/hotel chase: three shared phase materials recoloured every
frame, and `structure` hashes material colour. `scenedump.mjs` already names
these exact three spheres and pins the clock to fix them — but the chase runs
off frame time, not the world clock. Pinning the hour bought **stability, not
correctness**; it looks pinned only because startup timing is consistent. My
87 000 build-time ground queries shifted it by delaying the first frame.

Reported rather than fixed: `ct/vice.ts` and the shared harness are other
owners'. One line (`userData.animated`) plus `matSig` omitting colour when it
sees it — the project's standard "the module that knows says so".

## 4. `[E]` takes the NEAREST spot (`55b59c25`) — and my harness had excused it

`crosstown.ts` said *"nearest live spot wins"* and broke on the **first** spot
in range, so overlapping triggers went to whichever module built earlier.
Three live cases, all seats: standing exactly on the second of two diner
booths offered the first 0.67 m away, twice, and the bus stop bench at 0.9 m.
You walk to a seat and sit in the one beside it.

**`seats-walk.mjs` had already found this and explained it away — in my words:**
*"the E dispatch takes the first match — so one of each adjacent pair can never
be the one chosen… Shrinking the triggers below 0.34 m would fix the ambiguity
by making both unreachable."* I called the geometry unfixable, weakened the
assertion from THE seat to A seat, wrote a paragraph justifying it, and moved
on. It was three lines. All three seats passed the weakened check while seating
the player somewhere they had not chosen.

Found by asking a question I had never asked: do any two spot radii overlap?
171 pairs do — all but three are a seat and its own "stand up", mutually
exclusive through `ok()`, which is why it survived. Overlaps are fine once the
nearest answers, so nothing shrank; the assertion is back to THE seat at 0.5 m
and 57/57 pass it.

**`crosstown.ts` is desk-owned and this is outside my interior-belt carve-out.**
I made the call because the code contradicted its own stated contract and the
mechanic it breaks is the seat capability I own. Flagging it rather than
burying it.

## The through-line for the desk

Two of these four were **checks of mine that had already seen the bug and
talked themselves out of it.** `notes/F-fingerprint-phase.md` warns that a
proof reporting a difference which is not there teaches people to wave real
ones away; items 1 and 4 are that same failure from the other end — a check
taught to accept a real difference stops being a check. Worth a GOTCHAS line if
the desk agrees.

## Still open, none of it mine

1. **The post at (50.0, −97.65)** pinches the side-street walk outside the
   casino to 0.43 m. H or D. `BLOCKED-F.md`.
2. **The church flight** stops 0.44 m short of its doors inside
   `placeChurchEast`'s footprint box in `ct/street.ts` (D's). Its locked-door
   prompt is reachable today from where the flight ends, so this now costs the
   player the last stride rather than the response.
3. **`ct/vice.ts` + `scenedump.mjs`** — the chase phase leak above.
4. G's casino/hotel: 50 of 95 textures still undeclared.

Suites at handoff: **195/195 rooms, 57/57 seats, 82 spots, 8/8 doors on their
declaration, both civic flights, 177/177 unstick traps, health OK, build clean.**

---

# RUN N+1 — selftests, and the two bugs that registering them found

Queue still empty (19/20 landed, #4 blocked on D's church box). This is the
follow-through my last handoff asked for.

## My walking suites had no selftests, and none were registered

C had independently hit the same class the same day — `lotwalk` and `door301`
printed `<- must be true` beside their results and exited 0 whatever they said
(`3dfe0217`) — and built `npm run checks` with a `--selftest` convention.

Four of mine have one now (`spots-walk`, `steps-walk`, `civic-doors-walk`,
`seats-walk`), each pushing a collider onto the LIVE `__ct.colliders()` and
requiring red. All verified both ways. Six suites registered behind a new
`--slow` tier with their own `SLOW_MS` ceiling, since 180 s is right for a
check that measures and wrong for one that walks eight rooms in real time.

**Writing them found two real bugs**, which is the argument for them:

1. **`int-civic.ts` was named wrong** and `world-wired` was right to go red.
   `ct/int-*.ts` means "an interior room you can walk into" and that module
   registers no room. Renamed `civic-doors.ts`.
2. **`interiors-walk`'s "landing is not boxed in" was flaky** — red on the
   bodega at 0.18 m, when eight consecutive attempts walked 2.4–3.6 m off that
   landing with zero colliders ahead. Crowd and traffic actors are not in
   `__ct.colliders()`, so no static pre-check can see them; three attempts now,
   since a seal does not move but a pedestrian does.

## And then it accused a room that was sound

`--slow` reported three escapes from the PAWN SHOP. The room is fine. Players
stopped dead at local x −6.51/−6.53/−6.54 — a wall at 6.9, exactly where 13.8 m
puts one. My harness expected `5 x 4` because it carried its own table with
`W: 10.0` and the note *"room width stays G's explicit 10.0"*. That pin was
removed from the room in `358d82cc`, so it takes `roomWidthFor(15) = 13.8`.

Two authorings of one number, in the file I wrote to catch that. **Had I
"fixed" the room to match the harness I would have broken a correct wall in
another builder's file.** The kit publishes resolved geometry now
(`__ct.roomDims()`) and the harness asks.

## For whoever owns the suite: it is flaky UNDER LOAD, not on its own

`door301` went red in one full run and `density` in another. Both pass
standalone — `door301` 3/3, `density` clean — and each was green in the other
full run. The machine also OOM-killed my dev server during one pass.

I have not chased it: neither check is mine and neither has a real defect that
I can see. But it is worth someone's time, because `--slow` makes the suite
long enough to hit this often, and **an intermittent red teaches people to
ignore the suite** — which is exactly the failure GOTCHAS 27 was written about.
A suite that cries wolf is the same problem as a check that excuses a bug,
arrived at from the other end.

---

# RUN N+2 — every guard selftested, and nobody was watching the merged world

Queue still empty. Two things closed and one gap named.

## All seven of my registered suites now have a selftest, watched firing at HEAD

Prompted by another builder's *"all ten of my guards watched firing at HEAD,
not merely passing"*. Mine were verified when written and the world has moved a
long way since, so I re-ran every one: green normally, red under mutation.

`interiors-walk` had none, and giving it one found the worst bug of the batch.
Walling all eight declared doors shut produced **`0/0 passed`, exit 0**. Two
causes: the room filter was positional so `--selftest` was read as a room name,
and — the real one — **an empty run counted as a pass**. The more completely
broken the world, the fewer assertions run; at total failure the count reaches
zero and the check reports success. A check that goes green precisely when
things are worst, which is the shape it exists to catch in the world.

`world-wired` was the last, and the only mutation that is not a collider: it
compares files on disk against rooms in the world, so it lies about the disk —
a phantom `int-selftest.ts` nobody built.

## Nothing was checking the integrated world beyond "does it build"

I have verified everything in a worktree where no other builder's colliders
exist. `live-integrate.sh` drops a builder who breaks the BUILD, and that is
the whole of what stands between the player and a merge that compiles but does
not play.

So I walked it: **8/8 declared doors let you in on :5177**, with the entire
block merged, and the live world carries `roomDims()`, both civic prompts, 137
spots and 57 seats. Reassuring rather than alarming — but it was luck that
nobody had asked, not design.

`scripts/integration-doors.mjs` does it, and is **deliberately not registered**
in `checks.mjs`: it measures a tree that is not the checkout, so it cannot call
`reportWorld` and would fail GOTCHAS 26 on purpose. Run by hand, read as an
observation, never quoted as evidence about anyone's branch. If it ever goes
red the next question is *whose change did it*, and this cannot answer that —
which is exactly why it belongs to the desk and not to me.

## Landing

Four commits ahead of `add-stick-and-city98` at the time of writing, all
scripts and notes, no world code. Nothing here needs to land urgently; the
world-facing work is already in and verified in the merged build above.

---

# RUN N+3 — thirteen commits unlanded, and one of them unblocks two builders

**My queue has been empty for many rounds** (19 of 20 landed, #4 withdrawn
because its own control reproduced the number). `BLOCKED-F.md` is closed.
Nothing is blocked on me. What I have been doing instead is other builders'
blockers on my files, and those are now all discharged:

| who | what | state |
|---|---|---|
| H | slow tier could not survive a rebasing worktree | `slow-pinned.sh`, and the full 54-check tier now completes |
| A | `interior.ts` off the four deprecated `Frontage` fields | landed (upstream landed the same migration in parallel) |
| C, D | `doors.ts` import cycle dropping GOLDEN ACES silently | glob narrowed to `./int-*.ts`; bundle 8/8, zero undefined namespaces |
| D | `ct/doors.ts` had no owner in `OWNERSHIP.md` | claimed, with `world.ts`, `civic-doors.ts`, `int-bodega.ts` |

## The thing that needs the desk, not me

**13 commits ahead of `add-stick-and-city98`, 0 behind.** The merge train has
not run over this branch in a while, and one of those commits is the doors.ts
cycle fix. **C and D do not have it until it lands** — they are unblocked in my
tree and still blocked in theirs, which is the same "finished work that cannot
reach the world" this project keeps hitting, one level up.

Verified landable at HEAD, so the train should not drop me:

```
tsc clean · build clean · WORLD OK
every interior on disk is built and reachable
every registered [E] spot is exercised by a named check
every declared door arrived
full slow tier: 54 checks green (interiors-walk 195/195, seats-walk 57/57)
```

## Still open, none of it mine to take

1. **The 20 stale rows in `queues/F-interiors.md`** — reconciled in `86fa8ce7`
   with the commit that closed each. The desk writes that file; I only read it.
2. **Six unowned modules** — `crowd-net`, `traffic`, `sidestreet`, `lot`,
   `gap`, `hud`. Named in `OWNERSHIP.md`, deliberately not guessed at.
3. **E's library interior** — the last of the user's ten. Its steps climb and
   its doors answer with a locked-door response until the room lands.
4. **`fp`'s two noise columns** — `tints` and `places`. `ct/vice.ts` +
   `scenedump.mjs`, written up in `F-fingerprint-phase.md`.
