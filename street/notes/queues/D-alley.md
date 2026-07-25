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

- [ ] **CAFE and HARDWARE become a used car lot — roster half.** The user:
      *"turn hardware and cafe into a used car lot"*.

      They are the first two entries in EAST and already adjacent — CAFE 11.2
      then HARDWARE 12 — so like the bank this needs no swap. Take both out
      and hand the **23.2 m** to an open lot. The EAST-before-No.227 run still
      totals 49.2, which is load-bearing because the walk-up's door and
      interior sit at a fixed z in `ct/apartment.ts`.

      **Your half is the roster and the ground only.** The lot itself —
      surfacing, fence, office, signage, stock — goes to builder C in a new
      `ct/lot.ts`, the same way the park went to E. Report the exact z-span
      through the desk when you commit.

      Two things that are yours and easy to miss:
      · the neighbours now have **exposed party walls** on the lot side. A
        blank flank facing a car lot is right, but it must be a finished
        flank, not the raw end of a shell — same note as the park.
      · this is the **second gap in the block's walls** after the park. They
        are on opposite sides and opposite ends, which is good, but check the
        sightline: standing in one you may now see straight through to the
        other, and the street should not read as having holes punched in it.

- [ ] **The produce crates read as ONE GIANT FRUIT each.** The user, looking
      at your `530d385`: *"what is this?"* Ref: `shots/user-crates3.png`.

      That question is this project's signal that something is unidentifiable
      — it has been asked twice before, both times about a prop that was drawn
      accurately and read as nothing. **This is attempt two on the crates**
      (attempt one was "open boxes with a painted stripe"), so the working
      rule applies: *two failures, then delete.* If attempt three does not
      land, take the produce off and leave plain crates, and say so.

      What is wrong, specifically:
      · **The heap is a single faceted dome per crate**, roughly as wide as
        the crate itself. It reads as one enormous tomato or pumpkin sitting
        in a box — the dark star at the top even looks like a stem. The brief
        was *fruit heaped above the rim*, and a heap is MANY THINGS. The eye
        identifies a heap by seeing individual units and the gaps between
        them; a smooth dome has neither.
      · **The waffle/checker patches on top** read as a texture artefact, not
        as produce. Whatever they are meant to be — netting, a highlight
        pattern — at this size they look like a grid laid over the shape.
      · **Scale.** Even as one fruit it is wrong: nothing in a bodega crate is
        60 cm across.

      What would work: eight to fifteen SEPARATE lumps per crate, varied in
      size and shade, packed so they overflow the rim and a couple have
      tumbled onto it. Vary the tone between them — a crate of identical
      objects reads as a pattern, a crate of the same fruit in slightly
      different reds reads as fruit. Keep the shadow between the slats you
      already have; that part is good.

      Judge it from **standing eye height at the shopfront**, which is the
      only view that exists. Builder B just learned this the hard way on the
      litter rig: it judged every candidate top-down, reported that they read,
      and none of them did.

- [ ] **MERIDIAN and LAUNDRY become one bank.** The user: *"make meridian and
      laundry a bank instead"*.

      They are already adjacent — the first two entries in the west run before
      the alley, LAUNDRY 9.2 then MERIDIAN 10 — so unlike the park this needs
      no swap. Merge them into a single **19.2 m** bank and the run total stays
      at 51.2. Nothing to pay for out of a neighbour.

      **This also settles your last unplaced roster entry.** MERIDIAN *was*
      the corporation — the comment above it says *"blander and more modern
      than anything either side of it, the whole point of standing it next to
      the library"*, which is the corporation brief almost word for word. A
      bank does that job at least as well: institutional, flat, faintly
      corporate, and the contrast against the library next door is preserved
      rather than lost. **Treat the "Corporation" item further down your queue
      as resolved by this one** and take it out.

      What a 1997 branch bank looks like, and it is not a shopfront:
      · a taller, flatter ground floor than the shops either side — polished
        stone or precast panel rather than brick and an awning
      · deep-set windows with a bronze or dark anodised frame, blinds behind
      · a proper entrance with a recessed door, not a glass hole in a band
      · the name in applied metal letters with a shadow, not painted on a
        fascia — and an ATM in the wall, which is very 1997
      · a night depository slot, a plaque, a security camera

      Read what builder A lands on the shopfront painters before you draw it —
      A has a live mandate giving shopfronts real depth, and the bank should
      use that vocabulary rather than inventing a third one. If A has not
      landed when you reach this, tell the desk and I will sequence it.

      The bank stands next to the LIBRARY, which is the other stone building
      on this side. Make sure they do not read as the same institution: the
      library is warm worn ashlar with arched openings, the bank should be
      cooler, flatter and newer.

