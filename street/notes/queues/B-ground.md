# Queue — builder B  ·  worktree `../rpg-ground`  ·  port 4178

**Owns:** `ct/props.ts`, `ct/tex-ground.ts`
**Desk writes this file. Do not edit it.**

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

> **Desk apology, 2026-07-24.** This file was stale for hours: it still listed
> the lighting tint, the van, the bus bench and the parking variance as
> pending when all four had already landed on mainline, and it opened with a
> "get green" blocker that no longer existed. You reported that; you were
> right. The desk was routing new work into a file it had stopped maintaining,
> and told the user you were blocked when you were not. Rebuilt below from
> what is actually on mainline.

## Now

> ## DESK RULING — 2026-07-25 · `isSelfLit` NEEDS AN OPT-OUT. This is the top
> item in your queue, above everything below it.
>
> **The user's request this serves, in his words:** *"make the unilluminated
> stuff darker. it should feel scarier at night i want to be able to see stars
> sometimes"* — and separately, *"needs to be darker at night"*.
>
> `props.ts`'s `isSelfLit` calls any sheet with >8% bright-saturated texels a
> light source and pins it at full daylight. C has measured what that costs,
> twice, and it is not a corner case:
>
> ```
>   39 printed sheets in the car lot alone hold FULL daylight brightness
>      after dark. Hot fraction 8.6% .. 97%, against an 8% threshold.
>      97.0%  a windshield price card
>      85.3%  THE POLE SIGN the user just had us make legible
>      80.7%  a fence banner
>   2 citizens (the lot salesman, the walkup hermit) — same cause
> ```
>
> Seen, not only computed: `shots/lotpass/10-night-aisle.png`, price cards and
> signboards glowing over a black yard, and
> `shots/banner-night/01-pavement-south-run.png` from the pavement where a
> player actually walks — banners at full daylight on a fence that is deep in
> shadow.
>
> **The heuristic is not wrong about what it can see.** Printed artwork in
> saturated ink and a neon sign are identical in texels; they differ only in
> whether anything is behind them, which a texture cannot show. So the fix is
> not a better threshold — it is letting the owner declare what a material IS,
> the same shape as `ctx.wet()`.
>
> **Build:** a userData flag on the material — *printed, not lit, grade me* —
> that `isSelfLit` honours before it looks at pixels. Name it whatever fits
> `props.ts`; publish the name in a note the same commit so C can apply it to
> ~40 sheets and H to the citizens in the round after.
>
> **Do not** repaint anyone's artwork to slip under the threshold. C tried
> that first and was right to stop: the palette is the user's and approved in
> as many words, and the pole sign was enlarged and re-contrasted **for
> legibility from the far kerb** — trading that back for night grading is the
> wrong trade. The one 8.6% sheet that could be nudged is not worth a second
> undocumented workaround.
>
> C's citizen diagnosis in `BLOCKED-C.md` was withdrawn and corrected by C
> itself — it is not a missing `lit` in the module context, it is this same
> heuristic. Two blockers, one cause, one fix.
>
> `scripts/mods-dim.mjs` is written and works and stays unregistered until
> this lands. Tell C when it is in.

> ## DESK RULING — REMOVE STANDING PUDDLES. Written here so it survives.
>
> `shots/user-puddlebad2.png`: the puddle is a PALE smear, lighter than the
> surface around it, soft-edged, and straddling the kerb line. That is the
> glowing puddle the user rejected twice, plus the footprint fault, in one
> object.
>
> **This is the fifth attempt.** Buried under the pan → invisible from contrast
> inversion → moved to the gutter → a dark band down the sidewalk → this. When
> I approved your reflection recommendation I said plainly: one more pass at
> the simplest version, and **if it misses, remove standing puddles entirely
> and keep only the wet sheen on the road**, which the user has never once
> complained about.
>
> It missed. So remove them.
>
> Take out the standing puddle meshes. Keep everything else in the weather
> system — the wet-look darkening, the wetness that outlasts the rain, the
> rain itself, the wet walls. Those are all confirmed and liked.
>
> This is not a failure of your work; your contrast-inversion diagnosis was the
> best piece of debugging on this project. It is a feature that has cost five
> passes and never once landed, and the honest thing is to stop paying for it.
> Say so in your handoff so nobody re-adds them.
>
> If you believe a sixth attempt would land, tell me your specific reason and
> I will take it back to the user rather than overrule you — but do not simply
> try again.


