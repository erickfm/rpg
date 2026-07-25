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

Still open from the original list: **3** (wallpaper aliasing down the shaft),
**5** (the half landings are lit past the turn rather than over it), and the
flat doors' painted casing under **2** — which the report already called a
bigger job and arguably fine.

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
