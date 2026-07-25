# BLOCKED — builder E

Four things, in the order they cost the user something.

---

## 0. TWO FINISHED USER REQUESTS ARE STILL NOT IN THE WORLD

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

`scripts/E-walk.mjs` and `scripts/E-yard-walk.mjs` both detect which state the
world is in and name the missing patch, so applying them and re-running is the
whole verification.

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

## 1b. (historical) The park could not be deepened from my file

Queue item: **"Rebuild it 4–5× deeper as a real park."** The frontage half is
done and live — railings, gate, piers — and from the pavement it now reads as
a fence you can see through. The wall the user photographed is the REAR
elevation, 13 m tall and 7 m away, and only depth moves it.

I cannot do it and neither can D alone:

| who | what | current |
|---|---|---|
| **the desk** | `bounds.minX` in `crosstown.ts` — a hard clamp in `FPRig`, not a collider | `-FACE - 6.4` = **−13.4** |
| **builder D** | `depth` in `placePark` (`ct/street.ts`), and the flanks and rear elevation that move with it | `7.0` |
| **the desk** | the number itself | — |

**The clamp is the part that is not obvious.** The park's back wall already
stands at x = −14.0 and the player stops at −13.4, so of the 7 m built, 6.4
is reachable and you cannot get to the wall. **Deepening the site alone builds
a park you can see and not enter.** Both numbers have to move together.

For 4–5× (the ask): depth **28–35 m**, which wants `bounds.minX` around
**−36**. At that size everything I have built scales without being touched —
the field, the loop, the benches and the hedge are all measured off the site
extents and the reachable line, deliberately.

One thing to decide with it: at 30 m deep the rear elevation is 30 m from the
gate and fog does most of the closing, so it may want to become something
other than a blank party wall — the back of another block, or a row of trees.
That is D's and B's, not mine.

## 2. Trees, which the item asks for and I must not build

*"trees around the edge and along the path"* — `ct/props.ts` is builder B's,
and the seeded `rnd()` order is load-bearing (§2), so I have not reached in.
The park needs two kinds:

- **along the loop's street leg and its two ends**, framing the open middle —
  the item's own description. Positions: x ≈ −8.9 (inside the street leg) at
  z = −93, −87, −79, −73; and the corners.
- **along the back**, which is the only thing that will really break up the
  rear elevation until the park is deepened. x ≈ −13.6, every ~4 m.

I have left those lines clear of my colliders and put a low hedge along the
back in the meantime.

## 3. The pavement past the park is impassable (§9)

Not mine, and not the park's to fix, but it is a sacred-lane violation and it
is live right now:

- D's park boundary blocks out to **x = −6.28**
- B's street tree at **z = −71.5** owns x −5.94…−5.78, blocking **−6.30…−5.42**
- the walk surface itself ends around **x = −5.36**

There is no lane left between them. Walking south you stop dead at z ≈ −71 in
BOTH the building-side and kerb-side lanes; with one foot in the road you get
to z ≈ −92.4 before something else stops you. `scripts/E-park-walk.mjs`
reports all three as NOTE lines.

Either the tree moves off z = −71.5, or the park boundary gives back the
0.3 m it took.

---

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

_Written 2026-07-24 by builder E. Delete when the depth is settled._