- [ ] **Bench pass four: the bezel is eating the ad, and the legs are
      coplanar with the seat.** The user: *"it should not be cutting off the
      actual ad for tonys pizza also theres some strange graphical bug on the
      legs you see its like the same plane as the wood probs should have the
      leg do that clip through the wood"*. Ref: `shots/user-bench5.png`.

      · **The bezel overlaps the artwork.** TONY'S PIZZA is clipped at the top
        by the frame, and the red band runs under it. A bezel FRAMES a panel —
        it sits outside the artwork, and the artwork is INSET within it. So
        shrink the ad face to fit inside the frame rather than laying the
        frame over a full-bleed ad. All four sides need the same clear margin,
        and the copy needs a little breathing space inside that again: the
        phone number and TWO SLICES $1.75 should not touch the frame either.
      · **The legs are drawn in the same plane as the seat slats.** They read
        as dark bars painted across the wood rather than as legs under it —
        that is coplanar geometry, and it is the z-fighting condition this
        world has hit before (`GOTCHAS.md` §6: coplanar surfaces must ABUT,
        never overlap). The leg is a separate solid: it belongs BELOW the seat
        and slightly inboard, so the seat visibly rests on it and you can see
        the joint. Offset it in depth so nothing shares a plane with the
        slats, then look along the bench from a low angle where coplanar
        faces show worst.

      This is the fourth pass on the bench. Everything the user has asked for
      is still wanted — ad on the back, reclined back, no lower slats, a bezel
      — so this is not a redo, it is finishing. But look at the whole object
      from three angles before you call it done rather than fixing only what
      is in the shot; that is what has made this take four passes.

- [ ] **Bench, third pass: drop the lower slats and put a bezel on the ad.**
      The user: *"make this look nicer, i dont think we need the bottom wood
      part. also the tonys pizza part i think needs to have a bezel"*. Ref:
      `shots/user-bench4.png`.

      The ad is on the backrest now and the back leans — both right, and the
      bench reads far better for it. Two refinements:

      · **Delete the lower slatted section under the seat.** It is doing
        nothing structurally or visually, and it makes the bench read as a
        heavy box rather than a seat on legs. A bus bench is a seat, a back
        and legs — you should be able to see UNDER it, and the gap under a
        bench is most of what makes it look light. Removing it also opens
        sightlines along the pavement, which matters given how much the user
        cares about the lane.
      · **Give the ad panel a bezel.** It is a flat printed face flush with
        the backrest, so it reads as paint rather than as a sign. A real bus
        bench ad is a panel MOUNTED in a frame: a raised border on all four
        sides, a little proud of the backrest, ideally in a different material
        from the panel — dark metal or moulded plastic against the cream face.
        Keep it thin; a heavy frame at this scale will eat the copy.

      With the lower slats gone, check the leg geometry still reads as
      supporting the seat, and re-sit on it — it is registered with F's
      `ctx.seat()` and you have now changed the back angle and the mass under
      the seat.

- [ ] **The side street has no lamps — builder H is blocked on you.** H
      extended the trees, kerb and parked cars east along the side street as
      asked, but lamps are `ct/props.ts` and it correctly did not reach into
      your file. So the side street goes fully dark after sunset, which
      undermines the night work you have spent all evening on: the user asked
      for a scarier night with pools of light to contrast against, and a
      stretch with no lamps at all is not contrast, it is absence.

      Carry the lamp line east along the side street with the same falloff H
      used for the trees and cars — thinning with distance, not stopping dead.
      Register them with `props.lit` so they pool the same way the main
      street's do, and check the far ones do not fight the fog.

- [ ] ~~Move your `[E]` spots out of `crosstown.ts`~~ — **VOID, you were
      right.** Your blocker note says there is nothing left of yours to move:
      the two remaining hand-written entries are the bodega counter, which is
      D's and is tracked in D's queue. Item retired; do not spend time on it.

