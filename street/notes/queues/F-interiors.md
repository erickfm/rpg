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

- [ ] **THRIFT STORE interior.** 14 m wide, west side, north of BARBER.
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
