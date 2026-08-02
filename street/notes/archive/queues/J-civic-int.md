# Queue — builder J  ·  worktree `../rpg-civicint`  ·  port 4191

**Owns:** `ct/int-library.ts` — the PUBLIC LIBRARY interior.
**Desk writes this file. Do not edit it.**

You exist because G was carrying six live user requests across four unrelated
rooms and the user sent **three library messages in five minutes**. G keeps the
casino, the hotel, the pawn shop, the tax office and the church. **The library
interior is yours.**

Rebase on `add-stick-and-city98` before each item. Commit each item alone.

Keep `notes/status/J` current — one line, `STATE | what I am on | waiting on`.
See `notes/status/README.md`. The desk watches it.

`scripts/live.sh J` is what the LEDGER still owes you. This file says HOW.

## Read first

- `notes/GOTCHAS.md` — all of it, but **45** is the one that governs this room:
  *"match the exterior" means which side the door is on, NOT the dimensions.*
  The user, in his own words: *"no one is going to take a ruler and measure the
  width of the inner and outer."* **Take the room you need.**
- The library EXTERIOR, the forecourt and the courtyard are **E's** `ct/civic.ts`.
  Read it, never edit it. Ask me for anything you need from it.
- G built what is there now and did good work under a brief that kept changing.
  `git log --oneline -- src/proto/ct/int-library.ts` before you touch anything.

## Now — the user's three library messages, in the order to do them

- [ ] **1. REMOVE THE INTERNAL PARTITION.** *"get rid of this weird internal
      structure inside the library"*. Ref `shots/user-library-partition.png`.

      It is the vestibule box — two blank masses framing a gap, standing across
      the room. Take it out; do not rescue it by decorating it. He has flagged
      large blank internal masses in this room **twice**, and G correctly
      replaced the first with an open balustrade rather than dressing it.

      **Do this first**: it changes what the room is, and everything below is
      easier to place once the whole floor is visible.

- [ ] **2. THE LIBRARIAN IS WRONG ON BOTH AXES.** *"librarian orientation is so
      bad"* — and he asked once before, *"put this librarian behind the desk"*,
      so this is a repeat. Ref `shots/user-librarian-orientation.png`.

      She stands BESIDE the counter with her back to the room. Behind the desk
      means the counter is between her and the visitor; facing means she looks
      out at the door people come in through. Stand where a borrower stands —
      you should see her face over the desk.

      **Read her true sector from `notes/H-atlas-facing.md`**, which decodes
      every keeper from its own room's customer spot, rather than eyeballing
      it. GOTCHAS 23: anything with a front ends up backwards.

- [ ] **3. COMPUTERS.** *"i want computers in the library"*. It is 1997: beige
      CRTs with deep boxy monitors, chunky keyboards, a mouse on a mat, coiled
      cables, maybe a dot-matrix printer. A small bank of catalogue terminals —
      two to four on a low purpose-built run of desks, with chairs.

      Give at least one screen a lit amber or green catalogue prompt; a dark
      screen reads as a box. Register the chairs with `ctx.seat()`.

- [ ] **4. THE ENTRANCE MUST READ AS CIVIC FROM INSIDE.** *"library entrance
      doesnt match exterior"*. Ref `shots/user-library-door-mismatch.png`.

      From inside it is a single narrow domestic door. Outside is stone, a
      stepped forecourt and a PUBLIC LIBRARY frieze. Match the door's
      **character and situation**, not a measurement: a pair of tall doors, a
      real frame with a transom above, glazing you can see the forecourt
      through, push bars, a threshold you cross.

      Two details in that shot: the **jambs show a stepped stipple** down both
      sides — walk towards it and watch, z-fighting shimmers as you move and a
      texture does not; C is diagnosing the same artefact at the 301 window, so
      compare notes. And the door reads as **shut-but-open** — a visible
      outside through the glazing is most of what makes an entrance read.

## Then

- [ ] **Adopt `citizenSprite`.** No `int-*.ts` calls it yet, which is the whole
      of *"i want the people inside the buildings to be as detailed and
      quake-view like as the pedestrians on the street"*. H's seated pose has
      landed — `notes/H-seated-sprite.md`, one line: `seated: true` on the
      `Look`, placed at **the seat you registered**, not the floor. The kit
      owns the origin offset; **if you find yourself adding a y fudge, stop and
      tell H — that means the atlas is wrong, not your room.**

      The librarian stands. The reading tables and the new terminals want
      sitters.

- [ ] **Flat colour.** Any large blank surface left in the room takes A's
      `slabTex` — it keeps your colour (measured drift 1–4) and gives edge
      density. `notes/A-flat-ground-routing.md` has the call.

Take your own screenshots, walk both floors, and grade them skeptically before
reporting. The user asked for that by name: *"take screenshots yourself and
grade it and make sure you are impressed with it. be skeptical."*