- [ ] **Puddles: STOP and simplify. This is the fourth attempt.** The user:
      *"also i think these are puddles and they look awful honestly"*. Ref:
      `shots/user-puddlebad.png`.

      What is on screen is a long dark band running down the MIDDLE of the
      sidewalk with pale grey dashes scattered inside it. It reads as a
      texture fault or a smear — not as water.

      Two things went wrong and the second is the desk's fault:
      · the desk said *"a ribbon along the kerb line"* meaning **in the gutter
        pan**, and it has been applied to the **sidewalk**. Water does not
        pool down the centre of a pavement; it runs to the low point, which is
        the pan you built.
      · the pale dashes inside the dark band are presumably highlights, and at
        this density they read as debris or as z-fighting rather than as
        specular. Whatever they are, they are not helping.

      **The history matters now.** Puddles have been: buried under the pan
      (fixed), invisible from contrast inversion (diagnosed, well), moved to
      the gutter, and now this. That is four passes on one feature and the
      user has never once liked what they saw.

      **So the desk's decision: take one more pass, and make it the SIMPLEST
      possible version.** No ribbons, no highlight dashes, no sidewalk water.
      Just a few discrete dark patches sitting in the gutter pan where water
      actually collects, darker than the wet road around them, no speckle.
      If that still misses, **remove standing puddles entirely** and keep only
      the wet sheen on the road surface, which the user has never complained
      about — and say so in your handoff. A feature that has missed five times
      is costing more than it is worth.

- [ ] **The milk crate is clipping into the shopfront.** The user: *"trash
      cannot be clipping through stuff like this"*. Ref:
      `shots/user-crateclip.png` — it is half inside the brown band at the
      base of the shopfront.

      Your footprint fix tested against the GROUND surfaces (road, gutter pan,
      walk). It does not test against **buildings**. So an object placed near
      a facade resolves its height correctly and then intersects the wall,
      the stallriser or the fascia standing proud of it — and builder A has
      just made those project further, so there is more to hit than there was.

      Placement needs to respect solids as well as surfaces: before placing,
      check the object's footprint against the collider set and push it clear.
      The colliders are already registered per-footprint by D, so the data is
      there. Same test everywhere you place: litter, tree pits, the bench,
      anything that sits on the ground near a wall.

- [ ] **Move TONY'S PIZZA onto the bench BACK, and recline the back a little.**
      The user: *"i think the tonys pizza sign should go on the back of the
      bench also i think the bench back should lean back a lil"*. Ref:
      `shots/user-bench3.png`.

      The bench is much better since your rebuild — it faces the road and sits
      at the kerb beside its pole. Two refinements:

      · **The ad is on the front skirt panel, under the seat.** It should be on
        the BACKREST, which is where a real bus-bench ad lives — it is the
        biggest flat face on the object and the one people actually read. Move
        the whole thing across: TONY'S PIZZA, the phone number, TWO SLICES
        $1.75. The skirt below the seat then goes back to being plain slats or
        a plain panel.
      · **Give the backrest a recline.** It is dead vertical now, which is why
        it reads as a board rather than a seat. Ten to fifteen degrees off
        vertical is enough — it should look like something you would lean
        against. Keep the slats.

      Two things to check once it leans:
      · the **seat and back must still meet cleanly** at the joint — a
        reclined back that leaves a gap at the seat is worse than a vertical
        one
      · **the sit position** — `ctx.seat()` is F's and the bench is
        registered with it. A reclined back changes where a seated player's
        eye should be and which way they face. Sit on it after you change it.

      Keep the ad copy exactly as it is; the concept was approved a while back
      and the phone number and slice price are good.

