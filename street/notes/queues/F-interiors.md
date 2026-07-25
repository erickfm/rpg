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

- [ ] **Generalise your glob so ANY new world module is in the world by
      existing.** The user: *"can you just make the new module incorporation
      automatic?"* — and they are right, this beats a check that fails.

      **You already built it.** `ct/interior.ts` does
      `import.meta.glob('./int-*.ts', { eager: true })` and `buildAllInteriors`
      walks the result. That is exactly the mechanism; it just only covers
      `int-*`. `park.ts` and `lot.ts` are outside the glob, which is why both
      were finished and invisible.

      **The obstacle is signatures, and solving it fixes a second bug.**
      Auto-calling needs a uniform contract, and today it cannot exist:
      `buildPark(ctx, site, gate)` and `buildLot(o)` need to be told WHERE
      they stand, and that number currently reaches them by the desk relaying
      it from D by hand. That relay has already failed twice — the diner's
      `[E]` prompt ended up on the bank because the desk never passed on a
      z-span, and the car lot sat waiting on one.

      So make the site part of the contract:
      · **D's roster registers named sites** as it lays the block out —
        `ctx.site('park', { z0, z1, side })`, `ctx.site('lot', ...)`, and the
        same for every building slot
      · **a world module asks for its own site**: `ctx.site('park')` returns
        it, or null if the roster does not have one, in which case the module
        builds nothing and says so
      · then every module can share one signature — `register(ctx)` — and the
        glob can call them all without knowing anything about them

      Now a builder adds `ct/foo.ts`, exports the standard entry point, and it
      is in the world. No desk step, no relayed numbers, nothing to forget.

      **Two things to be careful of:**
      · **build order is load-bearing.** One seeded `rnd()` stream feeds tree
        heights and pigeon placement at construction, so a change in call
        order moves every tree in the world (`GOTCHAS.md` §2). Do NOT rely on
        filesystem or glob order — give modules an explicit order value the
        way `ctx.onFrame` already does with `ORDER`, and sort by it.
      · **verify world-neutral**: `npm run fp` before, glob after,
        `npm run fpdiff`. Textures and structure must come back identical;
        4–6 pigeons drifting is the noise floor. If trees move, your ordering
        is wrong.

      Land the three-line park/lot wiring FIRST if you have not already — the
      user is waiting to walk into both — then do this as its own commit.

      Builder A has been stood down from the build-time check; this replaces
      it. Tell the desk when the contract lands so D can start registering
      sites.

- [ ] **THE PARK AND THE CAR LOT ARE NOT IN THE WORLD. Three lines. Do this
      first, commit it alone, then continue.**

      `ct/park.ts` exports `buildPark`. `ct/lot.ts` exports `buildLot`.
      **Neither is called from anywhere.** Both are finished modules by
      builders E and C; D has already cleared the ground for both. The user
      went looking for the park and found a blank brick wall, and has now
      asked where the car lot went.

      Import and call both, walk into each, commit that and nothing else.

      **This is the fifth time this exact failure has shipped.** The casino,
      the hotel and the tax office were all written, committed and never
      constructed; the desk found those and had you wire them. Now the park
      and the lot have landed the same way, and the pattern is not a
      coincidence — it is structural, and it is the desk's fault for letting
      it stand:

      > A builder can write a complete module, commit it, and have no way to
      > put it in the world, because the one line that constructs it lives in
      > `crosstown.ts` — which is desk-owned. So the last step of every new
      > module depends on the desk noticing. Five times it did not.

      **The structural half is going to builder A** (a build-time check that
      fails when a `ct/*.ts` exports a `build*` and nothing calls it), so do
      NOT bundle it into your commit — bundling a fix with its refactor is
      what cost 74 minutes earlier tonight. Yours is the three lines.

      Then tell the desk whether the interior self-registration you built for
      the rooms can be generalised to world modules too, so the registry and
      A's check meet in the middle rather than duplicating.

- [ ] **The diner's [E] prompt is on the BANK. Re-anchor it, then sweep every
      spot.** The user: *"theres still a diner entrance by the bank. i think we
      have to make sure all press e to enter options are aligned with the doors
      on the facades"*.

      **The desk dropped this handoff, not you.** D moved the diner and left
      the number in `ct/street.ts` right above the roster entry — *"z −55.5 …
      −43.5, centre −49.5 — ct/int-diner.ts anchors its door here"* — and the
      desk never relayed it. `int-diner.ts` still says `const DZ = 9.6`, which
      is the old slot, and that slot is now part of the bank.

      **The number is −49.5.** Re-anchor and walk it: stand outside the diner
      at its real position, press E, come back out, and confirm there is no
      prompt anywhere near the bank.

      **Then sweep every other `[E]` spot against its building**, because the
      block has been re-cast repeatedly today and this will not be the only
      one. Buildings that MOVED: the diner, the thrift (now 12.5 m and one
      slot north), the church (side street → main block, east side), and the
      whole BARBER/GROCERY frontage which is now a park. Buildings that
      VANISHED: CAFE, HARDWARE, MERIDIAN, LAUNDRY, BARBER, GROCERY. Any spot
      still pointing at one of those is orphaned.

      **This is exactly the case for the frontage descriptor** you and builder
      A are already queued to build. A hand-typed `DZ = 9.6` cannot know its
      building moved; a spot derived from the facade's published door position
      moves with it and cannot go stale. So fix the number now as its own
      commit, and treat this as the strongest argument for landing the
      descriptor work straight after — the user has now hit the same class of
      bug three times: triggers inside walls, interiors not matching facades,
      and now a prompt on the wrong building entirely.

