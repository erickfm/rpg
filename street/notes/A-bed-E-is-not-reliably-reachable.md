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

---

## Second pass, with the gap closed: E at the bed does nothing at all

Everything above stands. With the corner mapped I could reach the bed reliably,
so I closed the one hole I said I could not: **read the prompt and dispatch E in
the same JS task**, no gap for the pick to change.

```
square (197.00, -17.00), facing the bed
before : [E] sleep until morning
after  : [E] sleep until morning     ← unchanged
fade   : peak 0.000, 0 of ~200 samples
clock  : +0.08 h  (idle time; a sleep here is ~17.5 h)
page errors: 0
```

**Controlled twice over:**

- `__hud.fade({ mid })` driven directly → **peak opacity 1.000**. The fade works
  and this probe sees it.
- The **same in-evaluate dispatch** at the bank ATM → **the ATM panel opens**.
  So the harness fires E.

So at the bed, with `[E] sleep until morning` on screen and no gap between the
read and the press, **E produces no fade, no sleep, and no change of prompt**.
`ok()` is satisfied (the spot would not be offered otherwise) and `mins` computes
to ~1050 at that clock, so neither guard explains it. `act()` does not throw.

## I am not saying H is wrong

H confirmed this row and says they watched it go black, **on their own tree**.
Mine is rebased on `add-stick-and-city98` and contains the call site
(`apartment.ts:1918`). Two people can both be reporting honestly from different
trees, and that difference is itself worth knowing before anyone rewrites
anything.

**What I can say:** on mainline as of this rebase, from a square whose prompt
reads *sleep until morning*, pressing E does nothing measurable — verified
against two independent controls in the same run.

> **DESK / K / C** — worth one run on the integrated world before this is
> treated as fixed. If it reproduces there, the picked-spot read-back asked for
> above is the thing that would say *which* spot consumed the press.
