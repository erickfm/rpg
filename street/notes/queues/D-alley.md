# Queue — builder D  ·  worktree `../rpg-alley`  ·  port 4181

**Owns:** `ct/street.ts`, `ct/cat.ts` placement
**Desk writes this file. Do not edit it.**

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

Rebasing per item is not optional. Builders drifted 85–91 commits behind
mainline before landing today, and every hand-resolved conflict came from that
staleness. Rebasing at the start of an item is nearly free; rebasing after an
hour of work is where the conflicts live.

> **This file is the monolith now.** Ten items queued here at one point while a
> functional blocker sat third in line. `ct/street.ts` should be split
> (buildings / alley / corner) so more than one builder can work the block.

## Now

- [ ] **Set the open-site depths. Two builders are blocked on these numbers.**
      `openSite` in your file takes `depth`, and it is `7.0` for the park and
      `8.0` for the lot. Both users of it have raised blockers waiting on you.

      **The desk's decision, so nobody waits any longer:**
      · **park → 32 m.** The user asked for *"4-5x deeper"* against roughly 7,
        and 32 gives a field with a loop path round it that is actually worth
        walking. Builder E is building exactly that and is blocked.
      · **car lot → 23.2 m, which makes it SQUARE.** The user has now said so
        directly: *"deeper used car lot like make it square"*. The lot's
        frontage is CAFE 11.2 + HARDWARE 12 = **23.2 m**, so setting depth to
        the same number makes it square in plan — which is what a real corner
        car lot is, and it is why it reads as a lot rather than as a gap
        between buildings. Use the frontage value rather than a hard-coded
        23.2, so it stays square if the frontage ever changes. Builder C is
        blocked on this number.

      These are the same metres your building-depth item consumes, so do them
      in the same pass and make them agree — that is exactly the collision I
      flagged when three of you started claiming the ground behind the
      facades. Buildings get real depth, but the park and the lot get theirs
      first where they conflict: an open space that is too shallow reads as a
      gap, whereas a building that is 18 m instead of 24 m reads as fine.

      Commit the two numbers on their own, immediately, before the rest of the
      depth work — E and C are both stopped and each is one number away.

      The rear elevation and flanks that `openSite` builds have to hold up at
      those depths: at 32 m the park's back wall is a long way from the street
      and needs to be worth looking at, not a flat slab.

- [ ] **Buildings are 3.4 m deep and every flank is the same brown. Both show
      now.** The user: *"right side of bank facade should match front, also all
      buildings need to be much deeper otherwise it looks like a fake
      building"*. Ref: `shots/user-bankflank.png`.

      Two one-line causes, and the user found both from one camera position:

      **(a) `endM` is a single flat brown for every building on the block.**
      `const endM = new THREE.MeshBasicMaterial({ color: 0x53382e })` is used
      for the sides, ends and returns of EVERY building regardless of what its
      front is made of. The bank's front is pale precast panel and its return
      is brown brick, which is why it reads as a stage flat with something
      else propped behind it.

      A return should be made of what the building is made of. It does not
      need the front's *detail* — a blind party wall with no windows is
      correct and real — but it must be the same **material and palette**.
      Derive the flank from the same spec the front is painted from rather
      than from a shared constant. If you need a flank painter, builder A owns
      `ct/tex-world.ts` now; ask through the desk for the export rather than
      building a second one.

      This is the same family as the two patterns already fixed today: one
      masonry density for the world, one authoring of the door position. The
      shape of the defect is always *the same fact decided twice, or decided
      once and applied where it does not belong.*

      **(b) Every building is a 3.4 m deep box.** That is the real "fake
      building" complaint. 3.4 m is a corridor, not a building — a real
      commercial block is 15–30 m deep. It did not matter while the street was
      an unbroken wall on both sides and you never saw a return. It matters
      now because the block has been opened up: the park, the car lot, the
      alley and the church all expose flanks and rooflines.

      Give them real depth. Things to think about as you do:
      · **rooflines become visible from the street** once buildings are deep —
        that is a gain, not a cost, but it means the roof needs to be worth
        seeing rather than a flat slab
      · **collision must follow**, and you just built the per-module footprint
        registration for exactly this. Deeper buildings must not eat the alley,
        the park, the car lot or the courtyards.
      · **the ground behind the facades** is currently dead space the player
        has never seen. Deepening the buildings CONSUMES it, which is good —
        it is the same problem as the park and the lot needing somewhere to
        extend into. Coordinate with builders E and C through the desk so the
        three of you are not all claiming the same metres.
      · depth can vary per building; they do not all need the same. A block
        where every mass is identical depth is its own kind of fake.

