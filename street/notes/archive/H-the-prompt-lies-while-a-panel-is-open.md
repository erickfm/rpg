# `[E] stand up` while a panel owns the keyboard — the likely mechanism behind
# "pressing e doesnt get me out of it"

**H, verifier.** For the desk, L, C and whoever owns the prompt.

## The trace

`scripts/H-slot-trap.mjs`, reading `__hud.panel()` beside `__ct.seated()` at a
casino slot stool:

```
  standing at the approach   seated=false  panel=null       prompt "[E] sit at the slot"
  after E #1                 seated=true   panel=ct-slots   prompt "[E] stand up"
  after E #2                 seated=true   panel=ct-slots   prompt "[E] stand up"   <- E did nothing
  after ESC                  seated=true   panel=null       prompt "[E] stand up"
  after E #3                 seated=false  panel=null       prompt "[E] sit at the slot"
```

Sitting opens the machine in the same press. While the panel is up the panel
owns the keyboard, so **E is inert — but the prompt still offers `[E] stand
up`.** ESC closes the panel; then E works.

**Nobody is permanently trapped, and L's row is right on its own terms**: ESC
then E always gets you out, and that is the path L's own check walks.

## Why this matters more than it looks

The user's report on C's row is *"pressing e doesnt get me out of it — stuck in
the TV seat"*. **C could not reproduce it and said so plainly** — 45 of 45 look
directions gave `[E] stand up`, and E stood him up 6 of 6.

**C tested the bed. The bed has no panel.**

Same harness, same timings, both seats:

```
  sit on the bed and watch TV    2 of 2  ->  stood up
  sit at the slot                2 of 2  ->  STILL SEATED, with "[E] stand up" on screen
```

The harness is not the variable. **A seat that opens a panel behaves differently
from one that does not**, and the difference is invisible from the prompt.

I cannot prove this is what happened to the user — he said TV seat, and the TV
seat works. But it is a reproducible way to press E at a seat, see `stand up`,
and have nothing happen, which is his sentence exactly.

## The fix, and it is not L's

Either the prompt should not claim `E` while a panel owns the keyboard, or the
panel should advertise ESC. One line at the prompt, and an unreproducible
complaint becomes a fixed one.

## A correction to my own earlier note

On C's seat-exit row I measured the casino as **78 seats with a rival spot inside
the 0.5 m stand radius and zero coincident**, and concluded the casino's risk was
the near-miss kind — a rival winning the pick.

**That was not the mechanism.** Seated at the slot, the only live spot within
0.6 m is `stand up` at 0.00 m. Nothing is stealing the press. **It is the panel,
not the pick.** The census was accurate and the inference from it was wrong.

— H
