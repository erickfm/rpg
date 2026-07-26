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

## What it actually needs — and the design is now settled, only the doing is left

The head, torso and arms are drawn at fixed rows near the top of the frame.
Seating means dropping that whole block and folding the legs into the space it
vacates. The arithmetic works out cleanly and keeps the feet where they are:

```
standing   hip row 38   foot row 59   legs 21 rows, straight
seated     hip row 47   foot row 59   thigh forward from 47, shin down to 59
           upper body (head, torso, arms, hair, face) all +9 rows
```

A folded leg needs about 13 rows, not 21, which is exactly the 9 the upper body
gives up — so the figure sits down INTO the frame without leaving it, and the
painted shoe still lands on row 59 where `citizenPlane()` expects it.

**The cheap way to do it:** the painter draws the legs and feet FIRST, then the
torso, arms, head and hair. So the upper-body drop does not need every `oy + N`
rewritten — a `g.translate(0, 9)` after the feet block and a matching
`translate(0, -9)` at the end of the frame moves all of it at once. Two edits
plus the folded-leg block, which I already wrote and can lift back out of
`shots/seated.png`'s commit.

What is still not mine to decide:

- ~~Does the seated figure keep its origin at the feet?~~ **I raised this and it
  is not a question — I had it backwards. A SEATED PERSON'S FEET ARE ON THE
  FLOOR.** So `citizenPlane()`'s feet-origin stays exactly as it is, nothing
  about the 12 cm float fix is disturbed, and the caller places the SEAT to meet
  the figure's hip rather than placing the figure by seat height. That removes
  the decision I said I needed and it removes the hand-offsetting risk with it.
- **How many poses?** Seated covers booths, stools, pews and desks. Leaning on
  a counter is a different silhouette again and half the keepers do that.

**What I need:** confirmation that a real seated pose is in scope for me — it
is a day of atlas work and a `citizenPlane` decision, not the swap the routing
assumed — or a decision to close the row as F/G adoption of the standing sprite
only, which gets the interiors detailed but leaves everyone standing up.

Nothing else of mine is live. `scripts/live.sh H` otherwise shows one CHECK row
(the east-end road flag, blocker cleared, awaiting re-audit).