- [ ] **Night: wider beams, darker darks, and STARS.** The user: *"make street
      light a bit more broad in their emitted light (like a wider beam) and
      make the unilluminated stuff darker. it should feel scarier at night i
      want to be able to see stars sometimes."*

      This is the fifth pass on night and the user keeps coming back to it,
      which means it matters more than most of the queue. Read the whole ask
      as one idea rather than three tweaks: **they want more contrast, not
      more light.** Wider pools and darker gaps push in the same direction —
      bigger islands of warmth in a bigger sea of dark — and "scarier" is what
      that combination produces.

      · **Wider beam.** `LAMP_R` and the falloff currently give a small tight
        disc. Widen the radius and soften the shoulder so a pool reaches
        further and fades out over a longer distance. A real sodium lamp lights
        a stretch of pavement, not a spot. Keep the centre where it is; it is
        the edge that needs to travel.
      · **Darker darks.** Take `FLOOR_GROUND` (0.07) and `FLOOR_HIGH` (0.06)
        down further, and reconsider `FLOOR_LOW` (0.30) — that band is still
        four times the road, and you noted yourself it had quietly become the
        brightest thing left. **Lit windows and signs must NOT come down with
        it** — they are the reward for the street going dark, and they are
        also most of what will still read once the ambient is near zero.
      · **Fog at night should go toward black, not grey.** A grey fog on a
        dark street is a glowing wall at the end of it; near-black fog is what
        makes a street feel like it continues into something.

      · **STARS.** Only on clear nights — never while it is raining, since you
        own `rainLevel` and can gate on it. Fade in as night deepens and out
        at dawn on the same curve the rest of your night work uses. Keep them
        in your own module: a star field can be a texture on the sky or a
        points cloud, and either way it does NOT need `crosstown.ts` — the
        sky colour is computed there and `props.rainSky` already nudges it, so
        add the field from `ct/props.ts` and let it read the same night value.

        Draw them in the house style: hard single texels, a handful of
        brighter ones, no smooth glow — the lamp halo already taught us what a
        soft gradient looks like in this world. And **not too many.** This is a
        city with sodium lamps; you would see a scattering, not a planetarium.
        A dozen or two that you notice when you look up beats a dense field.

      This is a big visual change to a thing that has already been reverted
      once — **land it in pieces**, not one commit. Beam width first, then the
      floors, then the stars. If any step comes back worse, you have a clean
      revert point rather than an all-or-nothing.

- [ ] **Tree pits need clearance from the kerb, and puddles belong IN the
      gutter.** The user: *"i dont like how close the tree bases are to the
      edge here i think ideal would be with a bit of clearence on the curb
      side. also the puddle doesnt make sense here. the gutter should have the
      water in the gutter."* Ref: `shots/user-pit-puddle.png`.

      **Both are the footprint rule from the item below**, so do them in the
      same pass — this is the same defect on two more objects, and treating it
      as one job is how it stops recurring.

      **The tree pit.** Its stone frame runs right up to the kerb with no
      strip of walk between them, which is why it reads as crowding the edge —
      and your own report already flagged the related fault, that pits
      overhang the kerb chamfer by ~6 cm. Real street trees sit inboard with a
      continuous band of pavement between the pit and the kerb, because that
      band is where the kerb is walked on, swept and parked against. Give it a
      real clearance — a slab's width reads best, and it should be consistent
      pit to pit rather than varying. Check the trunk lean too: the tree can
      lean over the kerb even when the pit does not, and the canopy already
      has a hard limit at the facade (`GOTCHAS.md` §9).

      **The puddle.** Water runs downhill to the lowest point, and you built
      that low point yourself — the gutter pan cross-slopes from 0.018 at the
      asphalt joint down to 0.006 at the kerb. So the gutter IS where water
      collects, and a puddle spreading across the walk is wrong twice: wrong
      physically, and wrong because the sidewalk is where the player walks and
      the gutter is where they look.

      Constrain puddle placement to the pan and the road's low spots: they
      should read as a ribbon along the kerb line rather than as discs
      scattered anywhere. Where one does sit on the walk it needs a reason —
      a dip, a broken slab, under a downpipe or an awning drip line — and it
      must not cross the kerb edge. Same footprint test: sample the corners,
      never straddle the discontinuity.

      This also gives you the answer to the visibility problem you diagnosed.
      You noted that every street puddle sits in the 45 cm gutter strip where
      nobody looks — the fix is not to scatter them onto the walk, it is to
      make the gutter worth looking at: a longer continuous ribbon of standing
      water along the kerb reads far better than isolated patches, and it is
      what a real street does after rain.

- [ ] **Litter clips into the kerb. Placement must respect the object's
      FOOTPRINT, not just its centre.** The user: *"dont like when the trash
      clips like this we need to be better about our graphics"*. Ref:
      `shots/user-trashclip.png` — the fountain cup is half inside the kerb.

      This is the third generation of the same bug and it is worth naming so
      it stops recurring. First the decals were laid at one flat `y` and ended
      up **under** the gutter pan. You fixed that with `surfaceY(x)`, which
      samples the height **at a point**. Now the litter is 3D solids with real
      extent, and a point sample is no longer enough: the cup is placed near
      the kerb line, its centre resolves to the sidewalk, and the half of it
      that overhangs the drop intersects the kerb.

      **The rule: an object must sit entirely on one surface.** Three
      surfaces meet along that line at three different heights — road 0,
      gutter pan cross-sloped, walk at `sidewalkY` — so before placing,
      sample `surfaceY` at the object's **footprint corners**, not its centre.
      If they disagree, the object is straddling a discontinuity: either move
      it clear of the line by at least its half-extent, or drop it to the
      lower surface and let it sit against the kerb rather than in it.

      Objects resting against the kerb face is a GOOD look — a cup wedged in
      the gutter against the kerb is exactly right — so the fix is not to ban
      the kerb line, it is to place them beside it rather than through it.

      **Sweep every placement**, not just this one: the approved five types
      wherever they are, in the gutter, the alley, by the bins, and anything
      else you place on the ground. And apply the same footprint test to the
      tree pits — your own report flags them overhanging the kerb chamfer by
      ~6 cm, which is the same defect.

