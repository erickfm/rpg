# F re-evidencing my two CONFIRMED rows

## 1. `library courtyard benches sittable` — HOLDS

    station:   the spots are published; stand on either at (-8.65, -19.43) or
               (-8.65, -6.57)
    predicate: [E] reads "sit on the bench", and after pressing it reads
               "stand up"

    prompt:   [E] sit on the bench
    after E:  [E] stand up

Two benches in the courtyard box, both sittable, and sitting is a real state
rather than a teleport — the world knows you are seated and offers the way out.
`shots/f-reev-benches.png`. **Leaving CONFIRMED, now with evidence and a
station on it.**

The predicate that would catch it going false: the two spots disappearing from
`__ct.spots()`, or `[E]` not changing to "stand up".

## 2. `wheel arches read as arches` — I CANNOT DECIDE IT EITHER. MOVING TO LANDED.

The auditor is right that its own check cannot answer: it compares a
**world-space** tyre top against a **car-local** arch line, two different
frames, so no value of either could ever settle it.

**I wrote a predicate that fixes the frame problem and it still cannot decide
the row.** One frame throughout: for each tyre, is there body geometry directly
above it whose BOTTOM sits lower than the tyre's TOP? That is what an arch *is* —
the panel dips down around the wheel and overlaps it. World Y on both sides,
nothing car-local, no mixing.

It returned:

    tyres 328 · panel overlaps on 212 · bare on 116

**And I am not filing that**, because 328 is wrong. The auditor counts 86. My
selector takes any cylinder of radius 0.18–0.42 below 1.2 m, and **a diner bar
stool is a cylinder of radius 0.19**. Most of the 116 "bare tyres" are almost
certainly stools with no car above them, which is correct behaviour for a
stool.

So: frame fixed, population wrong. Same fault one layer down, and the sixth
time tonight my instrument was the thing at fault rather than the world.

**Moving the row to LANDED.** Not because the arches are wrong — I have no
evidence they are — but because *nothing can currently tell us either way*, and
that is precisely what this audit is for. A CONFIRMED that no check can falsify
is the status resting on nothing.

### What would actually settle it

**Tag the tyres.** C's door-face check is the model and it is the best predicate
I have run: it asserts on `userData.plate` and world normals, so it needs no
viewpoint and cannot pick up the wrong object, because the thing under test is
*tagged rather than found by shape*.

    // where the wheel is built
    tyre.userData.tyre = true;

Then this predicate becomes decidable in one line — every mesh tagged `tyre`,
is there body above it that dips below its top — and it stays decidable when
somebody adds a barstool, a bollard or a bin.

The cars are not my file. Whoever owns them: one line, and this row can be
confirmed by anyone forever after. Until then I would leave it LANDED.
