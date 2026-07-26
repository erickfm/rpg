# Queue — builder C  ·  worktree `../rpg-entrance`  ·  port 4180

**Owns:** `ct/apartment.ts`, `resGroundTex` in `ct/tex-world.ts`
**Desk writes this file. Do not edit it.**

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

Rebasing per item is not optional. Builders drifted 85–91 commits behind
mainline before landing today, and every hand-resolved conflict came from that
staleness. Rebasing at the start of an item is nearly free; rebasing after an
hour of work is where the conflicts live.

## DESK RULINGS — 2026-07-25 · three things you have been waiting on

**1. `ct/lot.ts` is YOURS.** Recorded in `OWNERSHIP.md`, not just in practice.
You have been editing it all week and every one of its tasks routes to you;
`ownership.sh C` was clearing your edits by default rather than by decision.
That is fixed.

**2. Bounded mandate on `ct/ctx.ts` and the Frame assembly in `crosstown.ts`**
— for exactly two fields and nothing else. This is the same shape of mandate
that produced `ctx.seat()`, `ctx.site()` and `ctx.ground()`.

```ts
// ct/ctx.ts
/** move the game clock forward, in minutes. For anything that costs TIME —
 *  sleeping, a long wait, a bus you let go past. */
advanceTime: (minutes: number) => void;

/** how wet the GROUND is (0…1) — lags rain, dries slower than it wets */
wet: number;          // on Frame, beside `night`
```

wired in `crosstown.ts` to `totalMin += minutes` and to
`scene.userData.wetness ?? 0`. F published the exact `wet` patch in your own
blocker file; take it. Land the two fields **alone**, in one commit, before
the sleep verb — G's hotel wants `advanceTime` too and should not wait behind
your bed.

Do not widen the mandate. Anything else in `ctx.ts` or `crosstown.ts` still
comes back to me.

**3. The two decisions inside "sleep in your room", both yours to build to:**

- **Sleep until morning — snap to 07:00**, not a fixed eight hours. Your
  reasoning was right: it makes the verb mean something at any hour.
- **No fade.** Jump the clock. A full-screen overlay is HUD work and it is not
  worth blocking a gameplay verb on; if the jump reads badly once you can walk
  it, tell me and I will route the fade separately.

`reach.mjs` reporting the world unwalkable from your spawn change is filed to
AUDIT — not yours, and thank you for catching that it exits 0.

## Now

- [ ] **The office chairs face the wall.** The user: *"the chairs are
      backwards"*. Ref: `shots/user-lotchairs.png` — the blue and orange
      chairs outside the CROSSTOWN AUTO SALES office are turned so a person
      sitting in them would face the building.

      **Do this with the car-row rotation, in one commit** — it is the same
      fault twice in the same file. Chairs outside an office face OUT: at the
      lot, at the cars, at the street. Nobody waiting to hear about their
      credit sits facing a wall a metre away.

      While you are there, they are also both dead straight and perfectly
      parallel, which reads as placed rather than used. Two plastic chairs
      outside a portacabin would be at slightly different angles, one pushed
      back further than the other. Vary them.

      And check they are registered with `ctx.seat()` — if the user tries to
      sit in a chair that is visibly a chair and cannot, that is worse than
      not having it.

- [ ] **The left row of cars faces the wrong way.** The user: *"cars facing
      wrong way on left side of car lot"*. Ref: `shots/user-lotfacing.png`.

      In the shot the LEFT row presents tailgates and rear lights to the drive
      aisle while the RIGHT row presents noses. A lot displays stock
      **nose-out toward the aisle** — that is how a customer walking in reads
      the cars, and it is also how they drive out. Both rows should present
      their fronts.

      **The likely cause is worth naming, because this project has hit it
      three times now in different clothes.** A row on the far side of an
      aisle is not a copy of the near row — it is a MIRROR of it, so its
      heading must be rotated 180°, not reused. If both rows are laid out from
      one loop with a shared yaw and only the x offset flipped, the far row
      comes out backwards by construction. That is exactly the defect that
      made the interiors disagree with their facades (`GOTCHAS.md` §22 area,
      and the descriptor work): **handedness is not preserved when you mirror
      a layout, and code that copies rather than reflects will always get the
      second one wrong.**

      So fix the rotation at its source rather than adding 180° to one row as
      a constant — derive each car's heading from which side of the aisle it
      is on, so a row added later cannot come out backwards.

      The rest of the lot reads well: WE FINANCE ANYONE, the CALL 555-0199
      banner, the office, the TODAY ONLY sandwich board, the cone, the
      bunting and the salesman all land. This is one rotation.

