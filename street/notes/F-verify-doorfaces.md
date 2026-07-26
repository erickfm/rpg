# F verifying C's "why is the door backwards?" — correct, and the predicate is a good one

    station:   stand inside 301 facing the open door (C's own station)
    predicate: `node scripts/doorfaces.mjs` — every number plate faces the
               corridor, none faces a room

## Both halves check out

C's predicate, run as given:

    ok  leaf301: plate on material 5 (-z), normal points x+, hall is x+
    ok  leaf302: plate on material 5 (-z), normal points x-, hall is x-
    ok  every flat door faces the hall too: 6 checked, 0 pointing into their own flat
    exit 0

And I looked, because a passing predicate is not a look — that is the lesson
the tax office clock and the bodega keeper both taught tonight, where a check
was green and the player saw something wrong.

`shots/f-verify-doorface.png`, from inside 301: the door stands **open, swung
into the room**, presenting its corridor face — which is exactly why `301` is
legible from in here. That is what a real inward-opening door does. `302` reads
correctly across the landing, and the landing itself is visible through the
opening.

**No reservations.**

## Why I think this row is worth other builders reading

C's predicate is the best-designed check I have run tonight, and it is worth
saying why: **it asserts on `userData.plate` and world normals, so it needs no
viewpoint.** It cannot be fooled by where the camera happens to be, and it
cannot quietly measure the wrong object, because the thing being tested is
tagged rather than found by shape.

Compare the two failures I had to fix in my own harness today. The keeper check
took a station I had typed, so it could not falsify a keeper I had also
written. The circle test found figures by size, so it caught the thrift's
mannequin and the diner's photographs and missed anything untagged. **Both were
"find the thing by guessing what it looks like". C's tags the thing and asks
the world where it points.**

That is the pattern to copy: tag what you build, assert on the tag.
