# I verifying C's "pressing e doesnt get me out of it" — IT REPRODUCES

    station:   room 301, stand a pace back from the bed's own approach point
               at (198.45, -16.56), press E to sit, then press E to stand
    predicate: after sitting, E does not stand you up and WASD do not move you

**C, the auditor and J all reported they could not reproduce the stuck state.
I can, on demand, 100% of the time, and so can the user.** The reason three
verifiers missed it is not carelessness — it is that all three tested by
warping onto the seat's *pose*, and **the fault only appears when you sit from
far enough away that sitting teleports you.** A player always arrives that way.
A warp-in never does.

## The reproduction

Fresh page per trial, no carried state, build `2bda13fcc`:

    room 301 bed, stepping back from its own approach point (198.3, -16.3):

      stood at            teleported into the seat     E to stand
      198.30, -16.30           0.82 m                  stood up
      198.37, -16.43           0.97 m                  stood up
      198.45, -16.56           1.12 m                  ** STUCK
      198.52, -16.69           1.27 m                  ** STUCK
      198.59, -16.82           1.42 m                  (too far to sit at all)

**The threshold is between 0.97 m and 1.12 m of teleport distance**, and it is
sharp. Below it the seat is fine; above it you are trapped; a little further
and you cannot sit at all. So there is a **band roughly 1.0–1.4 m wide, at the
outer edge of every seat's own trigger, in which you can sit down and cannot
get up.**

## How stuck is stuck

Sat from (198.45, -16.56), then:

    W  ->  moved 0.00 m        E x 7  ->  still seated, eye still 6.57
    A  ->  moved 0.00 m
    S  ->  moved 0.00 m        spots still offered:  "stand up"  at 0.00 m
    D  ->  moved 0.00 m                              "sleep until morning" at 0.55 m
    space -> moved 0.00 m

There is no input that frees him. **Reloading the page is the only exit**, which
is exactly *"pressing e doesnt get me out of it"*.

## IT IS NOT THE SHADOWING EVERYONE HAS BEEN REASONING ABOUT

This matters for whoever fixes it, because the whole row so far — C's diagnosis,
the auditor's 0.55 m margin, J's `key = offAxis + d*0.02` — describes a *rival
spot outranking stand-up*. **That is not what is happening.** Measured while
stuck at the bus stop:

    0.000 m  r 0.5  ok=true   "stand up"
    0.650 m  r 0.7  ok=true   "take the folded newspaper"
    0.831 m  r 1.4  ok=false  "sit at the stop"
    1.225 m  r 1.4  ok=false  "sit at the stop"

**`stand up` is live, at zero distance, and it is the unique minimum of the
resolver's own key** — every sit spot is correctly `ok=false`, so C's
`!rig.seated` guard is working exactly as C said. The resolver is offering the
right verb and the HUD prints `[E] stand up`. **Pressing E does not execute it.**

So the shadowing analysis is sound and the guard is sound, and the player is
still trapped. The fault is downstream of spot selection — in what the stand
action does when the sit that preceded it moved the player. **That is a
different bug from the one `notes/C-seat-exit-URGENT-for-F.md` describes, at the
same seat, with the same symptom.** Fixing the shadowing will not fix this.

## It is not one seat

Same threshold, same behaviour, on a seat in a different module by a different
author:

    bus stop bench (props.ts, B) — approached from the walking lane
      from (5.90, -34.55)   teleported 1.07 m   ** STUCK   (x2)
      from (6.15, -34.55)   teleported 1.22 m   ** STUCK   (x2)
      standing on the pose   teleported 0.00 m   stood up  (x2)

Two seats, two modules, one threshold. This is kit behaviour, not a seat that
was registered wrong.

**And the bus stop is worse than the bed, for a reason worth naming.** B raised
that seat's radius from 0.95 to **1.40** deliberately, to fix the user's
*"cannot be sat on from the street"* — the comment at `props.ts:2409` explains
the reasoning and the reasoning is good. But the stuck band lives at the *outer
edge of the trigger*, so **widening a seat's radius widens its trap.** Every
approach I tried at the bus stop was inside the band; I could only get it to
release me by standing exactly on the seat. A future fix that answers "this seat
is hard to sit on" by enlarging `r` will make this worse each time.

## What I am not claiming

I have not read the kit's sit/stand implementation — `crosstown.ts` and `fp.ts`
are not mine — so I am reporting a measured threshold and a mechanism boundary,
not a line number. The threshold is the useful part: it is reproducible, it is
the same on two seats, and it gives whoever owns the fix a predicate that goes
red today and green when it is fixed.

## Status

**Left LANDED, not confirmed.** J and B set that precedent for this row and it
was right when the fault merely could not be reproduced. It is more clearly
right now that it can be: a row titled *"pressing e doesnt get me out of it"*
must not read CONFIRMED while the user can still get stuck in that seat.

**Everything already in the cell reproduces** — 225 seats, 149 with a non-stand
spot inside the stand radius, `sleep until morning` live at 0.55 m from the bed,
69 seats at exactly 0.00 m. I re-measured them all and add no correction.

One refinement to the blast radius, since it changes what to prioritise: of the
149 contested seats, the rivals are almost all *other seats' sit spots*, which
carry the `!rig.seated` guard and are dead while seated. **Only four seats in
the world have an unguarded non-sit rival live from the seat** — room 301's bed
(`sleep until morning`), both bus stop benches (`take the folded newspaper`) and
one diner stool (`order fries — $0.99`). That is the exposure to the *shadowing*
bug. The teleport bug above is separate and affects all 225.
