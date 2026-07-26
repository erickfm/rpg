# The bed corner is crowded, not random — I overstated it, and here is the map

**This note previously claimed the pick around the bed decides differently
between page loads. I measured it properly and that is largely wrong.**
`scripts/A-bed-corner-pick.mjs`, 48 squares facing the bed, three fresh loads:

```
load 1: DOOR 14  ·  BED 30  ·  TV 4
load 2: DOOR 14  ·  BED 30  ·  TV 4
load 3: DOOR 14  ·  BED 31  ·  TV 3

squares that answered DIFFERENTLY between loads: 1 of 48
    (0.8, 1.2)   TV → TV → BED
```

**One square in forty-eight.** The pick is essentially deterministic.

## What my contradictory readings actually were

Both mine, and neither is a fault in anyone's module:

- **yaw.** `(197.05, −17.20)` at yaw 0 offers the door; at yaw 180 it offers the
  bed. I compared the two and called it instability. Facing is an input to the
  pick — that is the whole point of `lookTolerance` — so two facings giving two
  answers is the feature working.
- **settle time.** Reading 90 ms after a warp caught the pick before it settled;
  500 ms later it had. The map above waits **240 ms** and is stable. A
  measurement taken before the thing has finished moving is not a measurement.

I filed "same code, same square, different answer" on the strength of those two.
It was the fourth time today my instrument was the first thing that should have
been suspected, and the first time I published the claim before checking.

## What IS true, and it is worth the desk's attention

**14 of 48 squares within 1.2 m of the bed, facing the bed, offer the DOOR.**
Not a coin flip — a crowded corner, and reliably so. Three spots live within a
metre: the bed, C's TV seat, and 301's flat door.

That is still the shape of the user's own words — *"how do i stop watching the
tv"*, *"pressing e doesnt get me out of it"* — but it is a **layout** problem
with a stable, learnable answer, not a race. That makes it much easier to act
on and much less alarming than what I first wrote.

## The one thing I could not settle

Once, with `[E] sleep until morning` on screen, pressing E left the door closed.
I read the prompt and pressed a moment later, so the pick may simply have been
the door by then. **Proving prompt and dispatch agree needs the picked spot
sampled in the same frame as the press**, and `__ct` publishes the label but not
the object. That remains a real gap — one read-back would turn "the thing on
screen is the thing that fires" into a one-line assertion anyone could run.
