# Builder A — the see-through check was watching the wrong brick

Landed in **`0796cc62`**, `scripts/check-seethrough.mjs` only.

## What was wrong

D's `64cf44b2` rebuilt the bodega. That is the moment a hand-aimed camera goes
stale, so I checked mine rather than trusting it — and it was already wrong,
and had been for longer than the rebuild.

Fifteen of sixteen shopfronts get their camera from the frontage register, so
they follow the world automatically. The bodega bay cannot: it is hand-built on
a 45° chamfer and never enters the register. Its camera was three constants
typed once — `warp(6.2, -98.2, 2.42)`.

Measured off the running scene:

| | |
|---|---|
| bay cut-out | `PlaneGeometry` 2.83 × 4.20 @ **(8.00, 2.10, −95.00)**, `alphaTest 0.5` |
| its backing | same size, 0.45 m behind @ (8.32, −94.68) |
| outward normal | (−0.707, 0, −0.707) → square-on camera **(5.17, −97.83)** |
| the camera in the file | **(6.20, −98.20)** — 14° off the normal |

At 14° off, the door's centre projects to frame x ≈ 0.62 while the sample box
ran 0.42..0.60. **It was counting pixels on the brick beside the glass.** Every
green bay result this file has ever printed was green for that reason.

That is the exact failure this script exists to catch, committed by the script:
a detector reporting confidently on a world that had moved underneath it.

## What replaced it

The camera is **derived**, not typed. Find the cut-out by what makes it
hazardous — an `alphaTest` material wearing the shopfront band texture — take
its world centre and normal, work out which way is out from **where its backing
sits** rather than guessing the sign, and stand square on at 4 m. The sample box
is that rectangle projected with the same arithmetic the main loop uses, so it
tracks the bay's size instead of needing hand-tuned frame fractions.

Rebuild that corner again and the camera follows. There is nothing left to go
stale.

If the cut-out is not found, or is found and is not in shot, the script **exits
non-zero and says it is inert** rather than passing quietly.

## `--selftest` could not have caught any of this

Two reasons, both worth knowing:

1. It hides backings by **texture signature**, which never disturbed the bay.
2. The bay's middle is a solid **door leaf** on its own mesh with its own
   texture. Even with the band hidden the doorway stayed plugged, so there was
   nothing to see through and nothing to fire.

It now clears everything standing in the bay's opening, and it **names which
frontages fired** (`fired: 2, 3, 5, 15`) instead of printing a bare count.
"4 flagged" cannot tell you whether the one hand-aimed camera in the file was
among them — which is the only question that mattered here.

## The result, stated as what it actually is

With the bay's opening fully cleared, it **still shows no ground**: D's rebuild
put masonry behind the chamfer. Three outcomes that were previously one line are
now three:

- **fired** — leaks when opened; camera and hole both good
- **framed, cleared, silent** — solid geometry backs it, so it *cannot* leak.
  Stronger than passing.
- **not in shot** — inert, non-zero exit

Normal run green (16 shopfronts + the bay, 931 ground surfaces tinted, up from
610 with the park furniture). Selftest passes.

## The thing worth remembering

The bay was fine. The check was not, and it had been telling everyone the bay
was fine for the wrong reason. Fifteen cameras that derive themselves stayed
correct through a rebuild; the one camera with numbers typed into it did not.
Any constant describing where something *is* will be wrong eventually — the
only question is whether anything notices.