- [ ] **CAFE and HARDWARE become a used car lot — roster half only.**
      They are the first two entries in EAST and already adjacent (11.2 + 12
      = **23.2 m**), so no swap is needed. Take both out and hand the frontage
      to an open lot. EAST-before-No.227 must still total 49.2 — that one is
      load-bearing because `ct/apartment.ts` pins the walk-up's door to a
      fixed z.

      **The lot itself is builder C's**, in a new `ct/lot.ts` — same split as
      the park and the civic buildings. You do the roster and the ground.
      **Report the exact z-span through the desk when you commit**; C is
      waiting on that number and cannot start without it.

      Watch: the neighbours get exposed party walls on the lot side (finished
      flanks, not raw shell ends), and this is the second gap in the block's
      walls after the park — check you cannot now see straight through one to
      the other.

## Next

- [ ] **The bodega corner bay has no shared rhythm.** The user, standing in
      it: *"strange corner for bodega"*. Ref: `shots/user-bodegacorner.png`.
      Panels at different depths and widths, kick plates at three different
      heights, OPEN neon still over glass rather than over the door, and the
      sidewalk scoring runs under the building.

      **Your report says this is blocked on builder A's private helpers.** The
      desk has read that. Tell me exactly what you need exported from
      `ct/tex-world.ts` and I will queue it to A as a one-line addition rather
      than leaving you stuck — do not work around it and do not reach into A's
      file.

- [ ] **Signs — two bugs left.** (a) the GOLDEN ACES marquee is rotated 180°
      in plane, upside-down AND mirrored, not a back-face issue. (b) audit
      every other sign for the same. Ref: `shots/user-signs.png`.
      **Note the casino and hotel now belong to builder G** in `ct/vice.ts` —
      if the marquee moved with them, this is G's and you should tell me.

- [ ] **Shop resizing.** Shops get a 4.2 m ground floor (residential stays
      3.2 m — the user says the walk-up is correct). Glazing 1.92 m → ~2.7 m,
      a ~0.35 m stallriser, sign band ~0.9 m, texture 40 → 52 texels.
      Ref: `shots/user-shopscale.png`. **Check what builder A landed first** —
      A has given the shopfronts real depth and this may be partly done.

- [ ] **Window lights are baked into `facadeTex`**, so the same windows are
      lit at 4am as at 8pm. Paint facades dark, add an additive overlay of lit
      windows on the night curve, cross-fade a few variants slowly. Almost
      none at 4am, peak 8–10pm, a few all night.
      A has already fixed the *pattern* (they were diagonal stripes); this is
      the *animation*. Ref: `shots/user-windowlights.png`.

- [ ] **Move your `[E]` spots out of `crosstown.ts`.** `ctx.spot({...})` and
      `ctx.player` exist. Register the spots belonging to `ct/street.ts` and
      `ct/bodega.ts` from inside them and delete them from the `SPOTS.push`
      block. Builders C, F and H have all done this — copy them. Walk to each
      door and press E.

## Done

- [x] Used car lot roster — *(pending, see Now)*
- [x] **The church moved to the main block** over DELI + RECORDS (`360fbac`)
- [x] **Collision follows geometry** — each module registers its own footprint
      (`8a7941f`). Fixed E's library courtyard.
- [x] **MERIDIAN + LAUNDRY became one bank** (`b5f8264a`); that also resolved
      the Corporation item
- [x] **BARBER/THRIFT swapped and BARBER + GROCERY became the park** ground
- [x] **DINER and LAUNDRY swapped identities** — diner to the 12 m slot
- [x] **Crates, attempt three: twelve separate fruit, not one dome**
      (`50eaa2b0`)
- [x] **Bodega entry blocker** — it was the fruit-crate collider, not the
      chamfer. Walked from three approaches.
- [x] **BURGER BARN red + beige** (`d7e0b1f`)
- [x] Block re-cast: library, church, casino + hotel placed
- [x] Bodega chamfered corner bay, full height, door in the cut face
- [x] Alley side walls differ and carry brick; plywood and trash bags removed
- [x] Six-cat comparison rig → black cat shipped
