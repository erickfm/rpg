# BLOCKED — builder E

Five things, in the order they cost the user something. **My queue has nothing
left I can take**: every item in it is either done and waiting on one of the
patches below, or owned by B, D, G or the desk.

---

## 0. THREE FINISHED USER REQUESTS ARE STILL NOT IN THE WORLD

Both are built, walk-tested and committed, and neither is live, because each
needs one change in a file I do not own. The park's wiring landed in 2c1ccf60
and the park appeared; these two are the same shape of thing and have not.

**`notes/E-steps-crosstown.patch`** — 3 hunks in `crosstown.ts`. Until it
lands, *"i want to be able to walk up the stairs of the library"* is not done:
the flight is still one solid block, because `groundY` still reads
`COURT.y` (a flat number) instead of asking `courtGround(x, z)`. It also
carries `COURT.climbable`, which is what tells `ct/civic.ts` it is safe to
open the treads — so the world is currently correct, just not climbable. The
SAME patch serves the church steps.

**`notes/E-church-street.patch`** — 1 hunk in `ct/street.ts` (D). Drops the
blanket church footprint, which seals the churchyard exactly as the blanket
wall sealed the library courtyard. `ct/civic.ts` registers the real footprint
already.

**`notes/E-seats-crosstown.patch`** — 1 line in `crosstown.ts`. Until it lands,
*"i cant sit on the benches in the library courtyard"* is not done. The two
benches are registered and tested; nothing calls `civicSeats()`.

`scripts/E-walk.mjs` and `scripts/E-yard-walk.mjs` both detect which state the
world is in and name the missing patch, so applying them and re-running is the
whole verification. For the seats, F's `scripts/seats-walk.mjs` covers them
the moment they are registered.

---

## 1. THE DEPTH LANDED WITHOUT THE CLAMP — 25 m of park is unreachable

**Updated.** D's `depth` is **32.0** now. `bounds.minX` in `crosstown.ts` is
still `-FACE - 6.4` = **−13.4**. Walked and confirmed: you enter the park,
walk west, and stop dead at x = −13.40 with 25 m of it in front of you.

This is exactly the case this file warned about before the depth landed —
*"deepening the site alone builds a park you can see and not enter"* — and it
is now live. **One line, and it is the entry point's.** For the full 32 m:

```ts
bounds: { minX: -FACE - 33, … }     // -40, clearing the rear wall at -39
```

I have laid the park out at its TRUE size rather than at the clamp, because
built to the clamp it was a 6 m strip of path in front of 25 m of bare grass
inside 13 m walls, which is what the gate looked into. Every metre becomes
walkable the moment the bound moves and nothing in `ct/park.ts` needs
changing. Until then `scripts/E-park-walk.mjs` reports the loop's back leg as
a NOTE rather than pretending it passes.

## 2a. LAMPS — for builder B, exact coordinates, nothing to guess

The park has **zero light sources**. At night it is black, and everything in
it — the trees, the memorial, the benches, the loop — is invisible. This is
the biggest thing left in it and lamps are `ct/props.ts`, so they are B's.

**The park has been re-cut twice, so these are measured off the CURRENT
geometry** (`ct/park.ts`, site x −39…−7, z −98…−68; loop legs street x −8.60,
back x −35.80, ends z −96.30 and z −69.70; path 1.5 m wide).

All of them stand on the FIELD side of the path so the pool falls across it,
0.45 m off the path edge. Nothing of mine is at these points — the benches are
on the street side at x −7.43, the framing trees at x −10.95.

| where | x | z |
|---|---|---|
| street leg | **−9.80** | −93.0, −86.0, −79.0, −72.0 |
| back leg | **−34.60** | −93.0, −86.0, −79.0, −72.0 |
| south end leg | −33.0, −26.0, −19.0, −12.0 | **−95.10** |
| north end leg | −33.0, −26.0, −19.0, −12.0 | **−68.50** |
| at the gate, inside the piers | −7.90 | −83.0 |
| over the memorial | −12.00 | −73.20 |

Warm, on the same night curve as the street's, pooling the same way, and
registered with `lit()` so the park's own furniture takes the light. Post
height can be shorter than the street's bishop-crooks — a park lamp is a
column, not a crook — but that is B's call.

If B would rather I placed plain posts in `ct/park.ts` for him to adopt into
the night registry, say so and they will be there in one commit.

## 2. ~~Trees~~ — DONE, in ct/park.ts

Resolved by building them rather than waiting. The auditor's *"bare lawn,
three blank brick walls"* is a wall problem, and only a canopy standing in
front of a wall breaks it. There is a run along all three boundaries every
~6 m plus a line framing the field, built as crossed alpha panels that do not
turn — B still owns the STREET trees, the billboard cutouts; a park tree is
walked under and seen from every side, so it could not be one of those.

## 3. ~~The pavement past the park is impassable~~ — RESOLVED

Left here deliberately for one revision so nobody re-files it. B's street tree
at z = -71.5 used to close the walk against D's park boundary with no lane in
between; walking south you stopped dead at z ≈ -71 in both lanes. It walks the
full 30 m now — `scripts/E-park-walk.mjs` drives the capsule end to end and it
gets from z = -66 to past -98. Nothing owed.

## 4. My `## Next` items now belong to builder G

The queue still lists **GOLDEN ACES roof sign floats** and **HOTEL ORPHEUS /
GOLDEN ACES facades want more detail**. Both are now `ct/vice.ts`, which
`notes/OWNERSHIP.md` gives to **G** ("casino + hotel exteriors, split out of
street.ts"). I have not touched them.

The sign diagnosis, if it is useful to whoever takes it: the board is 9.2 m
wide in z on a building only 3.4 m deep, so its legs at z = −91.8 and −98.2
land outside the roof they are supposed to stand on. It cannot be fixed by
moving the legs — the board has to narrow to the roof, or gain a deck.

With those reassigned and the depth blocked, **my queue has nothing I can
take**. Shots for everything above are in `shots/E-park/`, `shots/E-court/`
and `shots/E-church/`.

_Builder E. Rewritten 2026-07-25 — items 0, 1, 2a and 2 are live asks; 3 is
resolved and kept for one revision so it does not get re-filed._
