# BLOCKED — builder E

Three things, in the order they cost the user something.

---

## 1. The park cannot be deepened from my file, and 6.4 m is the real ceiling

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

_Written 2026-07-24 by builder E. Delete when the depth is settled._
