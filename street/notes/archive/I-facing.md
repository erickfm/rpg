# Nothing in the lot faces a wall — and my own check lied to me twice first

Builder I, 2026-07-25. Third queue item: *"the chairs are backwards"* — the blue
and orange chairs outside the office turned so a person sitting in them would
face the building.

**The chairs were already fixed** (`0adf572b0`, `chairSpin(ψ) = -ψ`). The half
that had never been done is the queue's second sentence: *"check every other
seat, sign and board in the lot the same way, by standing where a person would
use it."* That is `scripts/I-facing.mjs`.

## What it does

**Seats** — walks onto the registered spot, presses `E`, and reads the camera's
own yaw back. Then marches that view direction through the collider registry to
find what you are actually looking at.

**Signs** — takes each readable sheet's outward normal out of its world matrix
and marches along it, both ways for double-sided sheets.

## Result

```
  3 places to sit in the lot
   "sit down"       (24.70, 3.75)  seated yaw 279deg -> open lot as far as colliders go
   "sit down"       (24.39, 4.62)  seated yaw 251deg -> something solid 6 m ahead
   "sit on the tyres" (27.60, 11.60) seated yaw 270deg -> something solid 21 m ahead

  59 readable sheets — 56 with clear air, 3 flush-mounted on their own fixing
```

`shots/I-d-seated.png` is the view out of the blue chair: the stock, the aisle,
the pole sign, the street beyond, and `[E] stand up`. That is what "chairs
outside an office face OUT" looks like.

## Four times this instrument was wrong, and every one would have shipped a lie

Recording these because the pattern — *my sign-offs are reliable when I measure
and unreliable when I look* — is already in `C-STATUS.md`, and three of these
four produced a **confident green or a confident red on nothing at all**.

**1. 58 of 145 sheets "blocked at 0.12 m".** Every one was a price card reading
its own windshield or a banner reading its own fence. A sign is mounted ON
something; that is not the defect. Fixed by ignoring solids in the sheet's own
root group.

**2. Two of three seats "DID NOT SEAT — eye drop 0.000 m".** They reported
`yaw 0`, which is not a seat facing north — it is the default yaw of a player
who never sat down. The cause was my loop, not the world: warping away from a
chair does not stand you up, so the next seat's press toggled me *upright* and
its "before" height was already the seated one. **A probe that cannot tell a
seat facing north from a seat it never sat in would have reported two seats
correct without testing either.** Now the eye must drop 0.25 m or the seat is
reported UNTESTED, which is a third state and the honest one.

**3. The tyre stack "faces something solid 0.25 m ahead".** That solid was the
tyre stack being sat on. Colliders here are 2D footprints with no height, so
they are effectively infinitely tall and any seat standing on one hits it
immediately. Now any collider containing the seated point is excluded — the
chairs deliberately carry no collider, so they lose nothing.

**4. The one that matters: the sign half was passing 59 of 59 while testing
nothing.** I had excluded solids sharing the sheet's *parent* as well as its
root group. Almost everything in this lot is added straight to `scene`, so
"same parent" meant "same scene" and **every sheet was excluded from every
blocker in the world.** It reported a confident green.

I only found it because the `--selftest` I wrote afterwards turned a sign to
face the office wall and this reported it clear. **The check was green, the
world was fine, and the two facts had nothing to do with each other.** That is
the exact failure this project keeps paying for, and the only thing that caught
it was refusing to trust a green I had not watched fail.

## The selftest has two halves on purpose

The two failures are independent, and one mutation would leave the other
unproven:

```
  SELFTEST: put a wall in front of 1 chair, turned 1 sign into the office wall
  · seat "sit down" faces something solid 0.25 m away — that is a wall, not a view   (x3)
  · a readable sheet at (25.85, 1.5, 2.6) has something solid 0.3 m in front of it
  exit 1
```

The wall is placed from the **seated** position, not the spot. Placing it from
the spot put it 1.75 m from the eye — the spot is the approach, a stride in
front of the chair — and the check correctly ignored it, proving nothing.

## The one judgement call, stated rather than buried

`MOUNT = 0.15 m`. A sheet flush against something is *fixed to* it, and no
viewing distance exists at which it would have read differently. What the user
meant is a sign with real air in front of it and then a wall. Sheets at or
under 0.15 m are reported as mountings and **not judged**; the band from there
to 1.0 m is what fails. Three sheets sit in the mounted band.

## One change to `ct/lot.ts`, and it is inert

A weed is an upright textured plane and so is a price card; nothing in the
geometry separates them, and two weed tufts growing against the office step were
flagged as signs facing a wall. So `lot.ts` now **declares** which of its sheets
are not signage (`userData.notSignage`) at the two `weedTuft` call sites.

Declared, not inferred, deliberately — the alternative was a size threshold that
would misclassify the first small sign or large tuft anyone adds. Same move as
B's `userData.printed`: the caller says what a thing IS instead of a checker
guessing from pixels.

**Proved inert.** Scene fingerprint with and without the change, on the same
running world:

```
  objects=6714 uniqueTextures=1154
  textures=6656246f  structure=69121cd  tints=be08624b  places=beddb554
```

Identical in both, all four hashes and both counts. No geometry, no material and
no `rnd()` draw was touched.

*(`npm run fpdiff` itself could not read the pair — it expects a filename
convention `npm run fp <label>` does not produce. Not my script; the matching
hashes above are the evidence. Filed for whoever owns it.)*

## Registered

`I-facing` is in `scripts/checks.mjs` and green in the suite, alongside `I-rows`
and `I-clip`.
