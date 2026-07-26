# F — my modal sweep is broken; do not use its output

I tried to generalise the confirmed slot finding — *is E blocked in EVERY
modal, or only that one?* — by looping over the four modal-ish spots and
pressing E twice at each.

It reported **"no seated state (not a modal seat)" for all four**, including
`sit at the slot`.

**That is false and I know it is false**, because twenty minutes earlier, on
the same build, the same spot returned:

    in the machine:   seated {x: 675.64, z: 13.42}
    after pressing E: STILL SEATED
    after ESC:        null

One target tested carefully said seated; four targets tested in a loop said
none of them seat you. **The single test is the one to believe** — it is the
one whose result I watched and screenshotted.

## Why the sweep is probably wrong

The loop warps between the casino (x≈675), the bank (x≈440) and the street
inside a couple of seconds each. Every one of those spots is gated on
`room.inside`, which the world updates from the player's position on a frame
hook. **Warping and pressing E 600 ms later does not give the gate time to
notice you have arrived**, so the spot is registered but not live, and E does
nothing — which my script then read as "not a modal seat".

The careful single test warped once, waited, and pressed.

## What I am NOT publishing

Any claim about whether the bank's loan panel or the ATM block E. I do not
know. **The slots row stands on its own evidence and nothing else is settled.**

## The lesson, which is now a refrain

This is the same failure as every other instrument error tonight: **a sweep
that is convenient produced a confident answer about a population it never
actually reached.** The fix is the same too — one target, watched, then repeat
deliberately, rather than a loop that treats every target as interchangeable.

I am recording the broken sweep rather than deleting it because "all four are
fine" is exactly the kind of tidy negative result that would have been believed.
