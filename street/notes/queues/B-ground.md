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
