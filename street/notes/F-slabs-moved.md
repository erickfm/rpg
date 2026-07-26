# F — every room slab has shifted. Any note quoting a room by x is now wrong.

A new `bank` room has taken the first slab and pushed every other room down one:

    bank@440   bodega@520  burger@600  casino@680  church@760
    diner@840  hotel@920   library@1000 pawn@1080  tax@1160  thrift@1240

**Yesterday `440` was the bodega, `1000` was the pawn shop.** Today 440 is the
bank and 1000 is the library.

## How I caught it, which is the useful part

I tagged what `clockFace()` builds and queried the world for clocks. Three
answered, at x 442, 835 and 1000. I read those as bodega, hotel and pawn — and
they are **bank, diner and library**, which are exactly the three files that
call `room.clock()`. The tag was right and my mental map was a day old.

Had I reported that by position I would have told the desk that the bodega,
hotel and pawn shop have working clocks. None of them does.

## What this invalidates

**Any note, check or ledger cell that names a room by its x coordinate.** Mine
that do, and that I have already published tonight:

- `F-verify-G-rooms.md` — "20 m2 at (1000, 0)" as the pawn shop's untextured
  floor. That was true when written; 1000 is the library now.
- `F-reevidence.md` and the wheel-arch ledger cell quote no room x, so they
  stand.
- The bodega keeper station **(441.50, 0.40) is now inside the BANK.** The
  station on my orientation row is wrong as written. The bodega keeper is at
  520-ish now.

I will fix the keeper station next, since a station that points at the wrong
building is worse than none.

## The general point

`roomDims()` publishes `id` alongside `cx`. **Ask it for the id; never infer the
room from the number.** This is the same lesson as tagging tyres and door
plates — identify a thing by what it says it is, not by where it happens to be
or what size it happens to have. Position is not identity, and in a world that
is still growing rooms, position is not even stable.