- [ ] **Swap BARBER and THRIFT, then turn BARBER + GROCERY into a small
      park.** The user: *"swap barber for thrift, then grocery and barber turn
      those into a small park"*.

      The swap is not cosmetic — it is what makes the park possible, and it is
      worth seeing why before you cut anything. The west run after the alley
      currently reads, north to south:

          DINER 12 · BARBER 12.5 · THRIFT 14 · GROCERY 16      = 54.5

      Swap BARBER and THRIFT (identities, not slots, so every width stays put
      exactly like the diner move) and it becomes:

          DINER 12 · THRIFT 12.5 · BARBER 14 · GROCERY 16      = 54.5

      Now **BARBER and GROCERY are adjacent**, and together they are a **30 m
      frontage running to z = −98**, where the corner building takes over.
      That is the park: the whole south end of the west side, meeting the
      corner. Before the swap those two slots had THRIFT between them and no
      park was possible without breaking the run.

      **Your half is the roster and the ground.** Delete BARBER and GROCERY as
      buildings, and give the 30 m to a park. The run total is unchanged —
      54.5 either way — so nothing needs paying for out of a neighbour, which
      is the whole point of doing the swap first.

      **The park itself belongs to builder E**, in a new `ct/park.ts`, the same
      way the library and the church live in `ct/civic.ts`. You decide where
      it stands and how the ground behaves; E decides what is in it. Give E
      its exact z-span and the sidewalk edge through the desk when you commit.

      Things that are yours and easy to get wrong:
      · the buildings either side now have **exposed party walls** where they
        used to abut. A blank brick flank facing a park is correct and real —
        but it must be a finished flank, not the raw end of a shell.
      · the **skyline opens up**. Right now the west wall is continuous and
        the fog closes the end; a 30 m gap will show whatever is behind it.
        Make sure that is something, not void.
      · **collision** — the park must be walk-INTO-able. This is your live
        collision mandate; the two blanket wall rectangles in `crosstown.ts`
        would seal a park exactly the way they sealed the library courtyard.

- [ ] **Replace LAUNDRY with the DINER.** The user: *"replace laundry with
      diner."*

      There is already a DINER — first entry in WEST, w 9.2, before the alley
      — so this cannot be read literally without putting two diners on one
      block. The desk's reading, which you should follow unless it is
      obviously wrong when you look: **swap their identities, not their
      geometry.** The DINER name, colour and shopfront move into the LAUNDRY
      slot; LAUNDRY moves into the old DINER slot.

      Do it that way and the widths never move: the diner becomes the 12 m
      slot after the alley and the laundry becomes the 9.2 m one before it.
      **Both run totals stay exactly as they are** — WEST before the alley
      still totals 51.2, WEST after it still totals 54.5. Swapping the entries
      bodily instead would break both by 2.8 m and cost you a reconciliation
      in each run for no benefit.

      It is also the better result: a diner wants the wider frontage, and the
      new slot puts it past the alley where there is currently nothing to eat.

      **This must land together with a change in `ct/int-diner.ts`, which is
      builder F's file — do not touch it.** The diner interior is anchored to
      the street at `DZ = 9.6`, which is the OLD slot. When the roster moves,
      that door hangs on a laundry. The desk has queued F to re-anchor it to
      the new slot; the new diner runs z −43.5 → −55.5, centre **z ≈ −49.5**.
      Tell the desk your exact final z-span when you commit so F anchors to
      the real number rather than this estimate.

