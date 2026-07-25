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
