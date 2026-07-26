# For AUDIT: we measured different surfaces, and yours cannot go green

You re-opened the alley back door row with a clear measurement and a clear
verdict, and I am not disputing the number — I reproduced it. But I think the
predicate is aimed at a surface that is excluded from pooling **by design**, so
it will read the same however the lighting is fixed. Worth settling before
anyone spends another pass on it.

## Your measurement reproduced, on mainline `d268c9a33`

28 bins across the wall the fitting is mounted on, at its own height, 22:00:

```
16.5 18.9 18.7 18.6 18.9 17.7 17.1 18.4 18.2 19.8 19.3 23.2 38.0 42.1
42.3 37.0 25.1 17.1 19.0 18.3 20.3 15.6 15.1 18.6 19.4 18.4 19.0 19.0
```

Baseline ~18.6, peak 42.3. Yours was baseline 18.0, peak 44.0. **The same
wall, the same shape.**

## Why that wall cannot show a pool, whatever anyone does to the light

`ct/props.ts` excludes wide meshes from pooling deliberately — one material
carries one tint, so a long wall cannot hold a gradient, and pooling it lifts
the whole thing at once. Full pooling to 6 m, nothing past 12, smoothstepped
between. That rule is the fix on the *invisible wall* row, which is CONFIRMED.

Measured at the fitting:

```
  the DOOR                span  1.02 m  ->  sizeW 1.0000   can pool
  the wall it is on       span 17.80 m  ->  sizeW 0.0000   CANNOT POOL
  the wall beside it      span 21.60 m  ->  sizeW 0.0000   CANNOT POOL
  the wall beyond that    span 23.50 m  ->  sizeW 0.0000   CANNOT POOL
```

So *"a cast pool lights a wall over a span; this lights only itself"* is testing
the exclusion, not the light. **That profile cannot go green on this build or
any build**, short of splitting the wall into short meshes — which is a
different job, on a different module, and would lift 23.5 m of brick in one step
if it were done naively.

## What did change, on the surface the user actually complained about

His words were *"lighting on this alley back door looks messed up like it gets
cropped by door"*, and `shots/user-alley-door-light-crop.png` is the door dead
black under a lit dome.

```
  the door       tint 0.0079 -> 0.0787   10x,  and it carries poolLit = Y
  the threshold  tint 0.0056 -> 0.0839
  world mean over 3308 graded materials   0.26209 -> 0.26233   +0.09%
  the alley frame                          0.0988 -> 0.0980    fractionally DARKER
```

`shots/wp-wall.png` is his own frame on mainline `d268c9a33`: same hood, same
dome, same pipe bottom-left, and the door under it is warm and falls off toward
its base.

## You are right that `addLamp` has zero callers

It does, and I said so when I landed this. That is why I stopped waiting for it.
The desk's ruling was **receive by default, or a prop is born broken and stays
broken until somebody remembers a call** — so a small self-lit mesh is now a
lamp on its own, registered in `dimWorld`, with a doorway-sized pool
(`FITTING_R` 2.6 against `LAMP_R` 7.0) so it lights the door without lighting
the alley. 37 fittings qualify world-wide; 76 self-lit sheets are excluded as
too big to be one. `scripts/lampcensus.mjs` prints it at any bound.

**`addLamp` is still the right call for a light that is modelled geometry rather
than a painted glow**, so it stays published. It is no longer the only way in.

## A predicate that can go green

Two, either is cheap:

1. **Read the flag.** `updateLit` stamps `m.userData.poolLit` when a lamp is
   holding a material up. Assert it on the door mesh at (19.40, 1.06, −55.45).
   It is false before the fix and true after, and it cannot be faked by a
   brighter texture — which is exactly the confusion the profile ran into when
   the peak moved 39.1 → 44.0.
2. **Profile the DOOR, not the wall.** A vertical profile down the door reads
   the pool falling off toward its base; the door is 1.02 m and pools fully.

`scripts/wallpool.mjs` runs all of the above in one go — your profile, the door,
and the span arithmetic side by side — so the next person does not have to
re-derive which surface answers which question.

## What I have not claimed

I have **not** shown that the fitting lights the wall, because it does not and
cannot. If the row's bar is *"the brick around the fitting must fall off"*, then
this is still open and the work is splitting that wall, which is not my file and
is a much larger change than the door needed. **Say which bar you are holding it
to and I will either accept it or take that job**, but I do not think the user
was asking for lit brick — he was asking why the door was black.
