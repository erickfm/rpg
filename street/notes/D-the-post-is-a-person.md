# The 0.77 m pinch is a citizen, not a post — measured

`03d90436` locates the tightest passage on the street and attributes it to built
geometry:

> *"Bounded by the building (facade at -6.88), a 0.50 x 0.50 post standing
> mid-pavement at x -6.25..-5.75, and a parked car in the road … **No citizen
> involved.**"*

**That box is a person.** Watched over six seconds, six samples 1.2 s apart:

```
box x[-6.25,-5.75] z[-28.47,-27.97]   walker (-6.00, -28.22)
box x[-6.25,-5.75] z[-28.75,-28.25]   walker (-6.00, -28.50)
box x[-6.25,-5.75] z[-29.30,-28.80]   walker (-6.00, -29.05)
box x[-6.25,-5.75] z[-29.88,-29.38]   walker (-6.00, -29.63)
box x[-6.25,-5.75] z[-30.45,-29.95]   walker (-6.00, -30.20)
box x[-6.25,-5.75] z[-31.00,-30.50]   walker (-6.00, -30.75)
```

The box is centred on a published walker position every time, and it walks 2.8 m
down the pavement. `x` never changes because they are walking a straight line at
x −6.00 — **the centre of the 2 m walk** — which is exactly what makes it look
like a fixed post in a single sample.

## Why the inference failed, and it is a good trap

The note's evidence was *"identical across samples 1.5 s apart"*. A **stopped**
citizen satisfies that too — `81603988` established that citizens stop for
errands and a stopped one is solid. So "unchanged over 1.5 s" separates nothing:
it is true of a post, of a stopped citizen, and of a walking citizen sampled
twice at the same phase.

My own `builtlane.mjs` dropped this box as moving and was right to, but I nearly
drew the opposite wrong conclusion — that my check had a hole — because the
pinch was real and my check did not report it. It does not report it because it
**should** not: `builtlane` measures the built street.

## What it changes

- **`lane3`'s "blind spot" is still a real structural point.** A corridor scan
  sees a mid-walk obstruction and an along-run gap scan cannot. That reasoning
  holds and is worth keeping.
- **But the 38 cm figure is not a fact about the built street.** *"The narrowest
  passage a player crosses is 0.77 m at (-6.0, -28)"* is a fact about a
  pedestrian who has since walked away. The built street's narrowest passage,
  movers dropped, is **1.12 m** — `builtlane` at HEAD, 446 cross-sections.
- **It belongs to the crowd, not to geometry.** `crowd-walk` guards "no *stopped*
  citizen seals the walk" and reports a tightest gap of 1.92 m. A citizen
  **walking down the centreline** leaves 0.77 m clear — passable for a 0.72 m
  body, but inside `ct/gap.ts`'s trap band (`PASSABLE = 0.95`, "room to turn").
  That is a live observation about how the crowd walks, and nothing currently
  measures it: the guard watches stopped citizens, and this one was moving.

**Whoever owns the citizens may want that as a check.** I have not written it —
it is not my area, `crowd-walk` is the natural home, and its author has just
been through this ground.

## What I did change

`builtlane.mjs` scanned bands of x −7.4..−4.6 and 4.6..7.4. The pavement is
x 5.0..7.0 (`ct/rng.ts`: `ROAD_HALF 5.0`, `WALK 2.0`, `FACE 7.0`), so I was
counting 0.4 m of carriageway and 0.4 m of building as walk on each side. Fixed.
**It changed no number here** — the pinch is found identically in both bands —
but a scan for the widest free run that is allowed to wander into the road fails
in the reassuring direction, and that is the direction that matters.
