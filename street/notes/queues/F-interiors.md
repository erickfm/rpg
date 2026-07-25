# Queue — builder F  ·  worktree `../rpg-interiors`  ·  port 4185

**Owns:** `ct/interior.ts` (the shared kit), `ct/int-diner.ts`,
`ct/int-burger.ts`, `ct/int-thrift.ts` — and the interior-belt wiring in
`crosstown.ts`, which is otherwise desk-owned. Coordinate before touching
anything else in the entry point.
**Desk writes this file. Do not edit it.**

You are new. Read `START-HERE.md`, then `notes/GOTCHAS.md`, before your first
change.

## Context: the user asked for ten interiors at once

*"i want to build out the insides of the following: burger barn. diner.
library. tax service. pawn shop. bodega. thrift store. my room. the casino.
the hotel."*

They are split across four agents. You have three of them. Builder G has the
casino, hotel, pawn shop and tax service; builder E has the library; builder C
has room 301. The bodega interior already exists and is being left alone until
its door blocker lands.

Because four agents are building rooms in parallel, there is a **shared kit**:
`ct/interior.ts`. It hands out world-space addresses so two builders cannot
land in the same place, and it builds the room shell so ten rooms do not end
up looking like ten different games. **You own that kit.** If G or E needs
something from it, they ask you and you add it — they do not edit it.

## Now

- [ ] **Derive every room's door and window from the facade, not by hand.**
      The user: *"i need the facades to line up with the interior. so if the
      door on the interior is full right then the facade must match."*

      `ct/int-burger.ts` hand-types `at: -3.6` and `window: { at: 1.7 }`;
      `ct/int-diner.ts` hand-types `at: -2.6`. The facade painter independently
      decides where it draws the door. Two authorings of one fact, and the
      auditor has measured the fallout twice — *"room width is unconnected to
      frontage"*, *"entry triggers are inside a wall"*.

      **Builder A is publishing a frontage descriptor** from `ct/tex-world.ts`
      — frontage width, door centre, door width, glazing span, stallriser and
      fascia heights, all in metres from the building's placement origin, all
      derived from the numbers the painter actually draws with. **Wait for it;
      the desk will hand you the real signature when A commits.** Do not start
      by inventing your own.

      Then:
      · **`RoomSpec` takes the descriptor** instead of hand-authored
        `door.at` / `window`. A room asks for its building by name and gets
        its own frontage; the numbers stop being typed anywhere.
      · **the `[E]` spot derives from the same descriptor**, which is the
        other half of the user's complaint. The auditor measured every kit
        door spot sitting **0.21 m inside collision**, prompting only because
        the trigger radius is five times the intrusion. Deriving it from the
        published door centre and the facade plane fixes that by construction.
      · **room width should relate to frontage.** Burger barn measured
        11.36 m of room against 16 m of frontage — 71%, against 94–97% for
        the others. It does not have to be 100%, but it should be a rule the
        kit applies rather than a number each room picks.
      · walk in and out of **every** room afterwards and confirm the inside
        door lines up with the outside one. This is the user's actual test.

      One item, one commit: land the descriptor plumbing and the alignment.
      Any door that turns out to be in the wrong PLACE is a separate item —
      tell the desk rather than moving it here.

- [ ] **DROP EVERYTHING: three finished rooms are not in the world.**

      `ct/int-casino.ts`, `ct/int-hotel.ts` and `ct/int-tax.ts` are written,
      committed and **never constructed**. `crosstown.ts` imports and calls
      `buildDiner`, `buildBurger` and `buildThrift` and nothing else. Three
      complete rooms — furniture, lighting, collision, `[E]` spots — exist and
      no player can reach any of them.

      The auditor reported this as finding #10 in round 3 (casino), escalated
      it in round 4 when the hotel landed the same way, and it was still
      unchanged in round 5. **The desk did not act on it. That is the desk's
      failure, not yours or G's** — but you own the interior-belt wiring, so
      you are the one who can fix it.

      **Part one, immediately:** import and call all three. Then walk into
      each one from the street and back out. Commit that on its own — the
      user has been asking why the rooms they requested are not there.

      **Part two, so it cannot happen again:** this is a structural hole in
      the kit and it is the more important half. The kit deliberately removed
      the need to touch `crosstown.ts` to register `[E]` spots — that is why
      four agents could build rooms in parallel. But the one-line
      `buildX(ctx)` construction call still lives in the entry point, which is
      desk-owned, so **every room still has a desk-contended step that nothing
      checks.** G could not wire its own rooms even though it had finished
      them.

      Close it: have rooms self-register the way spots do, so writing
      `ct/int-<name>.ts` is sufficient to put it in the world — a registry the
      kit owns and the entry point iterates once, or an explicit manifest that
      a test asserts against. Then add a check that fails when a file matching
      `ct/int-*.ts` exports a builder nothing calls. **A silent failure that
      has recurred three times needs a test, not more care.**

      You have the mandate for `crosstown.ts` for this.

