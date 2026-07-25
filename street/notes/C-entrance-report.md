# No. 227 — quality pass, end to end

Builder C. Walked the walk-up in the order a player meets it: the street, the
stoop, the lobby, every flight and landing, the hermit's floor, 301, the top
landing, and back down the shaft. 46 stops, `scripts/walkup.mjs`, shots in
`shots/walkup/`.

**Reported, not fixed** — the queue said to write it down rather than act.
Nothing below is committed as a change.

Ordered by how much it costs the illusion, not by how hard it is.

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

## 6. The stoop is not solid · `03-stoop`

You walk through the step instead of onto it. Invisible in first person
because the camera rides well above a 0.17 m rise, so it has never shown up in
a screenshot — but it is the first piece of the building you touch. Long
standing, noted in the previous handoff, still true.

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
