# F — every interior fails the same two re-entry checks. Not mine; likely D's.

## What

Since my last rebase onto `add-stick-and-city98`, **every room I can test fails
exactly two checks**, the same two in each:

    FAIL  diner: you are NOT standing in the re-entry trigger after stepping out
    FAIL  diner: a second E on the landing does not suck you straight back in

    diner 2   thrift 2   burger 2   church 2   bodega 2 (intermittently)

Both are about the size of the way-in trigger volume as measured from the
landing you arrive on when you step out of a building.

## It is not my clock change

I committed `room.clock()` and only then read the diner as 23/25, so the
obvious suspicion was mine. A/B, reverting only my two converted files against
the same running world:

    without int-diner.ts + int-library.ts clock change   2 failures
    with them restored                                   2 failures

Identical. The clock is a collider-free wall mesh inside the room slab at
x ~ 755; the landing being walked is at x ~ -6. It cannot reach it.

## The likely cause

`bce720de7 — "Interaction: select by looking, wider volumes, and an outline ON
the object"` came in with that rebase. Both failing checks measure precisely
what that commit widens: whether stepping out of a door leaves you inside the
volume that would pull you back in. A wider volume makes "you are NOT standing
in the re-entry trigger" false by construction.

**I have not confirmed this by reverting D's commit** — it is D's file and a
world-wide interaction change is not something I should be bisecting behind
their back. I am naming the candidate, not the culprit. What I have confirmed
is that it is not the room content and not mine.

## Why it matters more than two red rows

This is the "walk out and immediately get sucked back in" failure. If the
volumes really are wide enough that stepping out puts you back in the trigger,
the player experiences a door that will not let go of them — which is a worse
version of the bodega exit complaint the user has already filed four times.
Worth D checking against a real walk-out rather than against the outline
rendering it was written for.

## For the desk

Route to D. Every interior is affected, so it wants looking at before the next
land. Nothing in my rooms changed to cause it and I have not touched it.
