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

## 2a. LAMPS — the park has none, and at night it is a void

`shots/user-parkbad.png` is the park at night in rain: a black rectangle
inside brick. **There is not one lamp in it.** Everything else I have added is
invisible after dark, so this is the single biggest thing left, and lamps are
`ct/props.ts` — B's, and the night registry (`lit()`, the lamp-head list) is
his too, so I have not reached in.

What the park wants, and it is worth doing properly because a lit path through
a dark park is one of the best images this world could have:

- a run along the LOOP, not the frontage: on the field side of the path so the
  pools fall across it. x ≈ **-9.6** (street leg) and **-34.8** (back leg),
  z every ~9 m: **-93, -84, -75** on each, plus one at each end turn.
- one at the **gate**, inside the piers, at x ≈ -7.9, z = -83.
- and one over the **memorial** at (-12.8, -73.9), because that is the thing
  the loop is for.

Warm, on the same night curve as the street's, pooling the same way. If B
would rather I placed plain posts in `ct/park.ts` and he adopted them into the
registry, say so and I will.

## 2. Trees, which the item asks for and I must not build

*"trees around the edge and along the path"* — `ct/props.ts` is builder B's,
and the seeded `rnd()` order is load-bearing (§2), so I have not reached in.
The park needs two kinds:

- **along the loop's street leg and its two ends**, framing the open middle —
  the item's own description. Positions: x ≈ −8.9 (inside the street leg) at
  z = −93, −87, −79, −73; and the corners.
- **along the back**, x ≈ **-37.5**, every ~4 m — with the site now 32 m deep
  the back wall is the far edge, and trees there are what stop it reading as
  a yard wall.
- **inside the loop's street leg**, x ≈ **-10.2**, every ~7 m, framing the
  open middle the way the item describes.

I have put ivy up all three walls in the meantime, which is the half of
"screen the walls" that is mine, but ivy on brick is not a tree line.

I have left those lines clear of my colliders and put a low hedge along the
back in the meantime.

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