- [ ] **Every seat in the game should be sittable. Build the mechanic; you
      have a bounded mandate for the shared files.** The user: *"for every
      seat in the game i want to be able to sit down"*.

      There are seats everywhere already and none of them do anything: the
      diner's counter stools and booths, the bus bench, the casino, the hotel
      lobby chairs, the tax office, room 301. This is a real gameplay verb
      like sleeping in 301, not a decoration.

      **Build it as a shared capability, the way `ctx.spot()` works** — that
      is the pattern this project already uses for interactions, and it is why
      ten interiors could be built in parallel without anyone touching the
      entry point. Add `ctx.seat({ x, z, yaw, height, ... })` so any module
      registers its own seats, then every other builder can make their own
      furniture sittable without going through you or the desk.

      What sitting should actually do: eye height drops to seated, movement
      locks, you face the direction the seat faces, the `[E]` prompt becomes
      "stand up", and standing returns you to exactly where you were. Getting
      up must never leave you inside a table or a wall — that is the failure
      mode, and it is the same class of bug as the exit-teleport that used to
      suck you straight back into the bodega.

      **The mandate:** `ct/ctx.ts` and `src/proto/fp.ts` are desk-owned — the
      rig owns movement, collision and `RADIUS`, and touching it badly breaks
      the whole world. You get them for this one commit because the mechanic
      cannot be built anywhere else. Conditions: the sit state lives in the
      rig, no other behaviour changes, and **walk-and-sit-and-stand every
      seat you register** before you commit. Do not change `RADIUS`, speed or
      collision.

      Register the seats you own (diner, burger barn) as part of this. The
      desk will queue the other owners — B for the bus bench, G for the casino
      and hotel, C for 301 — once your API lands, so tell me what it looks
      like in your handoff.

- [ ] **Re-anchor the diner interior — the DINER is moving up the block.**
      The user asked to replace LAUNDRY with a diner. Rather than put two
      diners on one street, builder D is swapping their identities: the DINER
      takes the 12 m slot after the alley, LAUNDRY takes the old 9.2 m one.

      `ct/int-diner.ts` hard-codes `DZ = 9.6` — the OLD slot. Once D lands,
      your `[E]` spot and your exit point both sit outside a laundry.

      · new slot runs roughly z −43.5 → −55.5, centre **z ≈ −49.5**. D will
        report its exact final z-span through the desk; use that, not this.
      · the room is now fronting **12 m instead of 9.2** — the interior should
        grow to suit. A diner with a longer counter is a better diner.
      · **wait for D's commit to land before you re-anchor**, or you will be
        anchoring to a slot that does not exist yet. Take another item first.
      · walk it afterwards: in, out, and confirm you do not land inside the
        laundry next door.

## Next

- [ ] **THRIFT STORE interior.** **12.5 m** wide now, not 14 — the user asked
      to swap BARBER and THRIFT, so the thrift takes the narrower slot and
      moves one position north. Builder D will report its exact z-span through
      the desk; wait for it rather than anchoring to the old numbers. West
      side, and its southern neighbour is now a PARK rather than a shop.
      The opposite problem to the burger barn: it should feel like too much
      stuff in too little room. Rails of clothing packed tight, a wall of
      shoes, a shelf of chipped crockery, a glass case at the till with the
      good jewellery in it, handwritten card signs, fluorescent tubes where
      one is out. Density is the whole effect — a thrift store with clear
      floor space reads as a boutique.

## Standing rules for interiors

- **Furnish in LOCAL coordinates** via `room.put` / `room.solid`. Never write a
  world x. That is what keeps rooms relocatable and builders out of each
  other's space.
- **Never edit `crosstown.ts`** to add a room. The kit registers the way in and
  the way out for you. If you find yourself needing to, the kit is missing
  something — fix the kit.
- **Match the house style**: ~8 px/m, muted 1997 palette, unlit
  `MeshBasicMaterial`, no dither on any face thinner than ~0.3 m.
- **Every room must be walkable end to end.** The player capsule is 0.36 m in
  radius. Leave a clear lane through the furniture and walk it before you
  close an item.
- **Two failures then delete** — if a detail has been redrawn twice and still
  misses, take it out and say so in your handoff.

## Done

- [x] **The interior kit** (`ct/interior.ts`) verified and finished, and the
      diner with it (`3b5acc0`, handoff `a68f35c`). The desk handed both over
      unverified; F found and fixed the real faults rather than trusting them.
- [x] **BURGER BARN: the way in, and the room behind it** (`343ad61`)
- [x] Retired `diner-walk.mjs` in favour of `interiors-walk.mjs`, which covers
      both rooms (`7a5722b`)
