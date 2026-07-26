# J — the library interior: the queue is EMPTY

All six rows in `notes/queues/J-civic-int.md` are built, walked and
committed — the four under `## Now` and both under `## Then`. Seven commits,
one per item. Scroll to **"After the queue file arrived"** for rows 3's
remainder, 4's two details, and the two Then rows; the first section is the
three Inbox messages I started on before the queue existed.



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

## After the queue file arrived

It landed while I was committing the third Inbox row, and had more in it than
those three messages. The rest, in the order I did it.

### Row 3's remainder — a mat, cables, a printer, and an amber prompt

The middle terminal is now an **amber serial terminal** — black screen, amber
lines, block cursor, scanlines. A branch in 1997 has both machines side by
side: the PC the grant paid for and the amber terminal wired to the catalogue
since 1989, so the pair is the period rather than an inconsistency. Mats under
the mice; a **dot-matrix printer** on its own stand at the end of the run with
the fan-fold carton it feeds from.

"Coiled cables" I did NOT model, and the reason is a measurement rather than a
preference: at 8–16 px/m a flex is well under a texel, so a modelled coil is a
dark blob. What IS legible at this scale is the **cable tray** they all
disappear into, so that is what is there.

The printer was built twice. The first had body, hood, paper and carton all
within a few points of the same off-white and read as a stack of pale blocks —
a printer that was in the room and not recognisable as one. Four tones now.

### Row 4's two details — both checked rather than assumed

- *"the jambs show a stepped stipple down both sides … z-fighting shimmers as
  you move"* — **gone.** Walked the doorway at 9.6, 8.6, 7.4, 5.5 and 3.0 m
  (`shots/J-lib/jamb-*.png`); the doorcase and its pilasters now cover the
  kit's raw jamb geometry and the edges are clean at every distance. C is
  diagnosing the same artefact at the 301 window — mine is closed by covering
  it, which may or may not help theirs.
- *"glazing you can see the forecourt through"* — the daylight panel.

### Row 2's librarian, decoded rather than eyeballed

Using H's method from `notes/H-atlas-facing.md`
(`sector = repeat.x < 0 ? 9 - off : off`):

| standing at | sector | reading |
|---|---|---|
| the borrower's spot at the counter | 0.00 | **looking at you** |
| the reading room | 4.00 | her back |
| the east | 2.00, unmirrored | profile |
| the west | 6.00, **mirrored** | profile |

One profile and its mirror from the two sides is exactly the signature H's note
predicts for a keeper facing ACROSS the ±x sweep, and sector 0 from the
borrower's spot is the row's own test — *"stand where a borrower stands, you
should see her face over the desk."*

### Then: adopt `citizenSprite`

Two readers **seated** at the long reading table, through `citizenSprite`
directly rather than `room.person`, which places at the floor. H's rule is the
whole of it: the seated origin is the HIP, so place at the SEAT TOP, and a y
fudge means the atlas is wrong and not your room. **No fudge** — 0.45 is passed
because it is the seat pan these chairs are built with. Verified structurally
rather than by eye:

```
librarian, standing   origin y 0.000   plane spans -0.115 .. 1.728
reader,    seated     origin y 0.450   plane spans -0.126 .. 1.717
```

Both sets of feet land in the same place; the atlas did the offset.

### Then: flat colour

Five faces take A's `slabTex`, ranked by how much of one tone a player is
looking at: the gallery deck's **underside** (3.0 × 11.5 m — 34.5 m², and from
the reading floor it is most of what the gallery IS), the deck's top, the
reading table's top, the issue counter's front, the OPAC bench's top.

**One face at a time, sized from that face's metres.** A `BoxGeometry`'s six
faces each span the full 0..1 of the map, so handing one texture to the whole
box stretches a 3 m top and a 0.16 m edge across the same canvas — GOTCHAS §5,
the asphalt that came out 21 m × 0.33 m. `joint: 0` throughout, because these
are timber and not paving, and the colours are the ones already there.

### The density finding, routed to me mid-session

F measured the library at 0.6 things per m², one of the three thinnest rooms in
the world. `scripts/J-room-furnishing.mjs` reproduces it independently at
**0.62**, with pawn 0.22 and hotel 0.27 below it — F's ranking exactly. Two
rules agreeing is worth more than either, and the script says out loud what it
counts, because a density with no rule is an opinion.

The answer was not to scatter objects. It was that a 440 m² reading hall had
ONE four-seat table in it, which is not a reading room — it is a corridor with a
table. So: a **rank of reading tables** with brass lamps and six registered
seats, placed as an ISLAND in the largest piece of floor doing nothing;
**shelving against walls**, which costs no floor at all and is the first thing
to reach for when a room measures thin, including two runs along the gallery
(a gallery in a Carnegie branch is for reaching the high books — ours was a
viewing platform, so you climbed it once and had no second reason to go up);
and the props that say somebody works here.

### And the stair got stringers

