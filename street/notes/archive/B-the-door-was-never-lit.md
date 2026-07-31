# The alley back door: the glow was paint, and a fitting now casts by default

*"lighting on this alley back door looks messed up like it gets cropped by
door."* Ref `shots/user-alley-door-light-crop.png`.

## The crop settles it, and it is not what the row's history says

A warm dome of light on the brick above the door, feathering onto the courses
either side — and the door directly under it **dead black**, with the glow
stopping at its top edge. "Cropped by door" is literally accurate.

Two different things would look exactly like that, and they want different
fixes:

- **A.** nothing is casting and the glow is painted in — the auditor's reading
- **B.** something is casting and the door cannot receive — my own per-mesh
  diagnosis, which is what the desk asked me to fix at the root

## Measured at the door, before changing anything

`scripts/alleydoor.mjs`. The door is at **(19.40, 1.06, −55.45)**. Directly
above it, at y 2.15, sits a **1.5 × 1.5 m self-lit quad held at tint 1.0**.

That quad *is* the dome. It is a **decal**. Nothing near that door is a
registered lamp, so `updateLit` hands out nothing and everything around it sits
at the night floor.

**So it is A, and I should correct my own earlier diagnosis on this row.** The
per-mesh cutoff is real — a wall built as two meshes had one half pooling and
the other not, and I fixed that separately with the span taper. But it is not
what this door was suffering from. **The glow did not stop at the door because
the door rejected it. It stopped because it was never light, only paint.**

## Why I did not just wait for D

The row records the blocker as *"one line outstanding in D's file"*, and that is
still true — `scene.userData.addLamp` has **one definition and zero callers**. I
published it precisely so other modules could declare a light, and nobody has.

That is the desk's point, and it is the right one: **receive by default, or a
prop is born broken and stays broken until somebody remembers a call.**

## The fix

A small self-lit mesh **is** a lamp, registered in `dimWorld`. A fitting that
declares itself a light now casts one without being asked.

**It gets a doorway pool, not a street lamp's.** `FITTING_R` 2.6 against
`LAMP_R` 7.0. A bulkhead over a back door is a 60 W fitting; giving thirty-seven
of them seven metres of reach is exactly how *"light the door"* becomes *"light
the alley"*, which the desk ruled out in as many words and the user has asked
four separate times to avoid. `lampHeads` carries an optional per-head radius
now, and every existing push is unchanged.

**Size-bounded, and that is the safety.** A lit window is a sheet metres across
and must never become a source.

## The census, and both halves of the result

`scripts/lampcensus.mjs`, whole world at 22:30, re-runnable at any bound:

```
  37  qualify as sources      lot 20 · vice 9 · walkup 6 · street 1 · props 1
  76  self-lit sheets excluded as too big to be a fitting
  11  excluded, outside the 0.5–6 m height band
```

I did not ship this blind. *"Do not brighten the alley"* is as much the
instruction as *"light the door"*, so both were measured:

```
  the door                     0.0079  ->  0.0787     10x
  world mean, 3308 graded       0.26209 -> 0.26233    +0.09%
  the alley frame               0.0988  -> 0.0980     fractionally DARKER
```

At 0.9 m the bound takes 30 meshes and misses this door; at 1.6 m it takes 37
and catches it; past 1.6 m nothing further arrives until windows would. So the
bound is chosen at a flat spot in the distribution, not tuned to the answer.

## Where to stand

**(19.4, −53.4) facing −z at 22:30** — the user's own frame.
`shots/dl-door.png` against `shots/user-alley-door-light-crop.png`: same hood,
same dome, same pipe bottom-left, and the door under it is warm and falls off
toward its base instead of being dead black. The brick beyond stays dark.

If the door is black, this regressed. If the alley behind it is lit, it
overshot.

## For D

**Your line is no longer needed for this door**, and I have still not touched
your file. `addLamp` stays published and is still the right call for a light
that is *geometry* rather than a self-lit sheet — a bulb you model rather than
paint. But you no longer have to remember it for a fitting that draws its own
glow.
