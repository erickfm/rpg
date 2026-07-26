# No. 227 — quality pass, end to end

Builder C. Walked the walk-up in the order a player meets it: the street, the
stoop, the lobby, every flight and landing, the hermit's floor, 301, the top
landing, and back down the shaft. 46 stops, `scripts/walkup.mjs`, shots in
`shots/walkup/`.

**Reported, not fixed** — the queue said to write it down rather than act.
Nothing below is committed as a change.

Ordered by how much it costs the illusion, not by how hard it is.

**Revision:** finding 6 was rewritten after walking it. I had it wrong — the
stoop is not something you walk through, it is something you cannot reach, and
the cause is a blanket collider in `crosstown.ts` rather than anything in this
module. It is the same defect the desk has just routed to D (`bcd2c82`), and
the section now says what D needs from here when the blanket wall goes.

---

## 1. The front door disagrees with itself · `08-lobby-back`, `05-door`

From the street it is a **double** door, dark green, with a glazed transom
carrying the gold 227. From inside the lobby it is a **single** door with a
louvred panel and no transom at all. It is the same doorway; you pass through
it in one step and it changes.

The inside face should be the same two leaves, and the transom should be
glazed from both sides — you should be able to see the daylight through it
from the lobby.

## 2. Nothing else got the jambs · `08-lobby-back`, `09-mailboxes`, `36-301-floor`

Walls have real thickness now, and the two doorways that are genuinely pierced
(301, 302) have reveals and architrave. Everything else on a wall is still a
zero-thickness plane stuck to it, and now that the walls around them have
depth, that reads worse than it did before:

- **The lobby front door** — no casing at all, no reveal. The one door with no
  trim in the building.
- **The mailboxes** — a flat painted panel. They should be a shallow box with
  a lip; you can see they are paper-thin at any angle off dead-on.
- **301's window** — a flat plane inside a 0.14 m wall, so it has no reveal and
  no sill. Every doorway in the building now shows its thickness and the one
  window does not.
- **The flat doors (101/102, 201/202, 401/402)** — their casing is *painted
  into* `doorTexN`, not modelled, so beside 301's real architrave they read
  flat. Consistent with each other, inconsistent with the two openings.

The cheapest fix is the window and the mailboxes; the flat doors are a bigger
job and arguably fine as they are.

## 3. Wallpaper aliases badly down the shaft · `45-shaft-up`, `40-top-over`, `17-landing1`

`wallpaperT` draws 1-texel dark pinstripes every 8 texels. Looking up or down
the stairwell you see those walls at a very grazing angle over a long run, and
they break into a moiré crawl — the upper half of `45-shaft-up` is a mess.

This is `GOTCHAS.md` #4 exactly ("a surface 1–2 texels tall cannot hold
detail"), just applied to a wall seen edge-on rather than a thin surface. The
stairwell is the one place in the building with a long sightline, so it is the
one place the wallpaper is asked to do this.

Worth either widening the pinstripe to 2 texels, dropping it inside the shaft,
or setting `minFilter = NearestFilter` on the hall paper so there is nothing
to crawl.

## 4. The cellar gate reads as a bright lattice, not a fence · `11-cellar-gate`, `14-flightA-foot`

Three separate things:

- **Too bright.** The mesh is `#aeb4bc` at full alpha on a near-black hole, so
  it is the highest-contrast thing in the lobby and pulls the eye off the
  stairs. It should sit back — darker, and it is metal in an unlit corner.
- **The padlock is attached to nothing.** The hasp behind it is too thin to
  read, so the lock floats in the middle of the mesh. It needs a visible hasp
  or staple bridging the gate to the frame.
- **No hinges, no meeting edge.** There is nothing to say which side opens, so
  it reads as a fixed panel rather than a gate. Two hinge plates on one stile
  would settle it.

Visible from the foot of flight A too (`14-flightA-foot`, far left) — the
white diamonds are the brightest thing in that frame as well.

## 5. The half landings are the darkest place in the building · `17-landing1`

