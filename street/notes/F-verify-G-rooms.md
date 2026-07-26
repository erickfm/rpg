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


## TAX — contents good, but its CLOCK is still painted and now visibly wrong

Walked in. The room reads: filing cabinets, desks and chairs, a clerk facing
you, a notice board, ceiling grid with fluorescents, a plant, drab
institutional palette that suits a tax office. No action on contents.

But there is a wall clock on its back wall, and it is one of the painted faces
I listed as unconverted when `room.clock()` landed. Counted live clock hands
across the world:

    rooms with LIVE clock hands: diner 2, library 2

Two each - an hour hand and a minute hand - and they are the two rooms I
converted. **Nothing else in the world has a moving hand.** So the tax
office's clock is a fixed painted hour, hanging in plain sight, and it now
disagrees with the diner and the library rather than merely being static.

This matters more than it did before the primitive landed. The user's ask was
*"make sure all the clocks throughout the world (library, diner, etc. tell the
time accurately)"* — a property of the world, every face agreeing. Converting
two of them and leaving a third painted is the state that ask was filed
against, just with different rooms in it.

**One line for G**, and the call is in `notes/F-clock-primitive.md`:

    room.clock({ lx: ..., y: ..., lz: ..., r: 0.16 });

Same for the hotel lobby clock at `int-hotel.ts:421`. NOT the hotel lift dial
(stopped between floors on purpose) and NOT the pawn shop's dials
(merchandise) — those are correct as they are.

## Final state of this verification pass

| room | doors | contents | verdict |
|---|---|---|---|
| pawn | 19/25 | thinnest in world, 0.5/m2 | **TRAPS THE PLAYER — urgent, routed** |
| hotel | 24/25 | good, reads as a lobby | no action; my density number was wrong for it |
| tax | 25/25 | good | one line: convert the clock |
| casino | 24/25 | **the best interior in the world** | no action |
| church | — | — | mine, needs another verifier |

Nothing marked CONFIRMED. Only the desk or the auditor may.


## CASINO — walked it, and it is the best interior in the world

Rows of slot machines with reels and stools receding into the distance, gold
valances over each bank, patterned carpet, ceiling grid, a punter standing at
a machine. At 3.3 meshes/m2 it is four times the density of any other room and
it earns every one of them. No action, and worth G knowing it is the bar the
rest of the world is being measured against — including mine.

It also has NO CLOCK, deliberately, and the tax office's own comment says why.
That is correct and must survive the clock sweep: a casino with a clock is a
casino that has lost the joke. Flagging it because a sweep that converts every
painted dial it greps would break it.

## Pass complete — all four of G's rooms walked

One urgent fault, one one-line fix, two rooms that need nothing:

- **pawn TRAPS THE PLAYER.** Six failing checks, one bug. No way-out prompt at
  the inside door and E does nothing. The most serious thing I have seen
  tonight.
- **tax** — one line to convert its painted clock, which now visibly disagrees
  with the only two moving clocks in the world.
- **hotel** — good. My own density number was the wrong tool for a lobby.
- **casino** — excellent. Keep it clockless.

Nothing marked CONFIRMED by me; that is the desk's or the auditor's call. The
church is mine and still needs a different verifier.

## LIBRARY (E's) — walked it. The stair and mezzanine are real.

Not in my assignment, but nobody had walked it and my queue was empty.

The room reads: circulation desk with a librarian behind it, book stacks,
study carrels with terminals, bins, and **a mezzanine with a full staircase
up to a second level of shelving**. That is the thing E was blocked on for
three passes, and it exists in the world now.

**I am NOT confirming the floor-function row** even though I just watched its
result. That row is mine — `buildRoom` accepting levels is my kit change — and
confirming my own work is exactly what the protocol forbids. What I can say as
a witness is narrower and still useful: *E's side is built and standing.* Some-
one else has to close the row.

Same for its clock: I converted it, so that line is mine and not mine to
verify.

Content verdict on E's work: good, no action. And the same caveat I gave the
hotel applies here — at 0.6 meshes/m2 the library is on my "thin" list, but a
reading room is supposed to be open floor. My density table should not be used
to push clutter into it. It is a shop metric.
