# Handoff — builder E · the church inlaid, and one shared stair

Commit `e13e398` on `feat/civic`, `ct/civic.ts` only. `ownership.sh E` clean.
Shots: `shots/E-church/` (16). Walks: `scripts/E-yard-walk.mjs`.

---

## What landed

**The church is set back 2.6 m and the notch is a churchyard.** The elevation
is untouched — the ask was *"the church facade is good i just want it to have
depth"*, so the only change to the church itself is two numbers: `zc` and
`zFront`. Everything downstream (nave, gable, roof, buttresses, tower, spire,
noticeboard) is positioned off those, so the whole thing moved together.

**One flight builder, used twice**, as the queue asked. It works in *approach*
coordinates — `u` into the building, `v` across it — because the library
approaches along x and the church along z, since street.ts turns the church a
quarter turn. Nested treads, cheek walls, and a ramp for the picker. The
library's flight is now built by it too, and its 18 walk checks still pass
unchanged.

**The church climbs 0.41 m, and that number is not a choice.** The doorway is
*painted* with its sill 0.55 m above the church's base and its own three steps
below that. The real flight lands exactly where the painted one says the
threshold is. If anyone ever changes one, they have to change the other — it
is the same class of coupling as the buttresses and the lancets, and the same
answer: derive both from one number.

**A churchyard, not a second plaza.** Irregular flags on a broken bond in a
cooler stone, mossy joints, worn where everyone walks; a dwarf wall with iron
railings along the street line, a gate between two piers; yews in the corners.
The library's forecourt is 16 m of open mouth — you are invited to sit in the
middle of it. This is a 2.6 m gate with wall either side, and you cross it.

The wall was 0.92 m of solid stone in the first cut and hid the flight
completely from the pavement. You cannot ask for stairs and then build a
parapet in front of them: it is 0.62 m of stone with 0.72 m of railing now.

## The transform problem, and how it is handled

`street.ts` builds the church into a **Group and turns it after we return**.
So inside `ct/civic.ts` no world-space number can be computed at build time —
the matrix does not exist yet. Colliders and floor patches are therefore
registered in the host's own frame and converted once, lazily, on the first
floor query. AABBs start parked at 9e5 the way `ct/apartment.ts` parks a cap
that is not live yet, so nothing is ever briefly wrong in the middle of the
street. An axis-aligned quarter turn maps a box to a box, so nothing is lost.

This is worth knowing generally: **anything in `ct/civic.ts` that needs world
coordinates has to go through `solidLocal` / `floorLocal`,** not through raw
numbers, or it will be correct for the library and wrong for the church.

## Two patches, both in files I do not own

Until BOTH land, the church is solid exactly as it was — the yard is visible
but not enterable, and nothing is worse than before.

| patch | file | what it does |
|---|---|---|
| `notes/E-steps-crosstown.patch` | `crosstown.ts` | asks `courtGround(x, z)` for the floor, and sets `COURT.climbable`. Serves the library steps AND the churchyard. |
| `notes/E-church-street.patch` | `ct/street.ts` (D) | drops D's blanket church footprint, which seals the yard exactly as the blanket wall sealed the library courtyard. `ct/civic.ts` registers the real one. |

Both were applied locally to verify and then reverted; the commit is my file
alone. `scripts/E-yard-walk.mjs` detects which state the world is in and names
the missing patch rather than reporting failures.

## For builder B — a streetlamp stands in the church gate

`ct/props.ts`. The lamp at **x 5.55, z −79.0** blocks x 4.99…6.11 across
z −79.56…−78.44. The gate is on the door axis at z = −79.5, and the piers
leave z −80.44…−78.56 clear once the player's radius is allowed for — so the
lamp eats more than half the opening and **you cannot walk in on the axis at
all**. What is left is an 0.88 m slot at z −80.44…−79.56.

The gate cannot move: it is on the doors. Suggest the lamp goes to **z ≈ −73**
or **z ≈ −86**, either of which keeps the staggered ~14 m spacing and clears
both the gate and the tower buttress. Second one of these this session — the
payphone was the same shape of problem in front of the library doors.

## Notes

- `partyTex` is now shared and parameterised: the church setback exposes
  PAWN's and the bodega's flanks exactly as the library's exposed BURGER
  BARN's. Church panels are 13.0 m, which clears the shorter neighbour (the
  bodega, 3 floors, 14.8 m).
- No `rnd()` draws added anywhere — the seeded stream is untouched (§2).
- Sweep clean, world initialises, tsc clean.

## Where the park stands, and the one question I cannot answer

Next in the queue is **"the park should be DEEPER"**. Two things about it that
the desk needs before I can do it:

1. **The depth is not mine.** D built the park SITE in `ct/street.ts` —
   `placePark`, `DEPTH = 7.0`, the ground, the flanks, the rear elevation, and
   it publishes `park: PARK` extents. `ct/park.ts` does not exist yet; what
   stands IN the park is mine. Making it deeper means changing D's constant.
2. **The player is clamped at x = −13.4.** `crosstown.ts` sets
   `bounds: { minX: -FACE - 6.4 }`, a hard clamp in the rig. The park's back
   wall is already at x = −14.0, so you can only reach 6.4 m of the 7 m that
   is there and you stop 0.6 m short of the rear elevation. **Any deeper park
   is literally unreachable until that bound moves**, and it is in the entry
   point, so it is a desk change.

So "how far back can it go" resolves to: as far back as the desk moves
`bounds.minX`. My recommendation is **14 m** — with a 30 m frontage that gives
a 30 × 14 interior, which is the first space in this world you could genuinely
lose the street in, and it is what "somewhere you cannot see from the
sidewalk" needs. That wants `bounds.minX = −22` or so, D's `DEPTH = 14`, and
the rear elevation and flanks moved back with it.

I can build `ct/park.ts` against whatever `PARK` extents D publishes rather
than hardcoding any of it — tell me the number and it will not need to be
touched again.