Each landing's lamp hangs at the far end of the landing, past the turn, so the
turn itself — where you actually change direction and where the rail wraps —
is lit only by spill. Add the soffit of the flight overhead coming down low on
the approach and the landing reads as a dark pocket you pass through rather
than a place.

Headroom is genuinely fine (2.56 m over the landing; I checked the numbers,
not the picture). It is purely a lighting placement problem: the lamp is
0.3 m past the landing centre and wants to be over the turn.

## 6. You cannot reach the stoop at all · `03-stoop`, `47-stoop-reach`

**Corrected.** I first wrote this up as "the stoop is not solid, you walk
through the step". That is wrong, and the truth is more interesting.

Walked into it rather than reasoning about it: stand in the road at the door,
hold forward, and you stop dead at **x = 6.34**. The stoop's front face is at
x = 6.60. You are held **0.26 m short of it** and can never stand on it.

The cause is not in this module. `crosstown.ts:238` hand-writes the east side
of the street as one blanket collider —

```
{ minX: FACE - 0.3, maxX: FACE + 8, minZ: -96, maxZ: 20 }   // right wall
```

— which is x 6.70 → 15 for the **whole length of the block**, independent of
what any module draws. With the rig's 0.36 m radius that is a hard stop at
6.34, well in front of a facade that actually stands at 7.0. So the stoop, the
0.40 m it projects, and the whole depth of the doorcase reveal sit *behind* the
collision line and are scenery you can look at but not touch.

This is the same finding the desk has just routed to D — `bcd2c82`,
"Collision does not follow geometry — the blanket walls override every
module", raised against the library courtyard. **The walk-up's entrance is the
same bug at a different address.**

### What D needs from this module when the blanket wall goes

Two things, in this order, or replacing the blanket makes the entrance worse
rather than better:

1. **The facade line moves out from 6.70 to 7.00.** A tight facade collider
   lets the player reach x = 6.64 — which is *past* the stoop's front face at
   6.60. The moment the blanket goes, the stoop stops being unreachable and
   starts being something you clip through.
2. **So the stoop needs its own collider**, registered from `ct/apartment.ts`,
   before or with that change: roughly
   `{ minX: 6.60, maxX: 7.15, minZ: -44.98, maxZ: -43.02 }`. It is a 0.17 m
   step, so it also wants the floor-picker to lift you onto it rather than
   stopping you at it — which is this module's `ground()`, not a collider.

I have not made either change: they are only correct together with D's, and
the entrance currently works because the blanket wall keeps the player far
enough back that the `[E]` spot at x = 6.55, r = 1.05 still catches them at
0.21 m. That margin is what is holding the front door up, and it is exactly
the failure `GOTCHAS.md` #8 describes — the bodega's `[E]` spot was eaten by a
generous collider the same way, and the comment at `crosstown.ts:244` is the
scar from it.

## 7. The top guard rail has one lower rail and a 0.50 m gap under it · `38-top-landing`, `40-top-over`

The rail itself is right — 1.0 m, continuous, meets the core cap. But there is
a single lower rail at half height and a 0.50 m clear gap between it and the
landing floor. Nothing you can fall through as a player, and stylistically
defensible, but it is the one place the building looks under-built rather than
old.

## 8. Smaller things

- **Door knobs are a single flat square** of `#c9b45e` painted into the door
  texture (`23-door-201`). At the distance you stand to read the number plate,
  the plate is crisp and the knob is a yellow blob. It is the one detail on
  the door that did not get the texel treatment the numerals got.
- **301's radiator has no brackets or feet** (`36-301-floor`). It stands
  0.03 m off the wall, which is right, but nothing holds it there.
- **The dresser's open drawer has no drawer sides** — it is a front and a box,
  so from an oblique angle you see into a solid lump rather than into a drawer.
- **`v-hall3.png`-style views make the hall carpet's dither read as litter**
  rather than wear. Borderline; noting it because it is the same speckle at
  every scale and the floor is large.

---

## What is right, and should not be disturbed

