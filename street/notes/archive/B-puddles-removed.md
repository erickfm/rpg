# Standing puddles are REMOVED. Do not re-add them.

Desk ruling, 2026-07-25, honoured in full. This note exists because the desk
asked that it survive, so that the sixth attempt never gets started.

**This is not a failure of the weather system.** Everything else the user liked
stays, is measured, and is green:

| kept | still asserted by |
|---|---|
| the wet-look darkening | `rain.mjs` — road goes 1.000 dry → 0.164 in a storm |
| wetness outlasting the rain | `rain.mjs` — 0.2508 → 0.5540 → **0.7356** thirteen seconds AFTER it stops |
| the rain itself | `rain.mjs` — falls at both hours, 81.8 levels of contrast by day |
| wet walls | untouched (`splashMats`) |
| the gutter grime stain | `footprint.mjs` — in the pan, not on the walk |

If the street ever looks dry after a storm, it is not the puddles that are
missing — read the road. The wet look never lived in the puddles.

## Why it stopped

Five passes, none of which landed: buried under the pan → contrast-inverted so
they vanished in the rain → ribbons in the gutter → a dark band down the middle
of the pavement → a pale smear lighter than the road and straddling the kerb.
The desk's terms on approving the fifth were explicit, and it missed.

**The diagnosis was right and is worth keeping even though the feature is not.**
A puddle drawn as a FIXED dark colour inverts its own contrast, because the wet
tint crushes the road several times darker in a storm and overtakes the sheet —
so the water reads LIGHTER than the road at exactly the moment it should be most
visible. Anything reflective laid on the road later must be defined relative to
the surface it sits on, never as an absolute. That paragraph is now in
`ct/props.ts` where the meshes used to be built.

## What enforces it, so it is not just this note

- `footprint.mjs` asserts **no standing puddles (0)** and prints "removed by desk
  ruling, do not re-add".
- `canfail.mjs` case `footprint-water` was retargeted from "shove the pools out
  of the pan" to **re-adding a puddle**, and footprint goes red on it. Watched:
  `OK footprint-water CAUGHT a standing puddle re-added after the desk removed them`.

## The world did not otherwise move, and here is the proof

`rnd()` is one shared seeded stream and its ORDER is load-bearing (GOTCHAS 2).
The placement loop drew from it 5 times per patch, 7 times over, in the MIDDLE
of the module — deleting those draws outright would have moved every tree,
pigeon and piece of litter on the block. **So the 35 draws stay and only the
meshes go.** The loop that remains looks like dead code and is not.

Verified rather than argued, with the loaded build proven by its `addPuddle`
count:

```
                    rnd stream            structure
ORIGINAL  (4)   0.7102595681790262        5886
MINE      (0)   0.7102595681790262        5877     -9
```

Identical stream, and the geometry-only structure diff is **exactly nine
PlaneGeometry meshes** — seven 0.34 m gutter patches and the two 0.36 m basin
ones — with nothing added.

**One honest caveat about `fpdiff`.** It also reports ~327 changed TEXTURES, and
that is an artifact of the harness, not the world: `scenedump.mjs` seeds
`Math.random` at page init so dithered art is reproducible, which makes its call
COUNT load-bearing inside the harness. Removing nine meshes shifts it. In the
real game `Math.random` is unseeded — I checked, two loads give different values
— so that noise is re-rolled every session anyway and no player can see a
difference. Structure and the `rnd()` stream are the channels that mean
something here, and both are clean.

## Three checks of mine were measuring water that no longer exists

Worth stating plainly, because all three would have gone quietly wrong in the
direction that hides a bug — GOTCHAS 34, which is my own entry.

- **`wetness.mjs`** was finding "2 puddles" — they were the gutter STAINS, which
  its predicate matched alongside the puddle sheet. Four verdicts about puddle
  physics (crest-late, individual depths, darker-than-the-road, a floor of 7
  pools) are retired. What survives measures SURFACES, which is where the wet
  look always lived.
- **`rain.mjs`** measured wetness as the mean OPACITY of the puddle sheets, so it
  returned null and failed on a correct world. It now reads how dark the road is
  against its dry colour.
- **`canfail.mjs`** had two stale needles quoting deleted code — `wetness` and
  `wet-blind` — which is the fourth time a needle has gone stale under a fix this
  week. `wetness` is retargeted at the surviving contract; `wet-blind` is retired
  with a note in place, because a case vanishing silently looks identical to one
  somebody gave up on.

Two of my own errors while doing it, both caught by the instruments rather than
by me: I set the stain population floor to 2 by counting `stain()` calls in the
source instead of meshes inside the check's window (the second is at z −103.6,
out of scope — the floor caught it), and I wrote "measured, not guessed" over two
invented constants in `rain.mjs` that made the signal read a flat 0 on a working
world. Both numbers are now asked of the world.