- [ ] **Ship the approved trash set and take the rig down.** Five types:
      **1 coffee cup**, **11 fountain cup** (the user confirmed *"i like having
      both cups"* — draw them as clearly different objects, small tapered paper
      vs tall waxed with a lid), **2 folded newspaper** (the reworked
      grimier/thinner one), **4 flattened cardboard**, **7 milk crate**.
      · keep the two old gutter decals the user liked in situ — your report
        established those are not rig candidates
      · delete every placement of the rejected banded rectangle; its outline
        was too heavy and read as a sticker
      · rig out of the alley, rejects stay drawn but unplaced
      · place on `surfaceY(x)`, vary rotation so no two read as copies

## Next

- [ ] **The catch basin looks bad** — user: *"what is this it looks bad"*,
      `shots/user-drain-bad.png`. A large smooth gradient blob on the road
      (same defect as the lamp glow you reverted), a grate that is a black
      void with floating bars, no frame or throat. Staining should FOLLOW THE
      WATER along the gutter into the mouth, not sit symmetrically. If the
      stain cannot read at this density, delete it and let the casting do it.

- [ ] **The bus bench is backwards and nowhere near the stop.** User: *"like
      the back of the bus is in the front? doesnt make sense"*,
      `shots/user-bench2.png`. The backrest barely rises above the seat, so it
      reads as a flat board with a plank in front. Seat ~0.45 m, back ~0.85 m,
      and put the bench AT THE KERB beside the stop pole, facing the road.
      Keep TONY'S PIZZA.

- [ ] **Finish the puddle fix you diagnosed.** The contrast inversion is
      understood and the desk approved your recommendation: an ambient-scaled
      reflection rather than a fixed dark sheet, water where the player
      actually looks rather than only the 45 cm gutter strip, and do NOT ease
      the wet tint (it trades against the night pass). Also raise the rain
      odds and bring the first storm nearer spawn — it is 6 hours in 24 and
      the user has asked about rain four times.

- [ ] **Your own findings, ranked by the desk** — from
      `notes/B-ground-report.md` §"Found, not fixed":
      · **C. the bus stop frontage should be red kerb and is not** — do this
        with the bench item, same place
      · **B. lamp spacing leaves the middle of the block dark** — worth
        fixing, the user has asked about night four times
      · **E. tree pits overhang the kerb chamfer by ~6 cm**
      · **D. parking varies but never re-rolls** — lowest, cosmetic

- [ ] **Move your `[E]` spots out of `crosstown.ts`.** `ctx.spot()` and
      `ctx.player` exist; C, F and H have all done it. Walk each spot after.

## Done

- [x] **Night rounds one to three** — the road was never being darkened; light
      now lands on dark objects and entities; walls catch lamp splash
- [x] **Lamp glow reverted** per the watch precedent, halo re-anchored (`726faa6b`)
- [x] **Rain wets the buildings, not just the ground** (`c0503fd`)
- [x] **Wetness outlasts the rain; puddles crest after it stops**
- [x] **Decals were buried under the gutter pan** (`42bc42b`) — all 8 gutter
      puddles had NEGATIVE clearance and had never once been visible
- [x] **Diagnosed "no puddles during rain" as a contrast inversion** — the
      best piece of debugging on this project
- [x] **The library doors are clear** (`499df04`) — payphone and tree moved
- [x] **Trash rig rounds 1–3**; correctly diagnosed its own round-1 miss
      (judging top-down, a view the game does not have)
- [x] Lighting tint, the van, the bus bench rebuild, parking variance
- [x] Kerb, gutter pan, corner return, catch basin geometry
- [x] `walkTex` split into `ct/tex-ground.ts`
