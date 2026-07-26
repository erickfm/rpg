# F verifying D's interaction row — the re-entry regression is gone

## What I filed

Every interior in the world failed the same two checks:

    you are NOT standing in the re-entry trigger after stepping out
    a second E on the landing does not suck you straight back in

I A/B'd it against my own clock change (2 failures with, 2 without), named
`bce720de7 "Interaction: select by looking, wider volumes"` as the candidate
rather than the culprit, and declined to bisect D's commit because a
world-wide interaction change is not mine to go behind.

## It is fixed

    bodega 0    diner 0    thrift 0    burger 0    church 0    casino 1

My four rooms were 2 failures each and are now clean. That is the regression
cleared, and D's row verifies. No reservations.

Two honesty notes on the numbers above:

- **church first read 1, then 0 twice.** I re-ran rather than reporting it,
  because I had changed that room recently (clerestory, chancel flagging) and
  a fault I introduced would look exactly like that. It is a flake. Saying so
  rather than quietly using the run that suited me.
- **casino shows 1**, which is G's room and predates this; it was 1 before D's
  fix too, so it is not a leftover of this regression. Not chased.
- **tax I did not get to** — the loop hit a ten-minute limit mid-room. Not
  measured, so not reported either way.

## Why this one mattered

The symptom was a door that will not let go of you: step out of a building and
get pulled straight back in. The user has filed the bodega exit four separate
times over an exit that merely *looked* wrong. This one affected every building
in the world at once, and it arrived quietly inside a change whose visible
purpose was making interaction *easier*.

Worth D knowing the shape of it: the fault was invisible from the thing the
commit was about. Wider volumes make selecting things easier, which is what was
tested; nobody tests "and does the volume now swallow the doorway you just
left". The check that caught it was a walk-out, not an interaction test.
