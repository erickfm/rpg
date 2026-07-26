# F — stations for my three rows still awaiting a check

The policy says a row moved to LANDED carries one line telling a verifier where
to stand or what predicate settles it. My three were advanced before that rule
existed, so they do not have one. Here they are, so nobody has to hunt the way
I did on the park.

## 1. "thrift interior too thin"

    station:   enter the THRIFT from the street, stand where you land
    predicate: rails of clothing packed close on both sides, an ALL COATS $4
               card, and a back wall of four shelves of folded stock

Measured rather than argued: at 128 meshes over 106 m2 the thrift is 1.2/m2 —
denser than the bodega (0.9) and no longer the thinnest room in the world.
**Please do not use my density table on the hotel or the library**: it is a
metric for rooms whose character is stock, and it is wrong for rooms whose
character is space. Pawn (0.5/m2) is the one it still indicts.

## 2. "make sure the people in the buildings are in the right orientation"

    station:   any room with a figure; walk a full circle round them
    predicate: the sprite cycles through different atlas columns as you go —
               not the same view from all four sides

This is the user's own test — *"walk a full circle round it and confirm the
frames advance"* — and a single-angle check cannot answer it, because a figure
wrong by a constant passes standing still. Twelve figures, four sides each,
all turn. `room.person()` now tags what it builds (`userData.citizen`) so the
test can select people and not the thrift's mannequin, which is correctly
static.

## 3. "the interior door doesnt match the exterior doorway"

    station:   run `node scripts/doorside2.mjs`
    predicate: every decidable room reads "mirrors correctly"

    burger  -3.6  3.89  +1  mirrors correctly
    diner   -2.6  2.89  +1  mirrors correctly
    tax     -4.2 -4.63  -1  mirrors correctly
    thrift  -2.2  2.43  +1  mirrors correctly

**Read the note before trusting the tool**: this check was wrong twice and I
fixed it both times. It measured the way-out spot instead of the door, and its
verdict rule ignored which side of the street a building sits on — which made
it accuse the tax office, whose `side: 1` is correct. Rooms reading "centred —
undecidable" or "no frontage published" are NOT passes.

## A general note for whoever picks these up

Everything above is verifiable without me. Where a row needed judgement rather
than a predicate I have said so rather than dressing it as a measurement — the
density table in row 1 is the clearest case, and it is the one most likely to
be misapplied if it travels without its caveat.
