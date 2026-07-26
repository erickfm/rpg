# F on G's "casino + hotel blades read correctly" — I COULD NOT GET A CAMERA ON THEM

32 characters on the audit list. I tried three times and failed three times, so
this is a report of my failure, not a verdict on G's work.

## What I know

The two doors are published and adjacent:

    SEVENS          51.3, -96
    HOTEL ORPHEUS   39.5, -96

Both on the cross street, both with inward normal −z.

## Three attempts, three wrong frames

1. Stood at (44, −92) on a guessed heading — got a brick wall.
2. Derived the heading from the door normals, stood south and looked north from
   (45, −86) — got the side of a building.
3. Used the world's own answer, the published `into SEVENS` entry spot at
   (51.3, −96.8), backed off 6 m along the outward normal and pitched up — got
   the side of a building again.

The third should have worked and did not, which tells me the thing I am missing
is not the *position* but the **pitch and distance**: a blade sign projects from
a facade high above the entrance, and standing at the door and craning up
puts the facade itself between me and it. You need to be across the street.

## Why I am stopping instead of trying a fourth time

Twelve times tonight I have aimed an instrument by guessing and been wrong, and
three of those were in the last ten minutes on this one row. A fourth guess is
not more likely to be right than the first three; it is just more likely to
produce a frame I over-read because I want to be done.

**This row needs a station and I cannot supply one** — which is now the fifth
time tonight (the alley, the ATM, the phone box, the lot's office, and this).
The pattern is exact: **anything you look UP at, or look AT from across a
street, has no published coordinate.** Spots mark where you stand to *use*
something. Nothing marks where you stand to *see* it.

    station: stand at (x, z) facing <direction>, pitched up
    predicate: both blades legible and reading the right way round

One line from G and this closes in a minute. I have the shots I took saved as
evidence of the attempts rather than of the signs.


---

# SOLVED THE AIMING PROBLEM — compute the sightline, do not guess it

After three wrong frames I stopped guessing and made the world answer.

**Find the subject by its shape in space, not by eye:** a blade sign is TALL
and THIN and high on a facade. Filtering meshes near the two doors to
`height > 2.5 m, width < 2.0 m, centre 4–22 m up` returned exactly one
candidate:

    blade: x 56.23  y 13.50  z -96.67   h 15.80  w 1.24

**Then compute a camera with clear line of sight**, rather than picking one:
walk a ring of candidate positions around it at 10/14/18/22 m, and for each,
step along the ray from eye height to the target and reject it if the ray
passes through any tall mesh's bounding box. Take the nearest survivor:

    clear sightline from  x 65.74  z -93.58   (15.5 m)

with yaw and pitch derived from the target rather than typed. **One shot, and
the blade is in frame** — `shots/f-verify-blades.png`. Lit, vertical, red on
dark, projecting from the building corner.

## What I can and cannot conclude

**Present, lit, vertical, correctly oriented on the corner — yes.** At 15.5 m
and high up it occupies a small part of the frame, so **I cannot read the
lettering well enough to confirm "reads correctly"** in the sense of the text
being the right way round. That is the row's actual claim and it needs either a
closer sightline or a zoom.

So: **still not a verdict on G's row**, but no longer a failure to reach the
subject.

## The reusable part, which matters more than this row

Five rows tonight were unverifiable because **nothing publishes where to stand
to SEE a thing** — spots mark where you stand to USE one. The ring-and-raycast
above is a general answer that needs no new data: given any target, it finds a
camera that can actually see it.

If the desk wants it, that is thirty lines in `scripts/lib/` and every verifier
gets a `viewOf(target)` instead of guessing coordinates. I have not built it as
a shared helper because my context is gone and a half-built tool other people
rely on is worse than none — but the algorithm is written out above and it
works.


---

# VERDICT — the casino blade reads correctly. Hotel not checked.

The helper needed one more fix and then it answered in one shot.

**The fix:** "closest clear position" was wrong twice over. It first put me
*behind* the sign (a `facing` hint fixed that), and then *underneath* it — 4 m
away craning at 71 degrees with the building filling the frame, while the ray
to the target stayed perfectly clear the whole time. **A clear ray is not a good
frame.** The helper now rejects any candidate whose pitch exceeds ~40 degrees
and takes the closest of what survives.

    viewOf(blade, { minR: 6, maxR: 40, facing: {nx: 0, nz: 1} })
      ->  x 71.58  z -92.29  dist 16  pitch 0.64

## What that frame shows

`shots/f-blade-front.png`. **SEVENS**, lit, horizontal along the sign, **the
right way round** — with the vertical red blade beside it. Legible from the
street at 16 m, which is the distance a player would actually read it from.

So the casino half of *"casino + hotel blades read correctly"* **holds**, and
the name matches the rename row.

## What I am not claiming

**I did not check the hotel blade.** The row covers both and I verified one.
HOTEL ORPHEUS is 12 m west at (39.5, −96) and the same call would reach it;
I am out of context, not out of method.

## The honest arc of this row, since it is instructive

Three guessed cameras — brick wall, building flank, building flank. Then a
computed sightline that reached the subject but from behind. Then one from in
front but from underneath. Then, with a pitch cap, a frame a player would
recognise. **Four wrong answers before a right one, and every wrong answer was
confidently produced by an instrument I had just written.**

The thing that finally worked was not cleverness, it was encoding what a
*person* needs: stand in front of it, far enough back to look at it without
craning. Both of those are obvious to anyone standing in a street and neither
was in my first two versions.
