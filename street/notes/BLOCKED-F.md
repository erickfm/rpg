# Builder F — blocked, and two things for other owners

Neither of these stops me working; both are in files I do not own, and both are
measured rather than guessed.

---

## 1. A post pinches the side-street walk outside the casino

There is a 0.4 x 0.4 m collider at **(50.0, −97.65)** — street furniture on the
north side-street pavement, outside GOLDEN ACES.

```
        x=44 .................................. x=56
z= -96.5 ##########################################   shopfront
z= -97.0 ..........................................   0.43 m of standing room
z= -97.5 ...........###............................   the post
z= -98.0 ...........###............................
z= -98.5 ..........................................
```

The shopfront collider ends at z = −96.30 and the post starts at −97.45, so
there is 1.15 m between them — **0.43 m of standing room** once the 0.72 m
player is subtracted. It is passable, and only just, and only if you walk the
line the door is on.

GOTCHAS §9 says the 2 m walk is sacred and that any new collider must leave a
clear lane. This one leaves less than half a metre, and it is the approach to a
door. It cost me three passes of the walk harness before I realised the door
was fine and the pavement was not.

**Not mine to move** — it is street furniture, so H or D. Moving it ~0.5 m
further from the frontage, or off the door's line, restores a normal lane.

The harness now walks the side street ON the door line, which is the one
continuous lane past it, with the reason written at the call site. That is a
workaround in the TEST, not a fix in the world: the pinch is still there for a
player.

---

## 2. The church flight stops 0.44 m short of its doors

Both civic flights climb — this was diagnosed wrong by me once and corrected in
`edc034d`. Measured now:

```
library: 5.60 m up, gy 0.14 -> 0.99, and back down     (reaches the doors)
church:  2.74 m up, gy 0.14 -> 0.55, and back down     (stops short)
```

Of 114 raised cells in the church forecourt, 54 are not standable: the upper
flight and the landing at the doors sit inside `placeChurchEast`'s footprint
box in `ct/street.ts`:

```
x 6.70..15.00   z -86.00..-68.00
solid({ minX: FACE - 0.3, maxX: FACE + 8, minZ: z - b.w, maxZ: z });
```

You climb most of it and stop short of the doors, rather than being unable to
start. The box wants shaping around the setback the way the library's recess is
cut out of the west wall run. E's `placeChurch` already knows the extents
(`YARD_X0`/`YARD_X1`, `zFront`, `zStreet` — the numbers its own `floorLocal`
patch uses), so the clean version is E publishing them the way `COURT` is and D
subtracting them.

`ct/street.ts` is D's and the box is deliberate — its comment records that a
missing one let you walk through the nave. **Test is written and will pass the
moment it lands:** `scripts/steps-walk.mjs` covers both flights.

---

## RESOLVED — the flights lead somewhere now

I had this filed as "needing a decision, not a fix", with the recommendation
already written: a locked-door response rather than two more rooms. That was
wrong twice. It was not blocked on anyone, and the user had already made the
call — *"Do NOT leave a flight of steps that leads to nothing."*

Done in `ct/int-civic.ts` (`0ecfd662`). Both doors answer; `claimed()` hands
the door over automatically the moment a real room registers for that
building, so E's library interior needs no coordination with me.

Note the church's prompt sits at its doors and is reachable **today**, from
0.44 m short of them — so blocker 2 below no longer costs the player a
response, only the last stride. It is still worth fixing.

---

## 3. RESOLVED — the descriptor could describe a side-street frontage all along

I wrote this up as needing a type change: `DoorDecl` carries `cz` and
`side`, computes along z, puts the normal on x, and GOLDEN ACES and HOTEL
ORPHEUS front the side street laid out along x facing −z.

It needed reading my own type properly, not changing it. `face` — a world
point plus an outward normal — was added for the bodega's canted bay, and it
is not a chamfer special case: it is the GENERAL form, and the main block's
`cz`/`side` is shorthand for the common one. `doorPointFor` already derives
one from the other. Both side-street rooms now declare with `face`, using G's
own already-walked door positions, so all eight rooms publish and nothing
moved.
