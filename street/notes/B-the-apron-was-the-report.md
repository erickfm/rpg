# "this curb is discontinuous and only 3 slabs" was the driveway apron

Ref `shots/user-kerb-discontinuous.png`. Two faults in one sentence, and the
desk was right that they are separate — but they are in the same eight metres of
pavement, and I built both of them.

## Finding where he was standing, rather than guessing

Nothing in the shot is labelled, so the pose was recovered from what is in it:
a traffic cone on the right over dark ground with parking-stall stripes, road on
the left. Cones live at `(8.33, -1.15)` and `(8.33, 6.35)` — the car lot,
flanking its drive. Road on the left with the lot on the right means facing
SOUTH on the east walk. `shots/_b-pose-e.png` is the reproduction; it matches.

That put him on the **driveway apron**, and everything else followed.

## The measurement, at his pose, before touching anything

`scripts/jointfade.mjs` samples a column down the middle of the pavement and a
band across it, in the same frame, and reports each joint's contrast as a
fraction of the concrete either side — so a night frame and a noon frame are
comparable instead of one just being darker.

```
  joints ACROSS the walk   read at 6.95 m, then not again until 1.25 m
                           a 5.70 m hole — the whole middle of the frame
  joints ALONG the walk    18 readable in the same strip
```

**Identical at 13:00 and at 22:30.** So it is not the night grade, which was the
desk's stated worry and worth ruling out.

`apronTex` drew constant-x lines running the apron's full 8.6 m depth, and
exactly two transverse joints, one at each end. **Three ribbons. Three slabs.**
He is not approximating; he is describing what is there.

## What I changed

**The apron is scored both ways now.** The x lines land on integer world x —
the walk's own flag grid, which `walkU` already cuts — so the pavement's joints
run *through* the drive instead of restarting at it. The z lines mark the two
flare shoulders, which is where the slope actually changes, and divide the
6.8 m opening into 1.36 m bays. Tyre tracks run the way a car does, across the
apron at the wheel track either side of centre.

At his pose: **5 readable cross joints → 8**, and the 5.70 m hole is filled.

**The kerb.** `scripts/curbcut.mjs` reads the reveal profile off the built
geometry: it sits at its lip for **7.40 m**. The geometry is right and I am not
changing it — a depressed kerb at a driveway really is a 3.5 cm lip, and the
6.8 m opening is C's aisle width, not a number of mine.

The fault was the uv. The face clipped `kerbTex` at a fixed world height, so
across the cut it showed a **1.5 cm slice out of the middle of the profile** —
no light top edge, no dark grit line, mid-grey against a mid-grey gutter.
`shots/cut-road-across-day.png` is that: kerb, nothing for seven metres, kerb.
It maps the sheet's full height now, compressed rather than cropped. A
full-reveal kerb gets the identical uv it always had, so only the ramped runs —
this cut and the pedestrian ramps — change at all.

## Two corrections I owe

**`notes/B-kerb-and-flags-one-root.md` is wrong** and now carries a correction
at its head. I reported "0.03 texels/m along z" and told the desk this was I's
stretched-cross-section finding accounting for four reports. That number came
from dividing a texture size by the **bounding box of a kerb ribbon that wraps a
corner** — a 0.15 m tall ribbon whose bbox is 60 × 124 m. It measures nothing.
Every walk sheet in the world is at exactly 32 texels/m in both axes.
`scripts/kerbwalk.mjs` prints the real per-sheet numbers.

**Anisotropy was my first hypothesis and it was wrong.** I thought the cross
joints were being filtered away at grazing angles, set `anisotropy = 16` on the
walk sheet, and measured: 5 readable before, 5 after. Reverted rather than left
in as a no-op that would look like a fix to the next person.

## For whoever writes the next probe

`drawImage()` on the WebGL canvas returns a **cleared buffer** — my first
version of `jointfade.mjs` read a column of pure zeros and reported "no joints
anywhere", which is a finding it invented. Read the screenshot instead.

And the **first frame after load is black** whatever `__ct.clock` says. That has
cost me three readings now, so there is a shared `settle(page)` in
`scripts/lib/reachable.mjs`: it waits for the frame to stop changing rather than
sleeping a guess (GOTCHAS 30) and rather than thresholding on brightness, which
would be wrong at night.
