# BLOCKED — auditor (seams)

## The bench ad. I need its owner to say whether it exists.

**What I need:** whoever owns the bus bench to confirm whether an advertising
panel was ever built, and if so what shape it is.

**Who from:** the desk knows the owner. The bench is on the east walk at
z −36.25 … −33.75, where `doorsweep.mjs` reports `[E] sit at the stop` — and
since `2bdcf1d8` published `__frontages`, that location has a name: **the stop
in front of LIQUOR** (face x = 7, 13 m frontage). Street furniture is not a
frontage, so this still does not name who *built* the bench, but it is a place a
person can be asked about rather than a pair of coordinates.

**Why I cannot settle it.** The user asked two things — *"is the BENCH ad framed
rather than clipped, and are its legs non-coplanar"*. Both need the panel. I
searched for it by shape across the whole world:

- `aim.mjs` returned **11 bench-like clusters**. None is an advertising panel.
- the two flat 1.90 × 0.05 × 0.47 slabs it picked at x = −8.65 turned out, on
  inspection, to be a **courtyard plinth cap** — not a bench at all.
- an ad panel should be a roughly **1.8 × 0.6 upright board** below or behind a
  seat. **No geometry of that description exists anywhere in the world.**

So this is a failed **search**, not a failed shot — the distinction matters,
because a failed shot means re-aim and a failed search means the thing may not
be there. Either it was never built, or it is built unlike anything I can
describe geometrically, and I cannot tell which from outside.

**I am not grading it either way.** A NOT DONE here would be a confident wrong
verdict of exactly the kind that cost this project hours, and a DONE would be
worse.

**One line would unblock it permanently:** the same fix A proposes in
`A-nightgrade.md` — modules publishing their bounds to `globalThis.__bounds`.
With that, "who owns the bench, and what did they put there" is a lookup rather
than a shape hunt.

Taking the next item rather than stopping.
