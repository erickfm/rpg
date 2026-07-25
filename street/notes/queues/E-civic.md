# Queue — builder E  ·  worktree `../rpg-civic`  ·  port 4182

**Owns:** `ct/civic.ts` (the library + the church), and the HOTEL / GOLDEN ACES
facades where they live in `ct/tex-world.ts` — coordinate with the desk before
touching tex-world, it is shared.
**Desk writes this file. Do not edit it.**

You are new. Read `START-HERE.md`, then `notes/GOTCHAS.md`, before your first
change. `ct/civic.ts` was split out of `ct/street.ts` today (commit 8ca6ce8) so
that these items could run in parallel with the alley work — you own it alone.

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

## Now

- [ ] **Inlay the church, give it steps, and a small courtyard.** The user:
      *"inlay the church and give it some stairs similar to the library but
      keep the design of the church. the church facade is good i just want it
      to have depth and a lil courtyard"*.

      **The facade itself is approved — do not redesign it.** The stone, the
      gable, the rose window, the lancets, the arched entrance in its recessed
      orders: all of that stays exactly as it is. This is entirely about
      setting the mass BACK and building the ground in front of it. Resist the
      urge to improve the elevation while you are in there; the user has told
      you it is good, and a redesign is how an approved thing gets lost.

      What to build, and the library is the model because the user is asking
      for it by name:
      · pull the whole nave back off the facade line so the front has real
        depth rather than sitting flush with the shopfronts
      · **steps up to the doors** — a church front should be raised. Same
        mechanic as the library steps in your other item; build them once and
        use them twice rather than inventing a second approach.
      · a **small forecourt** in the notch — but a churchyard, not the
        library's civic plaza. They should not read as the same place. A
        church forecourt is paving or flags rather than municipal concrete,
        a low wall or railing with a gate on the street line, maybe a
        noticeboard (there is already one by the door), a bit of planting
        against the wall. Quieter and more enclosed than the library's.

      **Two dependencies, both real:**

      1. **Builder D is moving the church right now**, off the side street and
         onto the main block over the old DELI + RECORDS slots on the EAST
         side. Do not start against its current position — you would build the
         recess into the wrong wall. Wait for D's commit and its reported
         z-span, which comes to you through the desk. Note the church will now
         be on the EAST side, so the recess is mirrored from the library's.
      2. **D's collision mandate must land** or the courtyard is sealed the
         same way the library's was — `crosstown.ts` hand-writes blanket wall
         rectangles that override what modules register. Check before
         concluding your entrance does not work.

      Constraints as before: the 2 m walking lane past it stays clear
      (`GOTCHAS.md` §9), paving must ABUT the sidewalk and never overlap it
      (§6), and floor height comes from a picker rather than colliders (§7) —
      **walk up the steps and back down** before you close this.

- [ ] **Build the park.** New file, `ct/park.ts`, yours — same relationship to
      `ct/street.ts` that `ct/civic.ts` already has. The user:
      *"swap barber for thrift, then grocery and barber turn those into a
      small park"*.

      Builder D is clearing the ground: BARBER and GROCERY come out of the
      west roster, leaving a **30 m frontage at the south end of the west
      side, running to z = −98** where the corner building takes over. D will
      report the exact z-span through the desk — **wait for it and use the
      real number**, do not anchor to this description.

      This is the first thing on the block that is not a building, and that is
      the opportunity: everything else here is a wall you walk past. A park is
      a place you walk INTO and stop. Treat it like the library courtyard,
      which the user liked, but bigger and less formal.

      What a small 1997 city park actually is, and none of it is grass alone:
      an iron fence with a gate on the street line so it reads as a room;
      paths that go somewhere rather than curving decoratively; London plane
      or honey locust with real canopy; benches facing the paths, not the
      street; a drinking fountain; a bin; patchy grass worn to dirt on the
      desire lines; a bit of asphalt where something used to be. It should
      look municipal and slightly neglected — the same hand as the library,
      which was *"built by people who thought public buildings should be
      beautiful, and not looked after since"*.

      Constraints:
      · the **2 m sidewalk lane past it stays clear** (`GOTCHAS.md` §9), and
        the park must be genuinely enterable — walk in, around, and out
      · paving must ABUT the sidewalk, never overlap it (§6) or it z-fights
      · trees are `ct/props.ts` (builder B) and the seeded `rnd()` order is
        load-bearing (§2). If you draw new random values, append at the END,
        and if you need B's tree work, ask the desk rather than reaching in
      · benches should be sittable — builder F is landing a shared
        `ctx.seat()` for exactly this. Ask the desk when it is ready rather
        than building your own sit mechanic.
      · D's collision mandate has to land first or the park will be sealed
        off the way the library courtyard was. Check before concluding your
        entrance does not work.

