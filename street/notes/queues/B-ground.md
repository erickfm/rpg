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

- [ ] **Trash rig round 3 — the user wants more to choose from.** *"ok update
      the trash so i can pick some more out."*

      Keep the coffee cup and the newspaper (v2's 3 and 5) — those are
      approved. **Stand them at the head of the line as 1 and 2**, unchanged,
      so the user is comparing new candidates against the bar that already
      passed rather than against each other. Then number the new ones from 3.

      **What the two winners have in common, and it should drive the new
      set.** Look at which of your seven passed and which did not:

          passed   coffee cup (tall, unmistakable outline)
                   folded newspaper (large flat rectangle with a fold)
          failed   crushed can · glass bottle · takeout container ·
                   chip bag · cigarette pack

      The survivors are the two with a **strong simple silhouette at size**.
      Everything that failed is either small, or a soft/ambiguous shape, or
      both. So bias the new set hard toward **large objects with an outline
      you could recognise as a black shape**. That is the actual selection
      criterion here, more than colour or detail.

      Candidates worth drawing, all chosen on that basis:
      · **pizza box** — big, flat, square, instantly readable
      · **flattened cardboard box**, folded and leaning
      · **plastic shopping bag** with handles, half-collapsed
      · **40 oz bottle in a paper bag**, lying down — very 1997
      · **milk crate**, upended
      · **broken umbrella**, ribs showing
      · **phone book**, swollen from rain
      · **bundled newspapers** tied with string
      · **fast-food cup with lid and straw** (taller than the coffee cup, so
        it reads differently rather than duplicating a winner)
      · **paint can**, dented, lid off

      Same rules as v2, which worked: low 3D solids not decals, drawn
      oversized, and **judged from standing eye height at walking distance**
      before you tell me they read. Put the rig back in the alley in the same
      place so the user knows where to look, and tell me the numbering.

- [ ] **Trash rig verdict: ship 3 and 5, take the rig down.** The user:
      *"coffee cup is good, i like newspaper as well, 3 + 5 respectively.
      newspaper needs to be grimier and thinner."*

      Checked against your v2 manifest — **3 is the coffee cup, 5 is the
      folded newspaper**. Those two are approved. The other five are not; the
      user named two out of seven and said nothing about the rest.

      · **Fix the newspaper first: grimier and thinner.** Thinner is
        geometric — it is a folded broadsheet lying flat, so it should be a
        few centimetres, not a slab. Grimier is the surface: grey-brown rather
        than white, wet at one corner, footprinted, the fold darker than the
        faces, ink bled where it has been rained on. It is the one piece of
        litter that has been outside for a week.
      · **Then take the rig out of the alley** and place 3 and 5 through the
        world properly — gutter, alley, under the bench, by the bins, against
        the kerb. Follow the placement rules you already worked out: they sit
        on `surfaceY(x)` so nothing gets buried, and they are not solid.
      · **Keep the other five in the file but unplaced.** Do not delete the
        code. Two litter types is a thin vocabulary and the user may well want
        a third once they see these in place; reviving a drawn candidate is
        minutes, redrawing it is not.
      · Two types repeated everywhere will read as repetition — vary rotation,
        and vary the newspaper's grime and fold so no two are identical.

      Your v2 write-up was the right call and worth saying so: you diagnosed
      your own miss precisely — judging from above, flat being the wrong
      primitive — and the rebuild landed two approvals out of seven from a
      user who could not identify one of fourteen.

- [ ] **REVERT the lamp glow and pool. They are worse than what they
      replaced.** The user: *"street lights look so much worse than they did
      before"*. Ref: `shots/user-lamppool-bad.png`.

      This is the **watch precedent** and the desk is calling it explicitly.
      When a redraw comes back worse, the rule on this project is: *"revert
      back to the old one and slowly add the least risky thing. then we
      iterate."* Do that here rather than tuning what is in the tree.

      `git checkout 3a3013f^ -- src/proto/ct/props.ts` for the glow and pool
      textures only — keep everything else in `3a3013f`, because the rest of
      it is right and the user has not complained about it: light landing on
      dark objects, walls catching lamp splash, and `FLOOR_LOW` coming down
      were all asked for and all work.

      **What went wrong, so the next attempt does not repeat it.** The desk's
      brief said to make the glow *"a stepped/dithered glow in the house
      style"*. That was read as literal dithering and it produced:
      · a **checkerboard ring metres wide** around the ground pool — a 50%
        checker at high contrast across a broad band, which reads as a
        rendering artefact, not as light falling off
      · **hard concentric bands** inside the pool, so it looks like a painted
        target on the road rather than illumination
      · a saturated orange disc that is far more intense than the light it
        is supposed to imply
      · a small round dithered disc at the lamp head that reads as an object

      The house style is hard-edged texels, but hard-edged does not mean
      high-contrast checkerboard. Dither in this world is a subtle break-up at
      low amplitude — look at how `dither()` is used on the walls, which is a
      handful of texels at low alpha, not a 50% checker across a wide band.

      **Then, one change at a time.** Once the old version is back, the single
      least risky improvement is to **anchor the head glow to the lamp head**
      so it stops floating beside it — that was the user's original complaint
      and it is a position fix, not a redraw. Ship that alone and let them
      look at it before touching the falloff.

- [ ] **The trash rig failed its own test. None of the 14 read.** The user,
      looking at the rig you built: *"for all the trash in the alley i cant
      tell what any of it is. these should be recognizable."*

      The rig worked as a process — it got a fast verdict, which is exactly
      what it was for. The verdict is that the whole approach misses, so do
      not iterate on the 14. Change what is being drawn.

      **What I think is actually wrong, and it is not the drawing.**

      1. **You are judging them from above; the player never sees them from
         above.** A flat ground decal viewed from 1.7 m eye height two metres
         away is seen at roughly 15–20° off the ground, which foreshortens it
         to about a quarter of its depth. A shape that is a clear crushed can
         viewed top-down is a 3-pixel smear viewed while standing. Every
         judgement on these has to be made from **standing eye height at
         walking distance** — that is the only view that exists in the game.
      2. **Flat is the wrong primitive for most of them.** Real litter has
         height: a can is 6 cm of cylinder, a takeout box 8 cm, a bottle 6 cm
         across. Give them a little real geometry — a low box or a short
         cylinder lying down — and they gain a VERTICAL face, which is the
         face you actually see when standing. That face is what makes the
         object readable, and a decal has none of it.
         (`GOTCHAS.md` §3 forbids BILLBOARDS on the ground because they rotate
         and stand up. Low 3D geometry is not a billboard and does not have
         that problem — do not confuse the two.)
      3. **Some of these cannot be drawn at any size.** A cigarette end, a
         bottle cap, a torn lottery slip and a crumpled receipt are 2–4 cm
         objects. At this world's density they are one or two texels and no
         amount of care will make them recognisable. Cut them. Litter that
         reads as unidentifiable speckle is what the user is complaining
         about; four fewer candidates that all read beats fourteen that do not.
      4. **Draw them bigger than life.** This is a pixel world and legibility
         beats measurement — the cat is not to scale either, and the user
         liked it. A can at 1.5× reads; at 1× it is a smudge.

      Rebuild the rig with **6–8 candidates**, each with a little height,
      each drawn to read at 15° from standing, each oversized enough to
      survive it. Then walk the alley and look at them the way a player does
      before you tell me it works.

- [ ] **Night, round three — and this time the three complaints are one
      system.** The user, in the same sitting:
      · *"i want night darkness to feel more dark"*
      · *"and for light around the light posts to show up on the objects and
        entities which are under the lights"*
      · *"street lights light effect looks odd btw"* — ref
        `shots/user-lampglow.png`

      Your per-elevation floor model (`FLOOR_GROUND` 0.07 / `FLOOR_LOW` 0.30 /
      `FLOOR_HIGH` 0.06) and `POOL_GAIN` 12 are good work and the road is
      genuinely dark now. What is left is specific, and I think it is these
      four things rather than a tuning pass:

      1. **`LIT_MIN_LUM = 0.22` is why entities under a lamp do not light up.**
         Anything darker than that luminance is skipped by `register()`
         entirely — the comment says it is "glass, rubber or ironwork" and
         should stay dark. But it also catches every dark garment, every dark
         car body, the dumpster, the railings. A person in a dark coat walking
         under a lamp gets NOTHING, which is exactly what the user is
         reporting. Real light falls on dark objects too; it just does not
         make them bright. Let dark materials into the pool with a scaled
         response rather than excluding them, and keep the exclusion only for
         genuinely non-diffuse things — glass and chrome.

      2. **Walls never catch lamp light at all.** `dimWorld` registers world
         geometry with `pool: false`, so a lamp 5 m up hard against a facade
         throws nothing onto it. A lamp beside a wall splashes on that wall,
         and it is one of the strongest cues that the light is real. The
         comment says warming a 12 m wall off its centre point would be wrong,
         and that is true — so do it off the FRAGMENT position, or split the
         registration so a wall's lower box can pool while its upper cannot.

      3. **The glow sprite reads as a floating smudge, not as light.** In the
         shot it is a soft symmetric radial blob sitting BESIDE the lamp head,
         visibly detached from it, with a smooth gradient in a world where
         everything else is hard-edged texels. That is the same note the user
         gave on the ceiling lamps: *"a bare glow decal, and a smooth radial
         gradient in a world of hard-edged texels"*. Anchor it at the head,
         make it a stepped/dithered glow in the house style, and shape it like
         a lamp throws — downward and asymmetric, not a ball. A visible cone
         or a brighter pool on the ground under it would do more than the halo
         does.

      4. **`FLOOR_LOW = 0.30` may now be the brightest thing left.** You kept
         it deliberately so lit shopfronts stay the reward for a dark street,
         which was right — but with GROUND at 0.07 the eye-level band is over
         four times the road. Check whether that is what still reads as "not
         dark enough". Lit windows and signs must stay bright; the unlit
         masonry at that height probably should not.

      Walk it at 3am and at dusk, and look at a person and a car passing under
      a lamp — that is the specific thing the user asked for.

- [ ] **Build a floor-trash comparison rig in the alley.** The user:
      *"items on the floor are all bad i can't tell what they are. in fact how
      about you design some of the floor trash put it in the alley and i'll
      tell you which i like similar to how we did with the cat."*

      This supersedes the older *"trash looks too clean"* note — the complaint
      is no longer that it is too tidy, it is that **it is not legible**. At
      ~8 px/m a crushed can seen from standing height is about 5 texels across.
      That is the whole problem: there are not enough pixels to say "can"
      unless the shape is chosen to survive at that size. Squinting at what is
      there now, nothing reads as a specific object.

      **Follow the cat precedent exactly**, because it worked: six cats were
      built in a line, the user pointed at the ones they liked, and the winner
      shipped. Do the same here.

      · **12 to 16 candidates**, laid out in a numbered line down the alley
        floor with a texel-drawn number beside each so the user can say "4 and
        9" and be understood. Space them so no two touch.
      · Each one **drawn top-down** — they are `flatDecal`s, not billboards.
        This is `GOTCHAS.md` §3 and it has already cost this project a
        floating yellow card that the user asked "what is this?" about twice.
      · Draw them at the density they will actually be SEEN at, and judge them
        from standing eye height looking down, not from a top-down screenshot.
        A shape that only reads from directly above has failed.

      Candidates worth trying — take these as a starting set, not a spec:
      crushed drink can (side-crushed and stamped-flat read differently),
      flattened cigarette pack, folded newspaper, soaked handbill, takeout
      container, paper coffee cup on its side, plastic bag, bottle cap,
      chip bag, broken bottle glass, a cigarette end, a torn lottery slip.

      What makes these read at 8 px/m, and it is worth saying because it is
      the actual skill here: a **hard dark outline** against the ground so the
      silhouette survives; **one high-contrast identifying mark** (the red
      band on a can, the white of a newspaper's fold); and a **contact
      shadow** so it sits on the ground rather than floating over it. The
      litter can that was rejected twice failed on exactly those three.

      Put the rig somewhere the user will find it — the alley floor, near the
      dumpster, walkable. Nothing solid; you walk straight over litter.
      Tell the desk where it is and the numbering, and I will point the user
      at it. Do NOT replace the existing street litter yet — the rig is for
      choosing, and the winners get placed after they pick.

      `rnd()` is a shared seeded stream and the trees and pigeons draw from
      it before you — append any new draws at the END or you move every tree
      in the world (`GOTCHAS.md` §2).

- [ ] **Rain must wet the BUILDINGS, not just the ground.** The user:
      *"building should also get affected by the rain"*.

      Today `wetMats` only holds horizontal surfaces — the roads and the walks,
      registered through `ctx.wet()`. Every facade on the block stays bone dry
      through a storm, which is most of what you can see, so the rain reads as
      something happening to the floor rather than to the world.

      **Do it without editing anybody else's file.** `props.ts` already has the
      pattern: `dimWorld(scene)` traverses the whole scene after everything is
      built and registers what nothing else claimed. Write the rain equivalent
      and you need no cooperation from D, E or A — which matters, because all
      three are live in their files right now.

      A wet wall is not just a darker wall. What actually reads:
      · darkening that is STRONGEST AT THE BASE — splash-back off the sidewalk
        soaks the bottom half-metre or so and fades upward
      · streaks running down from sills, copings and anything that sheds
      · the wall going slightly cooler and more saturated, not just dimmer
      · it should dry from the top down, on the same `wetness` state you
        already built, so it outlasts the rain like the ground does

      Watch the interaction with the night pass: `dimWorld` and your rain
      registry must not both own the same material, the same way `updateRain`
      and `dimWorld` already negotiate that today. Do not let a wet wall at
      night go to black.

- [ ] **Fix the puddle contrast inversion — the desk approves your
      recommendation.** Your diagnosis (`bc20c70`) is the best piece of
      debugging on this project so far: the puddles are present, filled,
      correctly placed and drawn, and invisible because `updateRain` crushes
      the road toward slate at 0.95 while the puddle is a FIXED dark sheet
      that cannot go darker. The sign inverts and you get a pale smear — a
      quiet version of the glowing puddle that was already rejected once.

      Do what you proposed:
      · a real **ambient-scaled reflection** rather than a fixed dark sheet.
        Standing water reads by reflecting, which is exactly what the sheet
        lacks, and a reflection scales with the light so it cannot invert.
      · **put water where the player actually looks.** Every street puddle
        currently sits in the 45 cm gutter strip. Nobody walks there. Low
        spots on the sidewalk, the dip by the catch basin, under the awning
        drip line, the alley.
      · **hold off easing the wet tint**, as you recommended — the user just
        approved the night pass and that trades directly against it. Correct
        call; do not touch it.

      One more thing you raised: rain is 6 of 24 hours and the first is 100 s
      from spawn. The user has asked about rain and puddles four times and has
      probably never stood in a storm. Raise the odds and bring the first one
      much closer to spawn. This is a feature nobody can see.

- [ ] **The user still cannot see puddles while it is raining.** *"still no
      puddles during rain?"* — asked AFTER your `8a50f97` landed, so treat the
      buried-decal fix as necessary but not sufficient.

      You measured 11 of 14 showing during a storm in your own worktree. The
      user is playing the LIVE integration world on port 5177, which is
      mainline plus every builder's in-flight work — so verify there, not in
      your worktree. There is now a build stamp in-frame (`acbda51`), so you
      can confirm which build is actually being served rather than assuming.

      Then work outward from the most likely causes, in this order:
      1. **Is it raining at all when they look?** `rainAt(h)` is a hash gate
         that is true for about 22% of hours. If a player walks around for two
         minutes at a dry hour they see no rain and no puddles, and nothing is
         broken. If that is what is happening, say so — and consider whether
         22% is too rare to ever demonstrate a feature the user has asked
         about three times.
      2. **How long until a puddle is visible?** `puddleLevel` lerps at
         `dt * 0.22` and only shows above 0.03. Work out the wall-clock time
         from first drop to a visible puddle. If it is tens of seconds, the
         user has almost certainly stopped watching before one appears.
      3. **Where are they?** Puddles are in the gutter and under awnings. If
         you are standing on the sidewalk looking down the street you may
         simply not have any in frame.
      4. Only then look for a remaining rendering fault.

      Report what it actually is before changing anything — this has been
      "fixed" once already and came back.

- [ ] **Nothing queued.** Your two live items — the night pass and the wetness
      that outlasts the rain — both landed. Report to the desk and take a
      look at the world with fresh eyes: you own every surface the player
      walks on and every prop standing on it, so a quality pass on your own
      area is a legitimate use of your time. Write what you find to
      `notes/B-ground-report.md` rather than fixing it all at once, and the
      desk will prioritise.

      Two things worth looking at first, both from the user's own words:
      · the payphone and a street tree stand directly in front of the library
        doors. Builder E is recessing the library into a courtyard, which will
        strand both in the middle of it. E cannot move them — `ct/props.ts` is
        yours. Work out where they should go and coordinate through the desk.
      · *"trash looks too clean? and also under the gutter somehow"* — the
        litter never got a second pass.

## Next

- [ ] **The bus bench is backwards, and it is not at a bus stop.** The user:
      *"bench for bus is messed up, like the back of the bus is in the front?
      doesnt make sense"*. Ref: `shots/user-bench2.png`

      You rebuilt this once (`ec94ed4`) and the brief then was "the ad panel
      must BE the backrest". It is — but it now reads wrong for two reasons
      and they compound:

      1. **The backrest barely rises above the seat.** In the shot the TONY'S
         PIZZA panel and the seat slats sit at almost the same height, so
         instead of a bench with a back you see a flat red board with a plank
         in front of it. Nothing tells you which side you sit on. A real
         backrest tops out around 0.85 m against a 0.45 m seat — that
         difference has to be obvious in silhouette.
      2. **It is shoved against the building, parallel to the wall, nowhere
         near the stop.** A bus bench belongs at the KERB, facing the road, so
         a person waiting can see the bus coming — and it belongs beside the
         stop pole, which currently stands several metres away with nothing
         around it. Right now the bench and the stop read as two unrelated
         objects, which is most of why it "doesn't make sense".

      Put the bench and the pole together at the kerb, seat facing the street,
      ad panel as a full-height backrest behind the sitter. Keep TONY'S PIZZA;
      the ad concept was approved. Leave the 2 m walking lane clear behind it
      (`GOTCHAS.md` §9) — walk past it to prove it, do not eyeball it.

- [ ] **Move your `[E]` spots out of `crosstown.ts` and into your own module.**
      `CtxBuild` has `ctx.spot({...})` and `ctx.player` (`x()`, `z()`, `gy()`,
      `jumpTo()`). Register the spots belonging to `ct/props.ts` from inside it
      and delete them from the `SPOTS.push(...)` block in `crosstown.ts`.
      Builders C and H have both done this already — copy what they did.
      Verify by walking to each spot and pressing E.

## Done

- [x] **Night: the road was never being darkened at all** (`895a056`)
- [x] **Wetness outlasts the rain, and the puddles crest after it** (`53f3a6f`)
- [x] Lamplight warms the surface instead of repainting it — cars no longer
      go brown under the lamps (`08af52b`)
- [x] The van in front of THRIFT is cut, collider with it (`17c2fda`)
- [x] Bus bench rebuilt — the ad panel IS the backrest (`ec94ed4`)
- [x] Parking drawn from a distribution, so near-perfect is a legitimate
      outcome rather than something the arrangement excludes (`f0f4792`)
- [x] Kerb, gutter pan, corner return, catch basin — user: *"really enjoying
      the look of the curb and gutters"*, *"this corner looks so good"*
- [x] Thin-face texture rules (no fine detail on a 1–2 texel face)
- [x] Red kerb by rule — hydrants and corners, both sides
- [x] Citizen collider ±0.30 → ±0.25
- [x] `walkTex` split into `ct/tex-ground.ts`, signature takes world extents