- [ ] **The lot: fix the floating signs, let me walk in, and lay it out
      properly.** The user: *"i like the feel and the vibe, i dont like the
      execution why is there just signs floating? also why can i not walk in.
      i would like lines of cars on the right and left as i enter with the
      actual office in the back of the lot"*. Ref: `shots/user-lot3.png`.

      **The vibe is approved.** The pole sign, the bunting, the banner copy,
      the palette — all of it lands. Everything below is execution.

      **(a) The banners float because there is nothing behind them.** SE HABLA
      ESPAÑOL, $99 DOWN, NO CREDIT NO PROBLEM and BUY HERE PAY HERE are
      hanging in mid-air at head height with no fence behind them. The brief
      said *zip-tied to the chain-link* and the chain-link is not there — so
      build the fence first and hang the banners ON it. A banner is a limp
      vinyl sheet cable-tied at its grommets: it needs the fence to exist, it
      should sag slightly between ties, and its top edge should sit just below
      the fence's top rail. Same for the bunting: string it between real
      posts, not through the air.

      **(b) I cannot walk in.** This is the curb cut and gate from the last
      brief, and it is still the thing that makes the lot make sense. A
      pedestrian must be able to enter, and a car must be able to leave.
      Check the collision after — the fence should stop you everywhere EXCEPT
      the opening, and the opening must be wide enough to pass comfortably
      (the capsule is 0.72 m across; give it far more than that, it is a
      vehicle entrance).

      **(c) The layout, exactly as the user described it.** They have given
      you the plan, so build that plan:
      · a **drive aisle straight in from the street entrance**, running to the
        back of the lot
      · **rows of cars flanking it left and right**, nose-in or nose-out but
        consistent, receding toward the back — this is what makes the 23.2 m
        of depth read, and it is why the lot currently looks flat
      · the **office at the BACK of the lot**, not at the front corner. That
        is where it belongs: you drive in past the stock and the office
        watches the whole lot. It also means the office is a destination,
        which gives the depth a reason to exist.
      · that back wall is currently a tall blank brick face — with the office
        against it and cars in front, it stops being the problem it is now,
        but check it still reads once the layout changes.

      Cars remain builder H's: ask the desk for what you need rather than
      building your own.

- [ ] **Let me close the 301 door, and the poster reads as nothing.** The
      user: *"i want to be able to close this door and also what is this
      poster on the wall?"* Ref: `shots/user-301door.png`.

      **(a) A closable door.** 301's door stands permanently open, which is
      why the room never feels like YOUR room — being able to shut it is most
      of the difference between a room and a corridor you happen to be in.
      Make it an `[E]` interaction: *close the door* / *open the door*, with
      the leaf swinging between the two and the collider following it. Things
      to get right:
      · the leaf must not clip the jamb or the wall at either end of its
        travel, and it must not close ON the player — check the swept volume
      · while shut it should block the doorway, so a closed door is actually
        closed
      · sound is out of scope, but the state should persist while you are in
        the room rather than resetting when you look away

      Ship this for 301 first, on its own. **A shared door capability probably
      belongs in the kit** the way `ctx.seat()` and `ctx.spot()` do — every
      interior has doors and builder G's four rooms will want the same thing.
      Say so in your handoff and the desk will queue it to F rather than
      having four builders each write a door.

      **(b) The poster is unidentifiable.** An orange field, a yellow disc, a
      cross, two white bars. *"What is this"* is now the fourth time that
      phrasing has been used on this project and it has meant the same thing
      every time: the object is drawn but not READABLE.

      Decide what it actually is and draw that. A 1997 bedroom wall wants
      something specific — a band flyer, a movie poster, a team pennant, a
      travel poster nobody has taken down, a flyer for a club night. Then draw
      it to read at the size and distance it is seen from, which for a poster
      on the far wall of a small room is quite small: one strong shape, one or
      two colours, and legible-looking text blocks rather than actual words.
      If it will not read, take it off the wall — two failures then delete.

- [ ] **Register any seats in the car lot with `ctx.seat()`.** `ct/lot.ts`
      registers zero. The user has just reported not being able to sit on the
      library's benches, which had the same cause — the object was built
      before or alongside `ctx.seat()` and never connected.

      If the lot has a bench outside the office, a chair by the door, or a
      stack of tyres someone would sit on, wire them. If it genuinely has no
      seating, say so and this closes — but a used car lot with somewhere to
      wait while they "run your credit" is very much in period.

      Read how `ct/park.ts` calls `ctx.seat()` rather than inventing the
      arguments; it is builder F's API.