Worth writing down so it does not get "fixed" later:

- **The handrail is genuinely continuous**, lobby to top, and every joint
  mitres flat because the rake sits 0.904 m over the nosings, which lands on
  exactly 1.0 m over both the floor and the landing. That reconciliation is
  load-bearing — change `RISE`, `RUN` or `STEPS` and it still holds, but
  change the 0.904 and it stops.
- **The floor-picker is correct at every level**, walked in both directions on
  both lanes, biggest single step 0.12 m against a 0.193 m riser.
- **The top landing** is a real floor with a visible rail standing exactly on
  its collider — no invisible wall anywhere in the shaft.
- **The basement is solid by construction**: the gate stands on a collider that
  predates it, and the picker is never asked for a height down there.
- **301 and the hall share one fixture**, so the flat is lit by the same lamp
  as the landing outside its door.

---

## Not defects, but the desk should know

- **`ct/interior.ts` and `ct/int-diner.ts` still do not exist.** 301 was built
  against the walk-up's own conventions. If F's kit lands with different wall
  thickness, ceiling height or light treatment, **301 is the room to
  reconcile** — it is the only interior not built on the kit.
- **There is still no sleep interaction.** The 301 queue item assumed one
  ("you can already sleep here"); no sleep spot exists in any module. The bed
  is clear and approachable for whoever adds it.
- **Port.** The queue header says 4180. That port is held by a stale
  `vite preview` from `/home/erick/projects/rpg`, which silently served me a
  different world until I noticed. I run 4190 with `--strictPort`.

---

## STATUS — what has since been closed

Worked top-down after the report was written. Fixed and landed:

| # | what | commit |
|---|---|---|
| 1 | the front door disagreed with itself — lobby side is now the same double door under the same glazed transom, with the gold 227 reading backwards through the glass | `the front door stops disagreeing` |
| 2 | 301's window sits in a real hole with reveals, sill, apron and architrave; the mailboxes are a box with a lip and a shelf; the lobby door got its casing | `the window gets a hole`, `front door` |
| 4 | the cellar gate — dimmer wire, a hasp that is a strap AND a staple, hinge plates and a shutting stile | `the cellar gate reads as a gate` |
| 7 | the top landing's 0.50 m gap is a run of balusters at 0.08 clear | `balusters instead of half a metre of air` |
| 8 | door knobs modelled as rose/stem/ball, radiator brackets and feet, the open drawer given sides, a bottom and a back | `three things you stand right next to` |

| 3 | the wallpaper's 1-texel pinstripe widened to 2 at half contrast, and the wall clones get linear-between-mips plus anisotropy — no more moire crawl up the shaft | `stop the wallpaper crawling` |
| 5 | the landing lamp moved from 0.3 m past the landing's middle to over the TURN, where the rail wraps and you change direction | `light the turn` |
| 2b | the six flat doors get real architrave, so they stop reading flat beside 301's and 302's | `flat doors get real trim` |

**The whole list is closed.** What is left in the building is what the report
recorded as right and said not to disturb.

## NEW, found while fixing 4 — and then WITHDRAWN

I logged this as "you can see daylight past the flanks of the cellar gate":
a pale wedge shows behind the left half of the mesh in `22-cellar-obliq`,
and the obvious explanation was the WEST boundary at `AX(1.2)`, which has
nothing above floor level because a wall there would stand in the lobby.

**It is not that, and the way I found out is the point.** I checked the
colliders first — `underStairA` is live on the lobby floor and contains the
whole footprint, so no player can stand in there and closing it was safe — and
then built the surface: concrete across the full west boundary, floor to
2.2 m, opaque.

**The wedge did not change.** An opaque plane across the whole boundary would
have hidden it if the light were coming from beyond, so it is not coming from
beyond: it is INSIDE the cellar. It is the soffit of flight A, which runs
directly over the cellar across exactly `CZ0`–`CZ1`, seen from underneath
through the gate. That is a stair, correctly lit, correctly where it should
be — you are looking up under the steps you are standing beside.

