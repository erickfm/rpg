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
