# J — the library interior, first three rows

Builder J, worktree `../rpg-civicint`, branch `feat/civicint`, port **4192**
(not 4191 — builder I's dev server was already on it; `ss -ltn` before you
claim a port).

Owns `src/proto/ct/int-library.ts` and nothing else. `ct/civic.ts` — the
library EXTERIOR and forecourt — is E's and was read, never edited;
`ownership.sh J` is clean on every commit.

## What landed

Three requests, three commits, in the order the user sent them.

### 1. "get rid of this weird internal structure inside the library"

`Screenshot from 2026-07-25 22-05-35.png`, taken from the middle of the reading
room looking back at the entrance.

It was the vestibule: a dropped soffit 2.6 m over the first 4.2 m of the room
with a 5.6 m opening in it, and a stone pier either side. Built to give the
Carnegie contrast — low dark entry, tall bright hall — and **from inside the
vestibule it did that**. The user's screenshot is from the other side, and from
there it is what he called it: a flat untextured 2.6 m wall spanning all 20 m of
the room with a rectangular hole in it, standing in front of the front wall for
no reason a player can see.

Deleted rather than redrawn. I checked GOTCHAS §46 first — a complaint about
execution is not a verdict on the thing — and concluded this is a verdict: it is
not a defect list, it is a man who does not recognise the object at all.

The contrast it was carrying moved to the doorway, which is where a real branch
gets it anyway, and that is row 2. Its two piers also carried colliders across
the room at z = 6.80, so the way in widened from 5.6 m to the full 20.

### 2. "library entrance doesnt match exterior"

`Screenshot from 2026-07-25 22-05-14.png`, taken from inside facing out. One
fact authored twice, which is exactly what `DoorLeaf` exists to stop:

| | the facade (`ct/civic.ts`) | the room (the kit's fallback) |
|---|---|---|
| opening | 2.50 × 4.00 | 1.60 × 2.15 |
| leaves | **two**, dark timber, brass push plates | one flush leaf, vision panel |
| head | round arch, two ashlar orders | rectangular |
| over it | a fanlight cut to the arch, on a transom | nothing |

The facade's numbers were **read off its own texel arithmetic**, not eyeballed:
`doorT` is 40×48 texels over BAY_W 5.0 m × BAY_H 6.0 m, so 8 px/m, and
`fillRect(10, 16, 20, 32)` is 2.50 m × 4.00 m exactly. Those are in
`DOOR.leaf` now and the kit builds the opening from them.

**This cannot move E's facade**, and I checked rather than assumed:
`doorLeafFor` has exactly one caller (`ct/interior.ts`) and `declareDoorWorld`
is handed the door's POSITION only. The authority runs room → facade
(GOTCHAS §45); here the room was the side that was wrong.

The doorcase, the fanlight, the jambs and impost, the two leaves and the
daylight behind them are all drawn in `int-library.ts`, at 16 px/m against the
facade's 8 — same metres, finer grain, for the reason the book spines in this
file are at 32.

### 3. "librarian orientation is so bad. also i want computers in the library"

`Screenshot from 2026-07-25 22-04-43.png`, taken from the reading room.

**She was not facing the wrong way and not on the wrong side.** Her facing is
derived from the desk and the staff side is the one away from the door — both
correct, and both already carry comments in the file explaining a previous
round of exactly this complaint. The fault is that the desk was a single
2.9 × 0.72 counter with **nothing behind it**, so "behind the desk" is a fact
about z that the picture cannot carry. From the door she read right; from the
reading room, where the player spends the whole visit, you saw a figure standing
on open floor with a counter in front of her and her back to you.

So the repair is not to move her. The desk became a U with a staff pocket — a
front counter, a full west return, an 0.8 m east stub with a 0.9 m staff gap,
and a lower back worktop — and she stands inside it. There is now no angle from
which she is standing in the open, which I checked from four (door, reading
room, east, west) rather than from one. That is the third time GOTCHAS §41 bit
this one file in one session.

The computers are a public OPAC bank of three beige CRTs — **one of them dead**,
same fact as the dead ceiling troffer — on the open floor between the desk and
the stair, screens facing west so you meet them looking at you as you come in,
with three chairs registered through `ctx.seat` so you can sit at them. Plus a
staff terminal on the back worktop. 1997 is the year for this and the room
already had the other half of the joke in it: the header says the card
catalogue is here because a branch this size had "a terminal ON ORDER". It has
arrived; the sixty drawers stay, and the two standing in one room is the date.

## Measured, not eyeballed

```
scripts/roomaisle.mjs        library 440 m2, clear aisle min 5.00 med 11.85,
                             0 of 86 samples under the capsule, 90% free floor
                             (14.9 before the bank and the desk U; the auditor's
                              "cramped" finding was 2.10)
scripts/J-library-door.mjs   3 PASS, and its --selftest watched go red
scripts/E-library-in.mjs     unchanged across all three commits
```

## For the desk — three things

1. **There is no queue file.** `notes/queues/J-civic-int.md` does not exist. I
   worked the three library rows straight out of `FEATURE-REQUESTS.md`'s Inbox,
   which were unambiguous and are the reason I was stood up. Anything else you
   want from me has to go somewhere I can read it.

2. **There is no J row in `OWNERSHIP.md`.** `ct/int-library.ts` is not in that
   table under any name — `ownership.sh J` passes by default rather than by
   decision, which is the precise failure that file's own text describes
   ("a blank in this table costs a day"). It wants `src/proto/ct/int-library.ts = J`.
   I have not added it myself: that table is a routing decision and the last
   six rows were explicitly assigned BY THE DESK.

3. **I retagged three rows in `FEATURE-REQUESTS.md` from G to J**, with a
   comment saying so. A routing row naming the wrong builder does not read as
   stale, it reads as work somebody else is doing. Move them to a Done section
   if you would rather.

## Pre-existing reds I did NOT fix, and why

`scripts/E-library-in.mjs` reports 3 FAILED, **identically before and after**
every one of my commits — I stashed and re-ran to establish that rather than
assuming it:

- *"the reading table has seats — 21 chairs registered"* — its filter is
  `x > 100 && /table/` and every other room is also in the interior belt, so it
  counts ten rooms' tables. It was written when the library was the only room
  in there.
- *"the library has its own way out — nearest exit spot is 20.1 m away"* and
  *"you land back in the courtyard — x 52.84, z -97.25"* — both are measured
  after the script has sat the player down, so they inherit a moved position.
  GOTCHAS §20's own example, in the script that made the observation.

It is E's file and OWNERSHIP.md says do not edit another agent's script. Routed
here rather than fixed.

## The thing that cost me the most time, written down so it costs nobody else

`J-lib-look.mjs` shot the library forecourt **BLACK** three runs running and I
went looking for a regression in `ct/civic.ts` before I measured it.

`__ct` existing means the world has been **built**, not **drawn**. The first
seconds after load are shader compiles and ~950 texture uploads, and a
screenshot taken inside that window comes back black with a perfectly correct
HUD painted over it — which is what makes it look like a broken world rather
than a fast shutter. Measured: black at 0.3 s from load, correct at 3 s, from
the identical warp.

Per-shot settling does not help, because the cost is paid once and it is paid at
the beginning. GOTCHAS §30 is the same lesson about animations; this is one
layer earlier and that entry does not cover it. `J-lib-look.mjs` now warms up
once after load, and separately waits for `gy` to stop moving rather than
sleeping — a warp onto the library flight climbs 0.85 m over frames, and the
camera is under the forecourt until it gets there.