So the surface came back out. It fixed nothing and would have been geometry
nobody could ever see, in a place where a later reader would have had to work
out why it was there.

**The lesson is cheap and worth keeping:** a fix that changes nothing is
evidence, not a failure. Building the wrong fix disproved the diagnosis
faster than staring at the frame would have, and the cost was one commit's
worth of work that got reverted in the same session rather than a wrong
explanation left in the report for someone else to inherit.

---

## RE-WALK, 2026-07-25 — after the spawn moved into 301

The whole list above was closed, so this is a fresh pass over a building that
now matters more than it did when the report was written: **the player spawns
in 301**. This is everybody's first thirty seconds and the walk down is the
first thing they do. Seventeen viewpoints, floor 3 to lobby, clock 14:30,
shots in `shots/walkup/01..19`.

**No console errors anywhere in the building.** The floor picker agrees with
the storey asked for at every landing and every room; three viewpoints reported
a disagreement and all three are mid-flight on the ramp, which is the picker
being right.

**Finding 1 confirmed closed by looking, not by the table.** From inside the
lobby it is now the same double green door under the same glazed transom, and
the gold reads `Γ55` through the glass — which is `227` mirrored, exactly as
intended: under a horizontal flip the 5x5 glyph for `2` becomes the glyph for
`5` and `7` becomes `Γ`. `18-transom-inside.png`.

### NEW — the north wall of 301 is bare, floor to ceiling — NOW FIXED

`03-301-north.png`. The only finding of this pass, and the spawn is what
promotes it from a detail to the first thing worth fixing in the building.

You wake facing the window. Three of the four things you can turn to pay off —
the window and the street three storeys below, the poster and the TV on the
south wall, your own door with the 301 plate swung into the room — and the
fourth is a wall with nothing on it at all, from skirting to ceiling. In a room
this small that is a quarter of what you see in the first five seconds.

It does not want much: a calendar, a mirror, a chest of drawers, something
stacked against the skirting. Whoever takes it should look at it FROM THE
SPAWN rather than from the middle of the room, because that is the only angle
the player is guaranteed to see it from.

**Fixed the same session** — a 1997 wall calendar with one day ringed in biro,
and three snapshots taped up in a row, both above the bed and both sized to be
read from the spawn rather than from the middle of the room
(`20-north-from-spawn.png`). Deliberately small: the wall is still mostly
wall, and a second poster up here would have made the room read as decorated
rather than lived in.

One thing worth knowing before hanging anything else in this building:
**`AZI(5.5)` is the north wall's CENTRELINE, not its face.** The wall is a
0.14 m box, so the room side is `AZI(5.5) - 0.07`, and my first attempt hung
both meshes at `AZI(5.49)` — entombed inside the plaster. They reported
`visible: true` at the right x and y and rendered nothing, which is a very
quiet way to be wrong. The south poster's 0.015 m proud of its inner face is
the number to copy.

### Two things I chased and had to drop, so nobody re-chases them

- **The hall walls appear to carry hard-edged diagonal light wedges**
  (`11-shaft-down.png`). They are not lighting. It is the wallpaper's own
  vertical stripe under perspective — the glow is a small faint halo that never
  reaches the walls (`apartment.ts:873-893`). Worth knowing because this is the
  shape of the *"whats going on with the shadow geometry here"* complaint the
  user has now raised twice on other builders' work, and a striped wallpaper on
  a receding wall will keep inviting it.
- **The handrail looks unsupported.** It is not — it rides the core wall's
  faces at WX/EX with the wall 0.04 m behind it, and the report above already
  records it as right and not to be disturbed. It has no visible brackets, which
  is the same sentence as the radiator's brackets in finding 8, but that was
  closed and the rail was deliberately left alone. Leaving it.

### The stoop — finding 6 is CLOSED, and the visual pass is done

Third time of asking, and this time I found it. The reason two attempts landed
inside the shaft wall is that **the walk-up's street entrance is not a declared
door** — it is not in `__ct.doors()`, so there was nothing to look it up from.
It is hung at `x = FACE - 0.02` and `DOOR_Z = -44`, in `apartment.ts`, and you
have to read that out of the source.