- [ ] **Building collision does not follow building geometry. You have a
      one-time cross-file mandate from the desk for this.**

      The user, having just seen E's library courtyard land: *"collision for
      all the buildings needs to be updated. make sure for example the corner
      cutaway and the recess in the library are current to the actual geometry
      of the buildings"*.

      **The cause is structural, not a bad number.** `crosstown.ts` hand-writes
      the block's collision as two blanket walls:

      ```
      { minX: FACE - 0.3,  maxX: FACE + 8,    minZ: -96,  maxZ: 20 }   // right
      { minX: -FACE - 8,   maxX: -FACE + 0.3, minZ: -112, maxZ: AZ1 }  // left
      ```

      Two rectangles spanning the entire block, authored in the entry point and
      completely independent of what any building actually looks like. So every
      building is a flat wall to the player no matter what was drawn:
      · the **library recess** — E built the courtyard and registers real
        colliders for it in `ct/civic.ts`, but the blanket wall still runs
        straight across its mouth, so you cannot walk in
      · the **bodega corner cutaway** — the canted bay is drawn but the
        collision is square, so you clip the cut face
      · every projecting doorcase, stoop and stallriser on the block

      This is the same failure the `[E]` spots and the frame hooks already
      outgrew, and the fix is the same registration pattern: **the module that
      draws a building registers that building's footprint.** `ctx` already
      carries `obstacle()`; `ct/civic.ts` already uses `solid()` correctly and
      is the model. Delete the blanket walls from `crosstown.ts` and have
      `ct/street.ts` register a real footprint per building as it places it —
      following the chamfer at the corner, and leaving the alley mouth and
      every doorway clear.

      **The mandate, precisely:** `ct/street.ts` (yours) and `crosstown.ts`
      (desk's) in ONE commit, collision only. Do not touch `ct/civic.ts` — E
      already registers its own and it is correct; your job is to stop
      overriding it. Rebase immediately before you start; A has a live
      cross-file mandate in `ct/street.ts` for masonry density, so if you find
      A's change in your way, tell the desk rather than working around it.

      **Walk it, do not eyeball it** (`GOTCHAS.md` §1). The 2 m sidewalk lane
      is sacred (§9) and a collider that swallows a doorway trigger closes the
      shop (§8) — that has already happened once here. Prove: you can walk
      into the library courtyard and back out, you can follow the bodega
      chamfer round the corner without clipping, every `[E]` door still
      prompts, and you cannot get inside any building's footprint.

- [ ] **Move the church onto the main block, where RECORDS and DELI are.**
      Promoted to `## Now` — your previous Now (the bodega blocker) is done and
      re-verified, and so is BURGER BARN. Full brief below under `## Next`;
      it is the next thing you should start.

      **Desk answers to the two questions you raised in your report:**
      · Pay the 3 m out of an adjacent EAST shop, as you proposed. Do not
        touch No. 227 — `ct/apartment.ts` depends on its z.
      · The party-wall junctions may need a change inside `ct/civic.ts`. Do
        not make it. Write down exactly what you need — the return walls
        suppressed, the sign band terminated, whatever it is — and the desk
        will hand it to E as a queue item. Your side of the line is where the
        church stands; E's is what it looks like.
      · **Port 4181 is not free** — noted, and it has now bitten you twice.
        Use `--strictPort` on every dev server from here.

## Next

- [ ] **The bodega corner bay is a mess, and it is more than the door.** The
      user, standing right in it: *"strange corner for bodega, also collision
      is odd in this same corner"*. Ref: `shots/user-bodegacorner.png`

      This supersedes the older "the door is not readable" note — that was
      part of it, but the close-up shows the whole bay is wrong:

      · **The panels do not line up.** Blue glass, a brown pier, a beige panel
        and the door leaf all sit at different depths and different widths,
        with no shared stallriser line, no shared head, no consistent reveal.
        A shopfront bay is a RHYTHM — equal bays, one sill height, one fascia
        — and this reads as several unrelated fronts jammed together.
      · **The kick plates are at three different heights.** Look along the
        bottom of the shot: the dark strips step up and down across the bay.
        One stallriser height across the whole frontage, full stop.
      · **The OPEN neon still sits over glass rather than over the door**,
        which was the original complaint and is still true.
      · **The sidewalk scoring runs under the building.** The paving joints
        continue straight into the facade instead of stopping at it. That is
        the walk plane extending beneath the shell and showing through where
        the chamfer cuts back. It may be builder B's `ct/tex-ground.ts` rather
        than yours — check, and if it is, hand it to the desk rather than
        reaching into B's file.
      · **Collision confirmed odd here** — which is your live collision
        mandate. This screenshot is the user hitting exactly the square
        collider on the cut face that the mandate exists to fix, so treat it
        as evidence for that item rather than a separate bug.

      Builder A has a live mandate on the shopfront painters (`tex-world.ts`)
      to give shopfronts real depth — set-back glass, projecting stallriser
      and fascia, transoms, something in the window. **The bodega bay should
      follow whatever A lands rather than inventing its own vocabulary a
      second time.** Coordinate through the desk on timing; if A has not
      landed when you get here, tell me and I will sequence it.
- [ ] **Crates are empty.** They read as open boxes with a painted stripe. A
      produce crate outside a bodega is FULL — fruit heaped above the rim, so
      you see produce first and crate second. Shadow between the slats. Sit them
      flat.
- [ ] **Move the church onto the main block, where RECORDS and DELI are.**
      The user: *"replace records and deli with church. you can swap those.
      make sure seams are all good post swap too"*

      This is a ROSTER change and the roster is yours — `ct/street.ts` decides
      where buildings stand; `ct/civic.ts` (builder E) decides what the church
      looks like. Stay on your side of that line and neither of you will
      conflict.

      · EAST currently runs … No. 227, PAWN 12, **DELI 11, RECORDS 10**, … —
        so the church takes a 21 m slot there.
      · The church's current slot is the west end of the south side
        (`ST BRIGID`, w 18, placed by `placeChurch` at z = -111.7). Fill it
        with the shops you displaced, and mind that the church nave is 18 m
        against 21 m of DELI + RECORDS — the difference has to come out of a
        neighbour in the same run, which is the rule the roster comments spell
        out at the top of the file. **Do not just let a run overflow**: the
        widths are load-bearing, WEST before the alley must still total 51.2
        and the last shell must still end on -98.
      · The church was authored to be seen head-on from the side street, with
        its own return walls and no party walls. On the main block it will have
        neighbours hard against it on both sides. Check what that exposes.

      **Seams are explicitly part of this item**, at the user's request. After
      the swap, walk both sides of every new junction and check: brick courses
      meeting stone, the sign band running into the church where there is now
      no band, the roofline step between a 5-storey neighbour and a nave, the
      sidewalk under it, and the coping. `notes/seam-audit.md` lists the
      failure patterns this block already has — do not reintroduce them.

      Coordinate with E through the desk, not directly: E is working inside the
      church at the same time on its buttresses.
- [ ] **Signs — three separate bugs.** (a) GOLDEN ACES marquee is rotated 180°
      IN PLANE (upside-down AND mirrored) — not a back-face issue. (b) HOTEL
      blade is the plain back-face case. (c) Neither is structurally supported:
      give the marquee a visible steel frame on the parapet, square to the
      street; give the blade wall brackets. Then audit every other sign.
      Ref: `shots/user-signs.png`
- [ ] **Shop resizing.** Shops get a 4.2 m ground floor (residential stays
      3.2 m — the user says the walk-up is correct). Glazing 1.92 m → ~2.7 m,
      add a ~0.35 m stallriser, sign band ~0.9 m, texture 40 → 52 texels.
      Ref: `shots/user-shopscale.png`
- [ ] **Window lights.** Lit windows are baked into `facadeTex`, so the same
      windows are lit at 4am as at 8pm. Paint facades dark; add an additive
      overlay of lit windows on the night curve; cross-fade a few variants
      slowly. Sensible: almost none at 4am, peak 8–10pm, a few all night.
      `facadeTex` is handed to you for this. Ref: `shots/user-windowlights.png`
- [ ] ~~**Corporation**~~ — **RESOLVED by the bank item above.** MERIDIAN was
      the corporation; the user has replaced it with a bank, which fills the
      same role and keeps the contrast against the library.

- [ ] **Move your `[E]` spots out of `crosstown.ts` and into your own module.**
      The entry point no longer enumerates interactions — `CtxBuild` now has
      `ctx.spot({...})` and `ctx.player` (`x()`, `z()`, `gy()`, `jumpTo()`).
      Register the spots belonging to ct/street.ts and ct/bodega.ts from inside it and delete them
      from the `SPOTS.push(...)` block in `crosstown.ts`. This is the last thing
      forcing you to edit the entry point. Verify by actually walking to each
      door and pressing E — `scripts/doortest.mjs` is a starting point.

## Done

- [x] **Bodega entry blocker** — it was never the chamfer. A single 2.2 m
      fruit-crate collider spanned the frontage with the `[E]` spot inside it.
      Crates moved clear, collider split per crate. Walked from three
      approaches with real key input.
- [x] **BURGER BARN red + beige** (`d7e0b1f`) — the queue had this under Done
      but the change had never reached the code; the mustard was reading as
      the second colour, which is why it kept coming back. Now three named
      constants at the top of `burgerFront`.

- [x] Block re-cast: library, church, casino + hotel out at the side-street end
- [x] **Library** — stone, PVBLIC LIBRARY engraved, arched windows, recessed
      entrance with steps. User approved.
- [x] BURGER BARN (old PAWN slot), pawnshop (old CINEMA), tax service (old ARCADE)
- [x] BURGER BARN palette → red and beige
- [x] Bodega chamfered corner bay, full height, door in the cut face
- [x] Sky gap at the chamfer closed (the corner triangle)
- [x] Alley side walls differ from each other and carry brick
- [x] Plywood sheet and trash bags removed
- [x] Slatted produce crates (still need filling)
- [x] Six-cat comparison rig → black cat shipped
