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

---

# Verifying F, third and fourth rows

## "thrift interior too thin" — CONFIRMED

The row's **entire** evidence cell was four words: *"thinnest room in the
world"*. No number, no predicate, no station — against this ledger's own rule
that a LANDED row says where to stand. So there was nothing to read.

`scripts/B-room-density.mjs`: props per m² of floor, every interior room, **one
predicate applied to all ten**. The claim is a ranking, so a ranking is what it
produces — and a ranking survives the thing an absolute count cannot, which is
that a module's prop total depends on how it happens to split its meshes.

```
   x 1000   13.8 x 8.0    110 m2   ceil 2.80    17   0.15   <- thinnest: the PAWN
   x  840   11.0 x 26.0   286 m2   ceil 3.40    52   0.18
   x  440    8.8 x 12.6   111 m2   ceil 2.60    25   0.23
   x 1080   11.8 x 8.5    100 m2   ceil 2.73    39   0.39
   x  920   20.0 x 22.0   440 m2   ceil 2.64   211   0.48
   x  760   10.8 x 7.0     76 m2   ceil 3.00    55   0.73
   x 1160   11.3 x 9.4    106 m2   ceil 2.75    95   0.89   <- the THRIFT
   x  520   14.8 x 8.5    126 m2   ceil 3.20   119   0.95
   x  680   13.0 x 24.0   312 m2   ceil 4.20   301   0.96
   x  600   11.0 x 36.0   396 m2   ceil 3.25   696   1.76
```

The thrift is found by `ct/int-thrift.ts`'s own declared **11.3 × 9.4**, matched
to 0.00 m. It sits at **0.89 props/m², rank 7 of 10 from the thin end** — the
fourth densest room in the world.

**And the room that IS thinnest is the pawn shop**, 13.8 × 8 with a 2.80
ceiling, matching `ct/int-pawn.ts`'s declared `d: 8.0, h: 2.8`. F has already
told G exactly that — *"pawn shop density: 0.5/m², thinnest in the world"* — a
different absolute on a different predicate, same conclusion reached
independently. **So the four words in this cell are the pawn's finding sitting
in the thrift's row.** Worth catching before someone reads it as a live
complaint about the thrift.

Looked, too: `shots/B-verify-F/thrift-back.png` — rails packed two deep,
hand-priced shelving, ALL COATS $9, SHIRTS 2 FOR $3, a bin on the floor, and
still floor to walk on. That last part is the desk's own correction to its own
brief landing correctly: *"the answer is NOT to remove stock: the user says the
room should be LARGER."*

## "people in the buildings are in the right orientation" — NOT confirmed

Left LANDED on purpose. Written up in the ledger row itself; the short version
is that **H's sector-4 reading holds, the auditor's "profile" does not, and the
bodega keeper still shows his back** from a station the game validates (the
`[E] buy cereal` prompt is up in `shots/B-verify-F/keeper-oblique.png`).

The thing that defeated the auditor was keeper identification, and the fix is to
define a keeper **positionally** — the standing figure behind a counter — rather
than as the first atlas-framed figure in the room, which picked up a customer
sitting in a diner booth. It resolves to (442.35, −0.70), 0.05 m off the
counter, landing exactly on `ct/int-bodega.ts`'s own `KEEP_AT = CTR_X − 0.55`.
Method and source agree to the centimetre, which is the check on the method.

Routed to F/H. Not my file and I have not touched it.

## Four rows, and the pattern in what went wrong

Three of my own camera stations were useless before one worked: *far side of the
counter* hit the back wall, *toward the room centre* hit the inside of a
gondola, and an absolute `z = 0` photographed the outside of a clapboard wall.

The fix that worked was the same each time — **stop generating stations
geometrically and use what the world publishes**: the `[E]` spot for where a
customer stands, and the room's own measured centre instead of a remembered
coordinate. Every probe in this set returns the centre it measured, so the next
person does not repeat it.
