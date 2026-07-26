# BLOCKED — F — all ten live rows are delivered and verified; none has moved

Same shape as the block I filed earlier, which the desk fixed once by landing
five rows with my evidence. It has drifted again: `scripts/live.sh F` shows
**10 LIVE**, and I have built and verified every one of them, most in this
session. I cannot build what is already built, and re-proving delivered work
is the over-rotation onto verification the standing rule exists to prevent.

Each row below, with how it was checked. Nothing here is "I think it's fine".

| row | evidence |
|---|---|
| bodega cramped / doesn't match exterior | door in the CUT, `door: true` on. Largest continuous free run from where you come to rest: ahead 0.44 → **2.86 m**, left 1.01 → **6.49 m** |
| bodega entrance ugly and crowded | runs shortened and pushed back, counter moved off the entry diagonal, aisle 0.95 → 1.15 |
| bodega grey slab in the view | gondola end caps BOTH ends, register given a face. Raycast from the eye named each one before it was touched |
| bodega exit needs work | real doorway: daylight beyond, frame of two jambs and a head, threshold. Walked OUT: `442.27,4.17 → 5.88,-97.12`, on the street |
| enter facing perpendicular | walked in from the street, all ten rooms. Heading was already square; the POSITION was wrong. Chamfered arrival now steps to the centreline, 442.48 → 441.24 |
| "what is this in the corner" | coffee station: urns with taps, lids, drip tray, cup stack; bench turned so all three face the door; counter given a top, edge and panelled front |
| clocks tell the time | `room.clock()` kit primitive. 13:30 → hour hand −0.790 (want −0.785, halfway 1→2); 16:00 → −2.099 (want −2.094). Diner and library return identical angles |
| people orientation | **12 figures, four sides each, every one turns.** Tagged in the kit so the test selects people and not mannequins |
| diner decorations floating | `floaters-walk`: **zero** in the diner. The world's only four are at x=834.84, the hotel |
| thrift too thin | folded-goods shelf wall added. Density measured across all ten rooms: thrift 1.2/m², above bodega 0.9. **pawn 0.5, hotel 0.6, library 0.6 are now the thin ones** |

## Two things the desk should route, neither mine

1. **D's re-entry regression.** Every interior fails the same two checks —
   "you are NOT standing in the re-entry trigger after stepping out" and "a
   second E on the landing does not suck you straight back in". A/B proved it
   is not my clock change (2 failures with, 2 without). It arrived with
   `bce720de7 "Interaction: select by looking, wider volumes"`. Evidence in
   `notes/F-reentry-regression.md`. If stepping out really leaves you inside
   the pull-back-in volume, that is a door that will not let go of you.
2. **The three thinnest rooms are now pawn (0.5/m²), hotel (0.6) and library
   (0.6)** — G's and E's. The "thinnest room in the world" row was filed
   against the thrift and is no longer true of it.

## A harness fault I found and am naming rather than fixing blind

`scripts/floaters-walk.mjs diner` prints the HOTEL's rows. It **ignores its
room argument** — a filter that silently does not filter, GOTCHAS 34 again.
Every result I have quoted from it is world-wide and still sound, but anyone
who trusts the argument will think they scoped a run they did not. It is not
in my ownership list; tell me if it should be and I will fix it.

## What I need

Move the ten rows, or tell me which of the evidence above you do not accept.
I am not asking for them to be marked CONFIRMED by me — that is the desk's or
the auditor's call, and the protocol is explicit about it.