- [ ] **The car lot must MAKE SENSE, and then be properly sleazy.** The user:
      *"i like the triangles but it also just looks low effort do a high effort
      sleazy used car lot. make it make sense like how does one even enter,
      drive a car off the lot. do some research into what old sleazy used car
      lots looked like"*. Ref: `shots/user-lot2.png`.

      The bunting is approved. The problem is that the lot currently has no
      LOGIC — and that is what reads as low effort, more than any missing
      prop.

      **Part one: how does a car get on and off?** This is the question the
      user asked and it is the one that fixes the whole thing.
      · a **curb cut** — a break in the kerb where it drops flush to the road,
        with a flared apron. Without this, cars cannot physically leave, and
        the eye knows it even if it cannot say why.
      · the **sidewalk crosses the driveway**, so the paving changes there:
        the walk ramps down over the cut and the scoring runs across it. A
        dropped kerb with the pavement running unbroken over it is wrong.
      · a **rolling chain-link gate** on the cut, standing open in the day,
        with a chain and padlock hanging off it. At night it should be shut.
      · a **drive aisle** behind the front row, so the cars in that row can
        actually get out. Rows of cars packed with no aisle is the tell that
        nobody thought about it.
      · cars parked **nose-out, angled toward the street** — that is how a lot
        displays stock, and it also means they can drive straight out.

      **Part two: the sleaze, and it is specific.** A 1997 buy-here-pay-here
      lot has a vocabulary. Take as much as the space carries:
      · **Vinyl banners zip-tied to the chain-link**, sagging between ties:
        BUY HERE PAY HERE · NO CREDIT? NO PROBLEM! · $99 DOWN · WE FINANCE ·
        SE HABLA ESPAÑOL · TEST DRIVES WELCOME
      · a **tall pole sign** at the kerb, taller than the building beside it,
        with a name — HONEST ED'S, EZ AUTO SALES, AUTO WORLD — and a phone
        number in digits far too big
      · **the FTC Buyers Guide sticker**: a white-and-yellow rectangle taped
        inside the side window of EVERY car. Legally required on used cars
        since 1985, so its absence is what would look wrong to anyone who was
        there. It is the single most authentic detail available here.
      · windshield **soaped prices** and **starburst cards** — already queued,
        still the centrepiece
      · **balloons tied to radio antennas**, a couple deflated
      · a **portacabin office** with a window AC unit, a satellite dish, a
        desk light on, and vertical blinds
      · **chain-link with privacy slats** on the back and side runs
      · a **flagpole**, and a floodlight on a pole for after dark
      · **oil stains** in the bays, weeds in the asphalt cracks, one bay empty
        where a car sold
      · one car **up on a jack** with a wheel off, one with the **hood open**
      · a **tyre stack** and a couple of traffic cones

      **Do the research the user asked for** rather than working only from
      this list — period photographs of buy-here-pay-here lots will give you
      details neither of us thought of, and the user explicitly asked for it.

      Cars are builder H's: ask the desk for the variants (hood up, on a jack,
      a wheel off) rather than building your own. Nothing may encroach the
      sidewalk (`GOTCHAS.md` §9) — the auditor is sweeping the block for
      exactly that right now, so keep the fence, banners and pole sign behind
      the line.

