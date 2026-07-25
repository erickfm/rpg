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

## 2. The church flight — MY MEASUREMENT DOES NOT SUPPORT MY CLAIM

**Re-measured 2026-07-25 and I am withdrawing the number, not renewing it.**

I filed this as "the flight stops 0.44 m short of its doors", blaming
`placeChurchEast`'s footprint box in `ct/street.ts` for eating the upper
landing. Re-running the same sweep over BOTH civic forecourts on a 0.25 m grid:

```
church    114 raised cells,  60 standable,  stand out to x  9.00, ground ends  9.50   -> 0.50 m
library   238 raised cells, 156 standable,  stand out to x 11.50, ground ends 12.00   -> 0.50 m
```

**The library shows the identical 0.50 m**, and the library is the flight I
verified reaching its doors — it climbs 0.14 -> 0.99 and back down, and its
locked-door prompt at the top is reachable and answers.

0.50 m is what the 0.36 m capsule costs you against a wall face. You cannot
stand inside a wall, so the last half-metre of any raised ground that runs up
to a building is unstandable on both flights, working or not. It does not
distinguish the two, so it is not evidence of anything.

**What that means for the claim.** I have now been wrong about this forecourt
twice in the same way — once probing a single point and declaring the whole
thing unreachable (corrected in `edc034d`), and now with a figure that the
control case reproduces exactly. The honest position is that I do not have a
measurement showing the church is defective.

What is still TRUE and unexplained is the proportion: the church has 47% of its
raised cells unstandable against the library's 34%, and the church tops out at
gy 0.55 where the library reaches 0.99. Either of those could be the two
flights simply being different flights. Neither is a defect I can demonstrate.

**So nobody should act on this.** D should not go cutting a hole in a
deliberate footprint box — its comment records that a missing one let you walk
through the nave — on the strength of a number its control case also produces.
If the church forecourt is wrong, it needs diagnosing again from scratch, by
someone who can say what the intended top of that flight IS.

The locked-door prompt at the top answers today, from where the flight ends,
so a player is not standing in front of a silent building either way.

---

## RESOLVED — the flights lead somewhere now

I had this filed as "needing a decision, not a fix", with the recommendation
already written: a locked-door response rather than two more rooms. That was
wrong twice. It was not blocked on anyone, and the user had already made the
call — *"Do NOT leave a flight of steps that leads to nothing."*

Done in `ct/civic-doors.ts` (`0ecfd662`). Both doors answer; `claimed()` hands
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
