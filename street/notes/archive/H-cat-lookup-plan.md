# The cat look-up: what I found in `ct/cat.ts`, and the two things it needs

Item: *"can we somehow make it so the cat looks up at you?"*
(`shots/user-cat-lookup.png`). `ct/cat.ts` moved to me this pass.

**Not started in code.** I read the file, and two facts change the job enough
that they are worth writing down before anyone spends a pass on it.

## 1. The cat is a ONE-FRAME sprite, not an eight-angle one

The brief says *"draw it on all eight angles, or on however many the cat has"*.
It has **one**. `CAT_DESIGNS` holds a single `black` entry, painted once into
one `pixTex(CW, CH)` and put on one `PlaneGeometry` that goes into `boards` for
yaw billboarding.

So the pose work is **one extra frame**, not eight — far cheaper than the
seated pose, exactly as predicted, but for a different reason than expected.
There is no three-quarter view to check because there are no three-quarter
views at all; the whole sprite is the one the player always sees.

That also means the "check the three-quarters, not the profile" warning does
not apply here — but its POINT does: verify the new frame at the distance and
angle the player actually stands, not flat-on in a contact sheet, because a
head tilt of two or three texels is the entire effect and it will look
different foreshortened.

## 2. There is no per-frame hook to run the test in — and that is the blocker

`buildCatRig({ scene, boards, AZ1 })`. That is the whole signature. No `ctx`,
no `onFrame`. The near-and-above test has nowhere to live, and swapping
`material.map` needs to happen per frame.

Two ways, and the choice is the desk's because one touches a file that is not
mine:

- **Pass the hook in.** `buildCatRig` takes `onFrame` like every other module
  does (`PARALLEL-WORKFLOW.md` §15, the registration pattern). One extra field
  at the call site in `ct/alley.ts`, which is D's.
- **Publish and let the caller drive.** `buildCatRig` returns
  `{ update(px, pz, py) }` and the alley calls it. Same edit to D's file, but
  the cat keeps its own state.

I would take the first — it matches every other per-frame module in the world.

## The design, settled, so the next pass writes code and not decisions

**An UP frame, never a pitch.** Head tipped back two or three texels, ears
rotated back, eyes up and slightly larger. Yaw billboarding untouched. A sprite
that pitches lies flat when you look from a roof and swings as you walk, and it
breaks the Quake 8-angle idiom the world is built on.

**Near AND above, both.** A cat that stares from across the alley is uncanny.

```
near   horizontal distance  < ~1.6 m
above  eye height above the cat's head  > ~0.9 m
```

**Hysteresis, not a hard switch** — GOTCHAS 7's floor-picker precedent, and I
have the pattern working already: the citizen view-selector holds its sector
until the heading is 0.7 sectors past the boundary, and I proved that is
load-bearing by setting it to 0 and watching A->B->A flicker return on 5 of 6
walkers within 47 ms. Do the same here: enter the up-pose at the thresholds
above, leave it only at ~1.9 m / ~0.75 m, so shifting weight at the boundary
cannot flicker it.

**How to verify it, given there is one frame:** stand at the user's own
viewpoint from `shots/user-cat-lookup.png` and compare before/after there — the
same method D used for the seventh-position fix, which is in this file's own
comments as the thing that finally settled it (*"warp to the exact viewpoint of
that shot, look, move the cat, look again"*). An offset or a tilt is only right
in the frame it was computed for.

## Sequencing

The seated pose is done and landed, so this no longer collides with it. The
seated work is the precedent for the technique and `notes/H-seated-sprite.md`
carries it.
