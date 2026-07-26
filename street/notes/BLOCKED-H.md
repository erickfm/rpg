# BLOCKED — builder H

**Item:** *"i want the people inside the buildings to be as detailed and
quake-view like as the pedestrians on the street"* — routed to me because I own
`ct/citizens.ts` and the 8-angle atlas.

## What I found, and it is not what the routing assumed

The row says *"H owns the atlas, which is where the detail lives; F and G place
the keepers"* — implying the primitive exists and the work is adoption. **It
does not, for the case that matters.**

`citizenSprite` is shipped and five modules use it (`apartment`, `interior`,
`lot`, `park`, `weeds`). All ten `ct/int-*.ts` interiors still hand-draw
figures. That is not because nobody read `CITIZEN-STYLE.md` — **it is because
the atlas has only a STANDING pose**, and `Look` carries `jacket pants skin
hair fit accent cut build stride grime` and nothing else. A diner booth, a
casino stool, a church pew and a library reading table have nothing to call.

So the missing half of "as detailed as the pedestrians" is not the detail. It
is the POSE.

## I tried it, and a leg-only fold is not enough — see `shots/seated.png`

I added `seated?: boolean` and folded the lower body: thigh forward from the
hip, shin down from the knee, foreshortened on the front and back views. The
render is in `shots/seated.png`, standing above seated, all five views.

**It fails on four views of five.** The profile reads as sitting. Views 0, 1, 3
and 4 look like a standing figure with odd shins, because I moved only the legs
— and **a seated person's whole upper body drops by about a thigh's length.**
Keeping the head at standing height is what makes it read as standing.

I reverted it rather than ship it. A half-working pose is worse than none here:
F and G would call it in good faith and get standing keepers in their booths,
and the fault would surface as a user report about the interiors again.

## What it actually needs, and why I stopped

The head, torso and arms are drawn at fixed rows near the top of the frame.
Seating means offsetting that whole block down by ~8-10 rows and folding the
legs into the space it vacates — a change through the middle of the atlas
painter, not a branch at the end of it. It also wants a decision I should not
take alone:

- **Does the seated figure keep its origin at the feet?** `citizenPlane()`
  translates so the origin is the painted shoe, which is what stopped the
  world-wide 12 cm float. A seated figure has no shoe on the ground; a caller
  places it by SEAT height. Either the origin moves for this pose, or callers
  offset by hand — and hand-offsetting is exactly how the float happened.
- **How many poses?** Seated covers booths, stools, pews and desks. Leaning on
  a counter is a different silhouette again and half the keepers do that.

**What I need:** confirmation that a real seated pose is in scope for me — it
is a day of atlas work and a `citizenPlane` decision, not the swap the routing
assumed — or a decision to close the row as F/G adoption of the standing sprite
only, which gets the interiors detailed but leaves everyone standing up.

Nothing else of mine is live. `scripts/live.sh H` otherwise shows one CHECK row
(the east-end road flag, blocker cleared, awaiting re-audit).