**You can now walk to it.** Finding 6 said you could not reach the stoop at
all; D's blanket collider has since gone. Walked it: from x 4.00 on the walk,
holding forward gets to **x 6.47**, and the stoop's tread runs from 6.43 to the
face at 6.98 — so you end up standing ON the step, which is the whole point of
a stoop. Nothing stops you short of it any more.

**The visual pass finds nothing wrong.** `22-stoop-far`, `23-stoop-near`,
`24-stoop-down`. The gold 227 on dark glass, the green double leaves with their
brass handles, the stone doorcase, the buzzer panel on the right jamb with bare
brick opposite, and one worn step wider than the opening sitting proud of the
pavement with the sidewalk scoring running past it. It is the best-finished
thing in the building and it wants nothing.

One thing I nearly filed and should not have: a large faceted lavender mass
appears to clip into the doorcase and the stoop in `23-stoop-near`. It is a
PEDESTRIAN — a 0.95 x 1.9 citizen sprite standing at x 6.0, which is on the
walk and 0.43 m clear of the stoop. At 2.4 m a 1.9 m figure simply covers a lot
of frame. Nothing is clipping.

### NEW, found while checking the shut door — 301's east wall wore the hall's paper — FIXED

`shots/walkup/g-room.png`. Standing in 301 looking at your own door with it
SHUT, the wall around the door is the corridor's tan stripe while the other
three walls of the room are the blue paper. With the door open you never notice
it — the tan reads as the hall seen through the opening, which is what I put it
down to on the first pass. Shut, there is no opening to explain it and the room
has one wall in someone else's wallpaper.

The cause is ownership of the surface: that wall is built by the stairwell
shell's `wallMesh` runs, which paper both faces in the hall's paper, and 301's
own build papers only the three walls it makes itself. The room papered three
walls and forgot the one with its own door in it.

**Fixed.** Three planes of `roomWallT` on the room side, around the opening —
a SKIN rather than a second wall, because the shell's box is load-bearing for
the colliders, the jamb reveals and the architrave, and another box there would
z-fight its face and double the doorway's trim. They sample the paper the way
`wallMesh` does, including the `vOff` that tells the over-door strip where it
sits within the 2.7 m storey tile; without it that strip samples from the
bottom of the tile and puts a skirting band above the door. Hall side
untouched. With the door open you now get blue up to the frame and the hall's
tan seen THROUGH the opening, which is the reading that was always intended.

### Re-checked the two things I had only LOOKED at — both sound

Fixing the door's head gap made the point that my sign-offs this session were
reliable when I measured and unreliable when I looked. So the two other pieces I
had signed off from screenshots alone got the same treatment.

**301's fourth wall (the skin) is exact.** Three hand-sized panels are the shape
that produced the head gap, so I measured their world extents against the wall
they cover rather than trusting the blue-vs-tan screenshot:

```
  panel 1.025 x 2.55   z -18.000 .. -16.975   y 5.40 .. 7.95
  panel 0.950 x 0.45   z -16.975 .. -16.025   y 7.50 .. 7.95
  panel 1.525 x 2.55   z -16.025 .. -14.500   y 5.40 .. 7.95
```

Flush to both jambs, floor to ceiling, and the over-door panel meets the head at
7.50 and the cornice at 7.95. No strip of hall paper anywhere. 8 of 8 clauses.

**The light well is enclosed at grazing angles.** A far wall only 1.9 m across
could be seen past from the glass, which would show void — the same failure as
the head gap, sideways. Pressed to the glass looking hard left, hard right,
steeply up and steeply down: brick fills the opening every time, with the
returns converging and the reveal reading correctly. `g1-left`, `g2-right`,
`g3-upleft`, `g4-downrt`.

Both negative results, and worth the time only because the identical check on
the door found a real 25 mm gap that two head-on screenshots had passed.
