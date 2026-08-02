# w29 — item 63: `wetness` asks whether the street is wet now

**Root cause, one line:** the verdict was `last.broad !== wet.broad` — *"the
surface is no longer what it was mid-storm"* — and that is precisely what
drying does, so the check was **satisfied by the very thing it was written to
detect**.

Port: **4188** (proved free first, shut down at the end).

## Why "it never rained" is not the mutation that proves this

My first mutation was to skip the storm. It goes red — but so would the OLD
predicate, because with no storm the mid-storm sample is dry too and
`dry !== dry` is false. **A mutation both versions catch proves nothing.**

The real failing scenario is *it rained and then dried COMPLETELY*, which is
what w22 saw. Reaching that live means waiting out `48 * (1 + soak * 1.5)`
seconds of drying by design, so `scripts/probes/w29-wetref.mjs` applies both
predicates to readings **measured in the same run** — a real storm sample and a
real bone-dry sample taken before it:

```
if the street dried COMPLETELY and each predicate were asked "is it still wet":
  OLD  last.broad !== wet.broad          -> PASS  <-- SLEPT   (3c3c3c !== 1e1f21 is true)
  NEW  darker than dry, on both surfaces -> FAIL  <-- correctly red
```

Nothing there is invented: `3c3c3c` is a real reading of a real dry street and
`1e1f21` a real reading of a real storm. The only supposition is that the street
reached dry again — which is what drying is.

## What changed — `scripts/wetness.mjs` only

**A dry reference, taken at the same hour.** props colours a surface
`base * ambient` when dry and multiplies it toward `WET_WALL` when wet
(`ct/props.ts:1022-1030`), so *the hour's own light changes the colour by more
than the rain does*. A reference from a different hour would measure the sun.
It is taken just after the outdoor warp and before the storm, which makes it
free: `wetness` starts at 0 on load (`ct/props.ts:185`) and the spawn is indoors
where props forces `rainLevel = 0`, so nothing has soaked. **Measured: wetness
is exactly 0 there**, and the script refuses to continue if it is not.

**The predicate has two legs and asks for a DIRECTION.**

```js
const streetStillWet = last.wetness > 0.004 &&
                       darkerRoad > 0.02 && darkerGutter > 0.02;
```

- `wetness > 0.004` — the simulation still believes the ground is wet. 0.004 is
  props' own early-out epsilon for "effectively dry", not a number I chose.
- *darker* than the dry reference, on both surfaces — what the player can see.
  Relative luminance rather than `!==`, so a tint that **lightened** the road
  fails. That inversion is the exact bug this file was written for and `!==`
  could not tell the two apart.

Both legs, because they fail differently: the scalar alone would pass a world
whose tint had stopped being applied; the colour alone would pass a world that
had frozen the tint on.

**The 0.02 threshold is not tuned-until-green.** Measured margin is
**0.1336 (road) and 0.1462 (gutter)** — an order of magnitude above the
threshold, and the threshold is itself well above the ~0.004 quantisation of an
8-bit channel. The failing case reads 0.0000.

## Verified

- **`wetness` scores CAUGHT in an end-to-end canfail run** — the item's first
  DONE WHEN condition:
  `OK   wetness     CAUGHT  the street bone dry on the last drop of rain`,
  `1/1 checks caught their mutation`, `every mutated file restored
  byte-for-byte`. That case mutates `dryFor` 48 → 0.24 in `ct/props.ts`, drying
  the street ~200x too fast, which is the sleeping scenario made real.
- **Goes red on a deliberately dry street** — the second condition. Storm hour
  replaced with the dry hour: `FAIL the street is still wet ... (wetness 0.000;
  road 0.0000 and gutter 0.0000 darker than dry, need >0.02)`, **exit 1**, bytes
  15395 → 15458. Reverted; `cksum` back to 874926634 15395.
- Clean run passes with the margins quoted above, exit 0, no page errors, and
  the other two verdicts (`the rain actually stopped`, `the gutter and the road
  crown dry at different rates`) are untouched and still green.
- `git status` clean after canfail — it restored `ct/props.ts` as it claims.

## Found and NOT fixed

1. **`gutterHolds` is the same shape of weak predicate.**
   `samples[3].strip !== samples[3].broad` asks only that two surfaces *differ*,
   not that the gutter is the **wetter** one. A world that dried the gutter
   FASTER than the crown — the inversion — would pass it. Same one-line fix:
   compare luminance and demand a direction. I left it because it is outside
   this item's stated subject, and it is a real hole.
2. **`stillFilling`, `stillDark`, `individual` and `spread` are computed and
   never used in any verdict.** They are leftovers from the deleted standing-water
   block; `enough` is a hardcoded `true` sitting in the exit condition. Dead
   predicates in a check file read as coverage that is not there.
3. **The dry reference costs a 1.5 s settle and assumes the spawn is indoors.**
   If the spawn ever moves outdoors onto a rainy hour, `wetness` will not be 0
   at that point — the script now *fails loudly* rather than measuring against a
   wet baseline, which is right, but the fix would then be to seek a dry hour
   first. Flagged in the code.
4. **`git stash` is shared across worktrees** — see `notes/w29-sedan-climb.md`
   §5. Third item running that this has been worth saying. Worth a GOTCHAS entry.

## Derived or copied?

**Derived.** The rain schedule is read from `scene.userData.rainAt` (this file
already did that); `wetness` and the 0.004 epsilon come from
`scene.userData.wetness` and props' own early-out; the dry colour is measured
from the world rather than named. The only constant I introduced is the 0.02
luminance threshold, justified above against a measured 0.13-0.15 signal.
