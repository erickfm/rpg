# `m.userData.printed` — what each owner needs, measured

Companion to [`B-printed-optout-for-C.md`](B-printed-optout-for-C.md), which
covers C's lot sheets. The desk's ruling asks that **H apply the same flag to
the citizens**, so this note is for H and for every other owner who finds their
module in the table below. The flag itself is landed on mainline (`aaba2a817`)
and is inert until somebody sets it.

```ts
m.userData.printed = true;   // this sheet is INK, not a light — grade me like masonry
```

`isSelfLit` reads it before it looks at a single pixel, so it cannot be
out-voted by the texture heuristic.

## Who is holding full daylight after dark

At 23:00, by the module that owns the mesh:

| module | selfLit meshes |
|---|---|
| lot | 62 |
| street | 38 |
| vice | 34 |
| walkup | 16 |
| (unattributed) | 5 |
| **total** | **155 meshes on 113 distinct materials** |

**A high count here is NOT automatically a defect, and I am not filing it as
one.** `street` owns shop neon, lit fascias and lit windows, which the user
asked in as many words to keep bright — *"Lit windows and signs must NOT dim"*.
Those SHOULD be selfLit. The table says where the flag may be needed, not where
anything is wrong; only the owner can tell ink from a light source.

## The one thing that will bite you: four of these materials are SHARED

I nearly published "one flag sets one object", because among alpha-tested
sprites that is exactly true — 42 selfLit sprite meshes on 42 distinct
materials, nothing shared. Across **all** materials it is not:

```
  22 meshes share one 20x26 material   (lot)      <- the one to look at
   8 meshes share one 12x16 material   (vice)
   8 meshes share one 24x24 material   (walkup)
   8 meshes share one 24x24 material   (walkup)
```

The other 109 selfLit materials are worn by exactly one mesh each, so for those
one flag really is one object.

**A shared material cannot carry a per-object answer.** Setting `printed` on
that 20x26 grades all 22 lot meshes at once. If they are all the same kind of
printed thing — one price-card sheet reused — that is correct and cheap. If they
are not, they need splitting before flagging, or 21 objects change with the one
you meant.

This is the same shape as the weed tufts, where one material worn by 439 tufts
took its lighting from whichever tuft the grade traversed first. Worth checking
rather than assuming; I assumed the reassuring answer first and it was wrong for
the general case.

**So: set the flag where the material is CREATED**, not in a pass over the built
scene. Every module builds before `props.dimWorld(scene)` runs (crosstown.ts
lines 241/402/419, against 491), so a creation-time stamp is always in place
before the grade — and `dimWorld` processes each material exactly ONCE
(`litSeen.has(m)) continue`), so a stamp applied while it is already running can
arrive after that material has been claimed.

## EXPECT TWO SURVIVORS IN THE LOT, and do not chase them

**Corrected here, because I published the wrong reason first.** I wrote that the
two lot materials which stay `selfLit` under the flag were probably a
traversal-order effect on a shared material, flagged as a guess. It is not, and
guessing was the mistake — I re-ran it with the stamp applied as a PRE-PASS,
before any material could be claimed, and the same two survived. Traversal order
cannot explain something that survives being flagged first.

The real reason is in your own file, and it is correct behaviour:

```
  ct/lot.ts:1963   haloM.userData.selfLit = true; haloM.userData.graded = true;
  ct/lot.ts:1973   poolM.userData.selfLit = true; poolM.userData.graded = true;
```

You hand-declare the halo and the lamp pool as lights. `isSelfLit` is never
asked about them, so `printed` is never consulted — measured, both survivors
carry `printed: true, graded: true`, the 24x24 halo at full brightness and the
32x32 pool at 0.367.

**A hand declaration outranks the heuristic, which is the right way round.**
`printed` governs what the GUESS decides, not what a module asserts. So when you
flag your sheets, expect **41 → 2**, and expect those two to be your halo and
your pool. That is the finished state, not a residue.

## Why a hand flag rather than a better threshold

C's measurement is the argument, and it is worth restating because it is not a
matter of tuning:

> the lot salesman is **13.2%** hot and is stamped `selfLit`, dimming **0.0%**.
> A street pedestrian — same `citizenSprite`, same atlas generator — is **23%**
> hot and is stamped masonry, dimming **95.5%**.

A hotter sheet called "not a light" and a cooler one called a light. The
threshold is not what decides, so no threshold fixes it. Printed artwork in
saturated ink and a neon tube are identical in texels; they differ only in
whether anything is behind them, which a texture cannot show.

And per the ruling: **do not repaint artwork to slip under the threshold.** The
palette is the user's and approved, and the pole sign was enlarged and
re-contrasted for legibility from the far kerb.

## What it buys, watched rather than argued

Stamping every lot material and measuring, then reverting:

```
                    selfLit        mean night luminance
lot   before          41/242              0.2058
lot   with flag        2/242              0.0557      <- 3.7x darker
street  (untouched)   38/419              0.1259      unchanged
vice    (untouched)   27/62               0.5579      unchanged
```

It serves the user's own words — *"make the unilluminated stuff darker. it
should feel scarier at night"*.
