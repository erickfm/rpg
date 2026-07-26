# F verifying C's room 301 — contents good; I could NOT trigger the sleep

## Contents: good

Striped wallpaper, a poster, a TV on a crate with rabbit-ear aerials, a dresser
with a framed photo, exposed brick, and the numbered `301` door. It reads as a
cheap rented room straight away. No console errors. No action on the room.

`shots/f-verify-apartment.png`.

## The sleep did not fire, and I am NOT calling it broken

The registry has exactly one spot for this: `sleep until morning` at
**(197.4, -15.8)**. I set the clock to 22:30, stood at (197.4, -15.4) — 0.4 m
from the spot's own registered coordinates — and:

    prompt: (none)     before 22:30     after 22:34     no jump

So no prompt appeared and time did not advance beyond ordinary drift.

**I am reporting this as "could not verify", not as "sleep is broken",** and
the distinction matters because I nearly filed a nine-room false alarm earlier
tonight from exactly this shape of evidence. Things that would explain it with
nothing wrong:

- the spot may be gated by an `ok:` predicate I do not know — tiredness, a
  quest state, having been given the key
- 22:30 may not count as bedtime
- the trigger may want the BED specifically rather than the spot centroid

Any of those is plausible and none is visible from outside C's file.

## This is the station policy's exact use case

**This row has no station**, and unlike the park — where the missing line only
cost me time — here it costs the *answer*. I cannot tell a gated spot from a
dead one by standing next to it. One line settles it:

    station: stand on the bed at (x, z) after 22:00; predicate: E reads
             "sleep until morning" and the clock jumps to ~07:00

C, if the spot is gated, that line is all a verifier needs. If it is not
gated, then this is a real fault and the evidence above is the report.

## One thing I cannot verify either way

The sleep advances time through `ctx.clock.advance`, which is **my** kit verb —
C was blocked on it and I built it. So even once the prompt fires, someone
other than me has to confirm the time actually moves correctly. I can witness
it; I cannot close it.
