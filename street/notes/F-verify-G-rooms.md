# F verifying G's rooms — one of them traps the player

Taking the verifier role on G's rooms. **Not the church** — the desk listed it
with G's four, but `ct/int-church.ts` is mine (I built the nave, pews, chancel
step and crucifix), so I cannot confirm it. It needs a different verifier.

## Summary

    casino  24/25
    hotel   24/25
    pawn    19/25   <-- see below
    tax     25/25

Casino and hotel each carry ONE failure, against the two that every room of
mine shows from D's re-entry regression — so they are in better shape on that
axis than my rooms are, not worse.

## PAWN: you can get in and you cannot get out

All six pawn failures are the same door. I did not stop at the count — I walked
it, which is the whole point of the role:

    entered:  1000, 2.85   INSIDE
    at the inside door, prompt = (none)
    after E:  1000, 3.82   ** STILL INSIDE **

There is no way-out prompt anywhere at the inside face of the pawn shop's
door, and pressing E does nothing. **The player is trapped in the room.** The
only escape is whatever the stuck-protection does, and that is not an exit.

The six failing checks, all one fault:

    walking to the inside of the door raises the way-out prompt
    E at the inside door puts you back on the street
    you land on the raised walk, not in the road
    a second E on the landing does not suck you straight back in
    the landing is not boxed in — out to the road
    the landing is not boxed in — down the walk

The last four cannot pass while the first two fail: they all test what happens
after you leave, and you cannot leave. So this is ONE bug with six symptoms,
not six bugs — worth saying so G does not chase six.

**This is the most serious thing I have seen in the world tonight.** The user
has filed the bodega exit four times over an exit that merely looked wrong;
this one does not work at all. Routing to G rather than reaching in.

`shots/f-verify-pawn-exit.png` is the view at the inside door with no prompt.

## Not confirming anything yet

casino, hotel and tax walk clean enough to be worth a proper look at their
contents, which is the next thing I will do. I have not marked any row
CONFIRMED — that is not mine to do on my own say-so, and I have only checked
the doors so far, not what the rooms contain.

## Worth G's attention alongside it

Density across all ten rooms, measured while working the thrift row:

    casino 3.3/m2  church 1.4  burger 1.3  diner 1.3  thrift 1.2
    bodega 0.9     tax 0.8     hotel 0.6   library 0.6  pawn 0.5

Pawn is the thinnest room in the world at 0.5/m2 — 53 meshes over 110 m2 — and
hotel is 0.6. The "thinnest room" complaint was filed against the thrift and
is no longer true of it.


## HOTEL — walked it, and it reads. My density number was misleading.

I flagged the hotel at 0.6 meshes/m2 as one of the three thinnest rooms. Then
I walked into it, which is the job, and it does NOT read as thin: reception
desk with key pigeonholes, patterned carpet, green armchairs and low tables,
chandeliers, a plant, the lift doors at the far end. It reads as a hotel lobby
immediately.

**A lobby is SUPPOSED to be open floor.** Meshes per square metre is the wrong
instrument for one, and I should say so plainly having been the one who
produced the number: it is a good signal for a shop that ought to be packed
(it is why the thrift row was right) and a bad one for a room whose character
is space. Applied to the hotel it would push G to clutter a lobby that is
currently correct.

So: hotel content is good. Its one walk failure is the re-entry pair everyone
has. I am not asking G to change anything here.

The density table still stands for PAWN, which is thin AND is a shop.

`shots/f-verify-hotel.png`.

## Where this verification stands

- **pawn** — TRAPS THE PLAYER. Routed to G, urgent, one bug six symptoms.
- **hotel** — walked, contents good, no action.
- **casino / tax** — doors clean (24/25, 25/25). Contents NOT yet looked at.
- **church** — cannot verify, it is mine. Needs another verifier.

Nothing marked CONFIRMED. Only the desk or the auditor may.
