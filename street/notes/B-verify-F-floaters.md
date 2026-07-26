# Verifying F: "decorations floating in the air in the diner"

Queue empty, so I took a verifier round on F's unchecked rows — F is idle and
nobody was on them. This is the first.

## Why this row was worth doing properly rather than glancing at

F's evidence is one line: *"`floaters-walk`: ZERO in the diner."*

**A's own ledger row says `floaters-walk.mjs` ignored its room argument** — *"a
filter that silently does not filter"* — so a run asking about the diner swept
the whole world instead. That makes "ZERO in the diner" a measurement of
wherever the script happened to look, filed under the diner's name.

The conclusion turns out to be right. The evidence for it was not, and those are
different things. A row that is green for the wrong reason is a row nobody
re-checks when the thing under it moves.

## What I measured

`scripts/B-verify-floaters.mjs`, importing nothing of F's or A's. Predicate
written into the file **before** running it, so it could not be tuned to the
answer: a mesh clear of the floor by more than 0.12 m with nothing beneath it
holding it up; wall-mounted and ceiling-hung things excluded **and counted out
loud** rather than quietly dropped.

The diner is found by its own declared dimensions — `d: 7.0`, `w: 12` in
`ct/int-diner.ts` — not by a coordinate I remembered. It resolves to (760, 0).

```
  diner, 10.8 x 7.0 m, floor y 0.005, ceiling y 3.00, 96 meshes
    excluded: 14 wall-mounted, 13 ceiling-hung, 19 decals
    FLOATERS: 1
      7.80 x 0.05 x 0.06 m at y 0.93  —  the counter's edge trim
```

One candidate, and it is not a decoration: a thin bar the full length of the
counter, standing proud of the counter it is fixed to.

## And I stood in the room

Three stations, because a number is not a picture: mid-floor facing the door,
at the counter facing the back bar, and **looking up** at the ceiling and upper
walls, which is where a floating decoration would be.

`shots/B-verify-F/diner-mid.png`, `-back.png`, `-up.png`.

Every booth, table and stool meets the floor. The clock is on the wall, the menu
board is over the back bar, the lights are flush to the ceiling. **Nothing hangs
in mid-air.** Confirmed.

## What I am NOT claiming, said plainly

**The hotel half.** F says four at x 834.84; my sweep finds six candidates
around x 834–846, of which five are 0.8 × 0.24 × 0.8 m boxes at y 2.40 spaced
every 5.2 m — light fittings my ceiling test missed in that room. Different
predicates, different sets. The honest statement is that the counts are not
comparable, not that a number is wrong. It is G's and already routed there.

**A world-wide count.** My first predicate said **326 floaters**. That was my
filter, not the world: it swept in every pendant light and every zero-thickness
decal. Tightened, it says 165, and I do not believe that either.

The auditor has already recorded what this failure costs — five generic filters,
five wrong sets, **zero real faults** — and I have made the same mistake twice
today, once with a bounding box and once with a broken affordance. So the
instrument answers **the one room that was asked about** and I am claiming
nothing past it. If someone wants the world-wide number, it needs a per-room
support model, not a better threshold.

---

# Verifying F, second row: "what is this in the corner of the bodega"

The coffee station. F's own test, quoted in `ct/int-bodega.ts` and it is the
right one: **"stand at the door and name it in one second."**

## The room, found rather than remembered

`ct/int-bodega.ts` calls its ceiling *"the lowest in the world"* at 2.6 m. The
lowest-ceilinged room in the world measures **2.60**, at centre x 440
(x 435.4…444.6, z −6.5…7.3). That is the bodega, identified from what the source
declares about it rather than from a coordinate I carried in.

## The move is the fix, so the door is the only station that tests it

F's fix was two things, and F says plainly which one mattered: *"No amount of
detail fixes a thing you cannot see"* — two of three urns were behind a gondola
run. So detail is not what needed verifying; **occlusion** is.

`shots/B-verify-F/bodega-door-quarter.png` — the bench and all three urns stand
clear of the shelving, the first thing on your left as you come in, nothing in
front of them. A shot taken from beside the object would have confirmed the
detail and missed the point entirely.

`shots/B-verify-F/bodega-door-left.png` — close in, the urns carry domed pale
lids, dark bodies, taps, and a pale drip tray under them. **I would name it in
one second.** Confirmed.

## Two carve-outs, and they are refinements rather than objections

**The counter's panelled front does not read on the approach.** The row claims
*"a top, an edge and a panelled front"*. From both door stations the bench is a
flat brown face — the top edge reads, the panel does not. That matters a little
more than it sounds, because "a large plain brown slab" was the other half of
what the user was objecting to in the first place.

**I did not see the COFFEE .65 card from either door station.**
`ct/int-bodega.ts:541` places it at `CF_X + 0.02` with a `Math.PI / 2` yaw,
which looks like it faces across the aisle rather than toward the way in. **I am
reporting where I stood and what I saw, not diagnosing the yaw** — I have not
measured it, and I have published a wrong mechanism from a plausible reading
before today. A price card is most of what names a coffee station at range, so
it is worth one check by someone who owns the file.

## Where to stand

**(440, 5.9), then turn left.** That is the whole test, and it is the walk a
customer actually makes.
