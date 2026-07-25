# Queue — builder G  ·  worktree `../rpg-interiors2`  ·  port 4186

**Owns:** `ct/int-casino.ts`, `ct/int-hotel.ts`, `ct/int-pawn.ts`,
`ct/int-tax.ts` — files you create.
**Desk writes this file. Do not edit it.**

You are new. Read `START-HERE.md`, then `notes/GOTCHAS.md`, before your first
change.

## Before you start: you depend on builder F

The user asked for ten interiors at once. They are split across four agents,
and all of them build on a shared kit, `ct/interior.ts`, which **builder F
owns and is currently verifying**. The kit hands out world-space addresses so
two builders cannot land a room in the same place, and it builds the room
shell — floor, walls with real thickness, jambs, ceiling, light, and the [E]
spots in and out — so ten rooms do not read as ten different games.

**Do not start until F has landed the kit.** Check with
`git log --oneline add-stick-and-city98 | head` for the interior-kit commit,
or ask the desk. If you build a room shell of your own in the meantime you
will throw it away.

**You may read the kit but never edit it.** If you need something it does not
do — a mezzanine, a second doorway, a double-height room — ask the desk and F
adds it. Two builders editing a shared leaf module is how every hand-resolved
conflict on this project has started.

Read `ct/int-diner.ts` first. It is the reference implementation and the house
style for interiors; copy its shape.

## Now

- [ ] **The casino and hotel EXTERIORS are yours now. Make them the most
      excessive thing in the world.** The user: *"the front facade of the
      casino and the hotel are so low effort and boring. these building are
      meant to be some of the most insane. theyre a casino and hotel right
      next to each other!"*

      They are right and the brief was under-ambitious. You built both
      interiors, so you know these two buildings better than anyone; the
      exteriors were sitting in `ct/street.ts` behind thirteen other items on
      another builder's queue, which is how they ended up as brick boxes with
      a painted band.

      **First, extract them.** Pull GOLDEN ACES and HOTEL ORPHEUS out of
      `ct/street.ts` into a new **`ct/vice.ts`** that you own — exactly the
      split that already works for `ct/civic.ts` (library, church) and
      `ct/park.ts`. These are not shopfronts and should not be built out of
      shopfront parts, which is the same argument that took the civic
      buildings out. **Bounded cross-file mandate**: `ct/street.ts` + the new
      file, one commit, moving the two buildings and nothing else. Verify
      world-neutral with `npm run fp` / `fpdiff` before you change a pixel —
      textures and structure identical, 4–6 pigeons is the noise floor.

      **Then go big.** The governing idea: *these two are the only buildings
      on the block that are LIGHT SOURCES rather than lit surfaces.* This
      world has a real night system now — the street goes genuinely dark and
      the lamps are small warm pools. A casino and a hotel standing next to
      each other at the far end of the side street, throwing colour onto wet
      asphalt, is the single best image available in this game and nothing is
      currently claiming it.

      What that means concretely:
      · a **marquee** over the casino entrance with chase lights round the
        edge that actually run — a sequence, not a static dotted border
      · a **vertical blade sign** the full height of the building, the tallest
        thing on the side street, in neon that reads as TUBES with a glass
        highlight and a dark unlit core, not painted stripes
      · the hotel gets a **porte-cochère** you can walk under, lit from
        beneath, with the name in applied letters
      · **glass that is not a dark rectangle**: mirrored, bronzed, or lit from
        within so you see a lobby behind it
      · gold, deep red, and a lot of small repeated bulbs — the vocabulary is
        excess and repetition, which is exactly what a pixel world is good at
      · **at night they should spill onto the street.** Register the lit
        elements with `props.lit` / the night registry so the pavement in
        front of them is coloured. Coordinate with builder B through the desk
        rather than editing `ct/props.ts` — B has just finished a night pass
        and is mid-revert on the lamp glow.
      · they must still be 1997 and slightly past it. This is not the Strip;
        it is a downtown casino that was refitted in 1984 and has been losing
        money since. Grime on the gold, one dead bulb in the chase, a
        mismatched replacement panel.

      Match the house style — ~8 px/m, hard texels, no dither on faces thinner
      than ~0.3 m. Judge from the street at night AND in daylight; a casino
      that only works after dark is half a building.

- [ ] **THE CASINO — GOLDEN ACES.** Far end of the side street, deliberately
      out and away where it sinks into fog. This is the most characterful room
      on the list and it should be the least like the street outside: no
      daylight, no clock, patterned carpet that is doing too much, low ceiling
      with mirrored panels, slot banks in rows, one felt table, a cage with a
      grille, and a warm dim light that is nothing like the flat civic
      daylight everywhere else in the world.

      The kit gives you a window in the front wall by default — **the casino
      should not have one.** That is the first real test of the kit; if it
      cannot omit a window, tell the desk rather than working around it.

- [ ] **HOTEL ORPHEUS lobby.** Side street, 12 m. It was grand and is not any
      more, and the gap between those two is the whole brief: a good tile
      floor with a patch of vinyl over the worn part, a real reception desk
      with a key rack and pigeonholes behind it, a dead potted palm, mismatched
      lobby chairs, a lift with a floor dial, and a rate card behind glass
      quoting weekly rates. One lamp out.

## Next

- [ ] **PAWN SHOP interior.** East side, 12 m. Bars on the inside of the
      window as well as the outside. Guitars and brass instruments on the
      walls, a long glass case with rings and watches, a wall of tools, a TV
      stack, everything tagged with a handwritten number. The counter should
      be high and the customer side of it should feel narrow — a pawn shop is
      built to keep you at arm's length, and the geometry can say that.

- [ ] **A-1 TAX SERVICE interior.** East side, 13 m. The dullest room in the
      world, done with as much care as the casino — that contrast is the joke.
      Two desks with a client chair each, a wall of filing cabinets, a fake
      plant, a wall clock, a pinboard of IRS notices, strip lighting, a floor
      that has never been anything but functional. Nobody has decorated this
      room since it opened.

## Standing rules for interiors

- **Furnish in LOCAL coordinates** via `room.put` / `room.solid`. Never write a
  world x.
- **Never edit `crosstown.ts`** to add a room — the kit registers the way in
  and the way out for you.
- **Match the house style**: ~8 px/m, muted 1997 palette, unlit
  `MeshBasicMaterial`, no dither on any face thinner than ~0.3 m.
- **Every room must be walkable end to end** — capsule radius 0.36 m. Walk it,
  do not eyeball it. `GOTCHAS.md` §1: a screenshot proves nothing here.
- **Two failures then delete.**

## Done

_(nothing yet — you are new)_