- [ ] **You must be able to walk up the library steps.** The user, after the
      courtyard landed: *"also i want to be able to walk up the stairs of the
      library"*.

      The steps are drawn but not walkable, so the courtyard reads as a place
      you can stand in front of rather than a building you can approach. That
      is most of what a civic building's steps are FOR.

      Floor height in this world comes from a picker, not from colliders —
      `ct/apartment.ts` owns `ground(x, z)` for the walk-up and the entry point
      dispatches to it. Read how the walk-up's stairs work before you start
      (`GOTCHAS.md` §7); the same shape of solution applies here, and getting
      it wrong means falling through or being unable to climb.

      Note that builder D is separately fixing the fact that `crosstown.ts`
      hand-writes blanket wall colliders that override what modules register
      — that is why the courtyard is not enterable yet. Your steps depend on
      that landing. Check whether it has before you conclude yours do not
      work.

      **Walk it, up and back down, and do not close this from a screenshot.**

- [ ] **The library courtyard — DO THIS FIRST.** Promoted above the buttresses:
      the user went looking for it, found the library unchanged, and said so —
      *"library is exactly the same no copurt yard or anything i asked for"*.
      Ref: `shots/user-library-flush.png`

      The original ask: *"make entire library building a bit recessed so there
      like a courtyard public 3rd space area."*

      Pull the whole library mass back from the facade line. It already stands
      shorter than its neighbours on purpose — the block grew past it and left
      it behind — and setting it back extends exactly that idea. Fill the notch
      with a real public space, not an empty slab: paving that is not the
      sidewalk texture, the existing steps rebuilt to suit the new depth, a
      bench or two, a tree or planter, a bin. It should read as somewhere
      people sit at lunch.

      In the screenshot the payphone and a street tree stand directly in front
      of the library doors, on the sidewalk. Once the mass moves back they are
      in the middle of your courtyard. The payphone belongs to `ct/props.ts`
      (builder B) — do not move it yourself; work out where it should go and
      tell the desk.

      Constraints: the 2 m walking lane past it is sacred (`GOTCHAS.md` §9), so
      leave the mouth of the courtyard clear and keep every collider off the
      sidewalk lane. Paving must ABUT the sidewalk exactly, never overlap it
      (§6) — an overlap here will z-fight. **Walk it** before you close this:
      along the street, into the courtyard, and back out.

- [ ] **Church buttresses foul the lancet windows.** The user: *"pillars of the
      church seem not fully thought out. they block the windows i think?"*
      Ref: `shots/user-churchpillars.png`

      Two separate faults, and you should fix both:

      1. **Overlap.** The lancets are PAINTED into the nave texture at
         `NW * 0.19` and `NW * 0.81`; the buttresses are REAL boxes at
         `gxm ± 3.4` and `gx0 + 0.5 / gx1 - 0.5`. Nothing reconciles the two —
         one is in texel space, the other in metres, so they were never
         guaranteed to miss each other and they don't. Derive both from the
         same numbers: decide the bay centres in metres, place the buttresses
         BETWEEN bays, and compute the lancet texel positions from those same
         metres. That is the real fix; nudging a constant is not.
      2. **They die in mid-air.** A buttress runs 0 → 12.5 m and gets a flat
         0.45 m slab cap partway up a blank wall. A real one steps back in two
         or three stages as it rises, each stage capped with a sloped
         weathering, and it either lands under the eaves or carries a pinnacle.
         Give it stages. It is the thing that makes the silhouette read gothic.

      Verify from the ground looking up — that is the angle the user sent — and
      also from straight on, where a symmetric fault hides.

## Next

- [ ] **GOLDEN ACES roof sign floats.** It sits on a short mast that ends in
      clear air above and in front of the roofline, attached to nothing. The
      user: *"the sign up top is completely floating. make sure for stuff like
      this we pay more attention."* Ref: `shots/user-floatsign.png`

      Sit it on the building: a parapet or a low roof deck under it, then a
      visible steel frame — two raked legs and a cross-brace — landing on that
      deck. A 1997 rooftop sign is a billboard hung in a frame, and the frame
      is half of what makes it believable. Check the silhouette against the sky
      from the street, which is the only place it is ever seen from.

- [ ] **HOTEL ORPHEUS and GOLDEN ACES facades want more detail.** Right now
      both are flat brick + a painted band + rows of identical windows. They
      are the two biggest buildings on the corner and they carry it, so they
      should reward looking at. Ideas, take what serves:
      · a canopy or marquee over the hotel entrance, with a soffit
      · sills and lintels that project, not painted rectangles
      · a cornice at the parapet with real depth
      · fire escape on one flank
      · window variety — some blinds down, one AC unit, one lit
      · the casino gets neon that reads as tubes, not painted stripes
      Match the house style: ~8 px/m, muted 1997 palette, no dither on any face
      thinner than ~0.3 m (`GOTCHAS.md` §4). Two failures then delete (§ the
      working rules) — if a detail misses twice, take it out and say so.

## Done

_(nothing yet — you are new)_