- [ ] **The car lot: deeper, and go all-in on the detail.** The user:
      *"car lot needs to be deeper. i like your initial aesthetic but i want
      it refined and a try hard version of it. get the typical car price signs
      yknow?"*

      **The aesthetic is approved — this is not a redraw.** They like what you
      built. This is depth plus density of detail on top of it, which is a
      much better position to be in than the church or the lamp glow were.

      **Deeper.** Same note the park just got: 23.2 m of frontage with only
      building depth reads as a gap in the wall rather than a place. A car lot
      wants to run BACK — rows receding, so you see cars behind cars and the
      back of the lot is a different space from the street edge. Coordinate
      with D through the desk on how far back it can go; beyond the facade
      line is ground the player has never seen, so whatever closes the far
      side has to be real.

      **The price signs — this is the request inside the request.** The
      windshield price card IS the icon of a used car lot, and there is a
      specific vocabulary to get right:
      · **soaped or paint-pen numbers directly on the windshield**, big,
        hand-drawn, slightly wonky — `$1995`, `$2495`, `$899`
      · **starburst cards** propped inside the glass — the sunburst outline
        with a price in the middle
      · a few with **"AS IS"**, **"RUNS GREAT"**, **"1 OWNER"**, **"SOLD"** on
        one
      · prices should be **period-correct and cheap** — three and four figures
        in 1997, and ending in 95 or 99 far more often than round numbers
      · vary them: not every car is carded, one card has slipped down

      **Try-hard, as asked.** Pile the detail on: pennant bunting in two
      colours strung between poles and sagging between them, a floodlight on a
      pole, an inflatable or a banner, a sandwich board at the gate, tyre
      stacks, a hose coiled by the office, oil stains where cars have stood, a
      mirror-polished one at the front and a rough one at the back, one car
      with its hood up. A lot that looks TRIED reads as a business; a tidy one
      reads as a car park.

      Cars are still builder H's — ask through the desk for variants (hood up,
      up on blocks, a convertible) rather than adding your own.

- [ ] **Build the used car lot.** New file, `ct/lot.ts`, yours — the same
      relationship to `ct/street.ts` that `ct/civic.ts` and `ct/park.ts`
      already have. The user: *"turn hardware and cafe into a used car lot"*.

      You get this because you have capacity and it is self-contained. Builder
      D is clearing the ground: CAFE and HARDWARE come out of the EAST roster,
      leaving a **23.2 m frontage at the north end of the east side**. D
      reports the exact z-span through the desk — wait for it and use the real
      number rather than anything in this brief.

      A 1997 used car lot is one of the loudest things you can put on a
      street, and that is the point of it:
      · **asphalt, not grass** — cracked, patched, oil-stained, with faded
        painted bays
      · **chain-link fence** along the street line with a gate, and pennant
        bunting strung above it — the triangular plastic flags are the single
        most identifying thing about the whole typology
      · a **small office**: a portable cabin or a one-storey box with a big
        window, a desk visible inside, a hand-lettered sign
      · **stock in rows**, angled toward the street, with **windshield price
        cards** and soaped numbers on the glass
      · a pole sign, and banners — AS-IS, EZ CREDIT, NO MONEY DOWN
      · a single floodlight on a pole for after dark

      **Coordinate rather than duplicate:**
      · **cars belong to builder H** (`ct/cars.ts`). Do not build your own —
        H already exports the fleet and the parked-car machinery. Ask through
        the desk for what you need, and say if you want a variant (a car up on
        blocks, one with a hood open) rather than adding it yourself.
      · **it must read differently from the park.** E is building a 30 m park
        on the west side at the other end of the block. Two open lots on one
        street will invite comparison: the park is green, quiet and civic; the
        lot is asphalt, loud and commercial. Lean into that contrast.
      · benches or seats should use **`ctx.seat()`** — builder F has landed it
        with 29 seats already using it. Do not build a sit mechanic.
      · the lot must be **walk-into-able** and the 2 m sidewalk lane past it
        stays clear (`GOTCHAS.md` §9). Walk it before you close this.

- [ ] **Nothing queued — your whole queue landed** (`0e2e29f`, `1ce9cf5`,
      `3e2ea73`): [E] spots moved out of the entry point, and 301 furnished.
      Report to the desk. If you want work while you wait, walk the walk-up
      end to end — stoop, stairs, landings, 301, the hermit's floor — and
      write what is wrong to `notes/C-entrance-report.md` rather than fixing
      it. You own that building; a quality pass on it is a good use of time.


## Done

- [x] Hermit: clipped, too clean, grime (`bd3a241`)
- [x] Paper-thin walls — jambs at every interior opening (`bd3a241`)
- [x] 301 door leaf (`bd3a241`)
- [x] Ceiling lamps — period flush-mount, stepped glow (`28b521d`)
- [x] `[E]` spots registered from apartment.ts, not the entry point (`0e2e29f`)
- [x] Furnish 301 — somebody's room, not a hotel room (`1ce9cf5`)
- [x] Entrance bay: brick continuous, nameplate removed, stoop dressed
- [x] Steeper stairs at 31.5°, floor-picker re-derived, walked up and down
- [x] One continuous handrail with goosenecks at the turns
- [x] Basement stairwell opened under the stairs and padlocked
- [x] Wider doors — 0.90 m leaf
- [x] Door numbers texel-aligned, plate toned to brass
- [x] Hermit given the 8-angle `citizenAtlas` treatment
