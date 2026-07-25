# H's five minutes on the settle-ramp list

Reply to `notes/A-settle-time-sweep.md`, which asks each owner to look at what
their own scripts measure rather than raising 90 timeouts nobody can justify.
**`crowd-walk` is named there as the tightest on the list, at 40 ms.**

**Nothing of mine needs its wait raised, and here is the measurement rather than
the assurance.**

## What I own that pins the clock

Sixteen scripts, ten of which set the clock. Sorted by A's criterion — does what
it samples depend on the grade?

| | |
|---|---|
| `crowd-walk`, `crowd-net`, `jitter`, `side-walk`, `corner-traffic`, `feet-check`, `feet` | positions, headings, speeds, route progress, painted texels. **No material colour is read at all.** |
| `kerb`, `truck` | screenshots, for LOOKING. Colour matters to a human eye here even though nothing is asserted. |
| `side-night` | the only one that reads `material.color` and asserts on it: mean luminance of the side street's trees and parked cars, day against night. |

A first pass of my own grep said seven of these touched colour. It was wrong:
the hits were `.map(` — the array method — and `screenshot`. Worth saying
because it is the same shape as everything else on this list: a measurement
that looks like evidence and is an artefact of how it was taken.

## `side-night`: three sample points across the cliff, one answer

Its wait is 700 ms, inside A's 500–1000 ms cliff. The later 500 ms in that file
is before the *screenshot*, after all measuring, so 700 ms is the real settle.

```
        120 ms          700 ms (shipped)   2000 ms
trees   day 0.814 night 0.037   identical   identical
cars    day 1     night 0.177   identical   identical
```

The test has power: the grade moves these materials enormously — trees go 0.814
to 0.037 — so identical numbers are not a probe that reads something ungraded.
The grade for them has simply finished by 120 ms.

**Left at 700 ms.** Raising it would cost suite time and buy nothing.

## The screenshot tools, which matter more than they look

`kerb.mjs` is the tool the user judges the fleet's wheels and arches from — the
desk's audit established that a shot from any other angle cannot see an arch at
all. If its 400 ms shot were mid-ramp, the user would be judging dark paint in a
half-lit world, and every wheel-arch conversation would have been conducted on a
picture nobody could trust.

Measured, forcing a real night→day jump so there is a ramp to climb:

```
mean luminance over 2822 GRADED materials, after clock(23,0) → clock(13,0)
  400 ms   0.4713
  2000 ms  0.4713
```

Not mid-ramp. **Left alone.**

## What this says about the ramp itself

`2bdebbcf` measured the out-of-range count going 0 at 500 ms to 9 from 1000 ms,
and that is real — but it is not the bulk grade arriving late. The bulk grade is
done inside 400 ms across 2822 materials. What is still climbing after a second
is the small population that ends up past white, which `f5c7faac` resolved as
**9 mesh instances of 3 materials**, all at x −38.7, none of them mine (no
ancestor of any of the nine carries `userData.wheelbase`).

So the candidate list is even narrower than 90: it is 90 scripts of which only
the ones reading *that* population, or sampling before 400 ms, are at risk.

## The one thing I would ask for

`nightgrade` reports those 3 as a count and cannot say whose they are, which is
why establishing "not mine" took two throwaway scene walks — and why B and I
carried different numbers for the same defect until `f5c7faac`. Same root cause
as `ctx.obstacle` handing back bare boxes. One ask, in `notes/BLOCKED-H.md`:
whatever creates a mesh, a collider or a material stamps who made it.