- [ ] **Interior people must use the 8-angle citizen atlas, like the street
      does.** The user: *"i want the people inside the buildings to be as
      detailed and quake-view like as the pedestrians on the street"*.

      Right now every figure indoors is a **hand-drawn single-view plane** —
      the diner waitress is a `PlaneGeometry` with one painted face, and the
      casino and hotel copied that pattern from her because she was the
      reference. So they are cardboard: walk round one and it is the same
      picture from every angle, while the pedestrians outside turn through
      eight views. The user has noticed the inconsistency, and it is the exact
      thing `citizenAtlas` exists to solve.

      **Put it in the kit, not in each room.** Add a `room.person({...})`
      helper to `ct/interior.ts` that wraps `citizenAtlas` and `viewFor` and
      handles the billboard-facing the way the street sprites do. Then every
      room builder gets it for free and none of them re-invents a figure —
      the same reason `ctx.seat()` and `ctx.spot()` live in shared code.

      · `ct/citizens.ts` is **builder H's** now. Read it, do not edit it. If
        you need a new `Look` option — an apron, a dealer's visor, a uniform —
        ask the desk and H adds it.
      · convert the diner waitress first, since she is the reference every
        other room copied.
      · tell the desk the helper's signature when you land it; **builder G has
        four rooms with figures in them** and will convert theirs to it.
      · indoor figures mostly stand still, so make sure a stationary person
        still reads well — the atlas's idle frame, not a walk cycle frozen
        mid-stride.

- [ ] **Make the jump a tiny bit higher AND gravity a tiny bit stronger.**
      The user asked for these minutes apart, so treat them as one feel
      change and tune them together in one commit rather than two — a higher
      jump landed alone and a stronger gravity landed alone would each feel
      wrong on their own, and you would be chasing your own tail.

      Together they are a coherent target: **a snappier jump.** More initial
      velocity gets you a little higher; stronger gravity brings you down
      faster and cuts the floaty hang time. Roughly similar apex, much less
      time in the air. That is the arcade feel, and it is almost certainly
      what "a tiny bit" of each is reaching for.

      Emphasis still on TINY — this is feel, not a new movement capability.

      Original note: The user: *"make the jump a tiny
      bit higher"*. `fp.ts`, which you hold the mandate for.

      Nudge both, then re-walk the two places it
      matters: the kerb (0.14 m) and the stoop, and the apartment stairs,
      where the floor picker has hysteresis and a higher jump can land you on
      the wrong storey (`GOTCHAS.md` §7). Its own commit, separate from the
      people work.

- [ ] **STUCK PROTECTION — the player can be trapped with no way out. Do this
      before anything else.** The user: *"im literally stuck here. i think we
      need some sort of stuck protection or something smarter around collision
      and blocking"*. Ref: `shots/user-stuck.png` — wedged between two parked
      cars.

      You have the `fp.ts` mandate from the seat work, so this is yours.

      **The cause, read off the code.** `FPRig.blocked()` is a pure boolean
      reject: if the *target* position is inside any collider inflated by
      `RADIUS`, the move is refused. There is **no depenetration anywhere**.
      So the moment you are inside a collider — you slipped through a gap
      narrower than the capsule, a car parked onto you, a collider changed
      under you — every direction you try is also blocked, and you are stuck
      permanently. The system has no way to express "you are in a bad place,
      get out".

      **The fix: resolve penetration, do not just reject motion.** Each frame,
      test the CURRENT position. If it is inside one or more colliders,
      compute the minimum translation out — for an AABB that is the smallest
      of the four axis pushes — and move the player along it. Sum or iterate
      when several overlap. Then normal movement resumes because the player is
      legal again.

      Make it robust rather than clever:
      · it must **always terminate** — cap the iterations and, if a position
        cannot be resolved after a few passes, fall back to pushing toward the
        nearest known-good point (the road centre line and the sidewalk lane
        are both always clear).
      · **do not let it launch you.** Push out at a bounded speed, not
        instantly, or a player standing legally against a wall will get shoved.
      · it must not fight the floor picker or the seat state.
      · a **last-known-good position** updated whenever you are legal and
        grounded is a cheap and very effective backstop; teleporting there is
        far better than being stuck.

      **Verify by deliberately getting stuck**: walk into the gap in
      `shots/user-stuck.png`, walk into the bodega crates, into the dumpster,
      into a bench, and confirm you always get out. This is a movement change,
      so it must be walked, never screenshot (`GOTCHAS.md` §1).

      One item, one commit. The parked-car spacing that created THIS trap is
      builder H's and is queued separately — you are building the safety net
      that makes any future trap survivable.

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