Found by doing what the queue asks — *"walk both floors, and grade them
skeptically"* — and standing at the **foot** of the flight, which is the one
place a player looks at a stair from and the one place it had never been shot.
From there a tread was a 3 m plank with nothing under it and nothing at its
ends, and twelve of them read as a cascade of shelves hanging in the air. Every
other view is three-quarter and hides it. **The stair had been checked for
whether you can CLIMB it and never for what it looks like from where you start
climbing.**

## Two more rows, routed mid-session

### "discontinuous railing in library" (23-26-31)

The STAIR handrail was ten HORIZONTAL boxes at ten descending heights. Consecutive
caps sat 0.222 m apart vertically and were 0.09 m tall, so there was **0.13 m of
air between each one and the next** — his "row of disconnected T shapes", exactly.

He also handed me the reference: *"the GALLERY balustrade at the left of that
shot is fine … you have a working reference twenty pixels away from the broken
one."* It is the same construction now, off one `RAIL_X` and one `RAIL_H`.

**And the ends actually join, which is the half a rail-only fix would have left.**
Measured before touching it: the stair rail's top sat at y 3.84 / x 7.07 and the
gallery rail sits at y 3.88 / x 6.99 — 4 cm below and 8 cm inboard, so the two
members *passed each other*. Checked from below, from the gallery above, and at
both ends. Walked up and down; the rail sits a constant **0.60 m below eye
height** the whole rake, so it can never meet a head.

Then the sweep he asked for, which found two more of the same shape:

- the **issue desk's west return** did not reach the counter — a 0.36 m hole in
  the body and 0.26 m in the top, at the corner. You could see through the desk.
- the **gallery deck** stopped 0.10 m short of the back wall while the floor
  picker answered for the full band, so you could stand on 10 cm of gallery that
  was not drawn.

### "whjats going on here in the library" (23-27-24) — routed to me as "your computers"

**The object in that shot is the PERIODICALS RACK, not the terminals.** Matched
against his own screenshot and against the world: three raked pale panels on
trestles in the west alcove, the bookcase and globe beside them, and no beige
CRT anywhere in frame — because my terminals are LIVE-not-landed and the world
he is playing does not contain them.

That is not a reason to discount the report. **It is the report.** He named the
object as a completely different object, which is the test he set: *"if you
cannot name the object in one second it is not done."* And all three of his
diagnoses were literally true of the racks — a raked plane with no body, 24° of
rake, a 1.5 m face on a 0.42 m rail. The "venetian blind" was the texture.

The fix is his own observation, and it is the most useful line in the message:
*"The bookshelf and the blue display case in the same shot are working fine …
they read instantly."* So the periodicals became a wall case of the same build
as the stacks with **covers facing out** instead of spines. One newspaper stand
survives beside it with a body, at 12° instead of 24.

His terminal checklist, applied separately to the real terminals: deep box ✓,
upright ✓, lit amber screen ✓, chunky keyboard ✓, chair ✓ — **the coiled cable
was missing** (I had answered it with a cable tray; true of the coil, not of the
0.4 m drop, which reads fine) and **the keyboard overhung the bench by
0.065 m**, so the desk grew from 0.76 to 0.92 — *"a proper run of catalogue
desks"*. Every part on it is now arithmetically inside it.

## Measured, not eyeballed

```
scripts/roomaisle.mjs         library 440 m2, clear aisle min 4.85 med 7.70,
                              0 of 86 samples under the capsule, 87% free floor
scripts/J-room-furnishing.mjs 353 things, 0.80 per m2, 7th of 10 (1 = thinnest),
                              from 271 and 0.62 when I started
scripts/J-library-door.mjs    3 PASS, and its --selftest watched go red
scripts/E-library-in.mjs      unchanged across all seven commits
```

**Read the two aisle numbers together, because the median alone misleads.** It
fell from 11.85 to 7.70 and that is the price of the furniture, paid
deliberately. But the **minimum is 4.85 m** — second only to the hotel's 5.27,
and nearly seven times the 0.72 m capsule — where pawn and church carry medians
of 13.37 and 13.00 with minima of **0.0 and 1.6**. Those rooms are wide with a
pinch point in them; this one has no pinch point anywhere, and 0 of 86 samples
are under the capsule. The auditor's original finding on this room was a
2.10 m median, the narrowest of all ten.

## For the desk — four things

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

4. **`notes/J-seat-dispatch.md` — 126 of 229 seats in the WORLD fail
   `seats-walk`, and it is not the library.** `pickSpot` ranks by
   `offAxis + d * 0.02`, so the seat under your feet (≈90° off-axis by
   definition) loses to one a metre away that you happen to be facing.
   `fp.ts:493` says this is safe *"because a spot you are standing on has
   offAxis 0 by construction"* — true only at the `d < 1e-4` guard on the line
   above it. `fp.ts` is DESK-owned and `seats-walk` is D's, so it is filed, not
   touched, and I have not tuned the library's seat radii to make somebody
   else's check go quiet. 217 of 229 seats have a neighbour within 1.5 m, so
   this is the normal case rather than an edge one.

   **Also on the port:** the queue says 4191 and builder I's dev server was
   already listening on it. I used **4192**. Worth a line in whatever assigns
   them — `ss -ltn` before claiming a port, or two builders measure each
   other's worlds (GOTCHAS §26).

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
