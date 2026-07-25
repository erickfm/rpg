# Queue — builder H  ·  worktree `../rpg-traffic`  ·  port 4187

**Owns:** `ct/cars.ts` (transferred from B), and `ct/crowd.ts` — the pedestrian
walking sim, which you will create by splitting it out of `ct/citizens.ts`.
**Desk writes this file. Do not edit it.**

You are new. Read `START-HERE.md`, then `notes/GOTCHAS.md`, before your first
change.

## The whole brief, in the user's words

> *"i want the cars to turn the corner and for the details to extend out that
> way trees crub, cars, etc. i want the pedestrians to also go out that way and
> have more complicated paths"*

Today the world is a straight main street with a corner bolted on at z = -98
and a side street that exists mostly as scenery. Traffic runs up and down one
axis. Pedestrians walk a lane. The corner is the best-looking thing on the
block — the user has said so twice — and nothing actually USES it.

That is the job: make the corner a place things go through, not a place the
world stops.

## Now

- [ ] **Wheels clip through the bodies, and the doors do not read as doors.**
      Two notes on the fleet, same pass.

      **(a) The pickup needs wheel arches.** The user: *"pickup looks great but
      the wheels need to not clip through, maybe we need to have some inlaid
      wheel things pickups have"*. Ref: `shots/user-truckwheel.png`. The bed
      side is a flat slab and the tyre passes straight through it, because
      nothing in the body is cut away for the wheel. What they are describing
      is a **wheel arch** — every real vehicle has one, and on a pickup it is a
      pronounced flared well in the bed side. Cut the arch into the body so
      the tyre sits INSIDE it with a visible gap at the top, and give the
      arch a lip. Do it for the whole fleet, not just the truck: the sedan in
      `shots/user-cardoors.png` has the same fault, its tyres just intersect a
      flat flank.

      Note the arch is a curved edge in a hard-texel world — step it, do not
      smooth it, and keep the steps coarse. That face is seen at a grazing
      angle, which is the condition that turned the tailgate into a
      checkerboard (`GOTCHAS.md` §4).

      **(b) The sedan's doors are two floating bars.** The user: *"idk if the
      doors make sense on the car"*. Ref: `shots/user-cardoors.png`. What is
      drawn is two short vertical strips in the middle of the flank that stop
      well short of both the sill and the window, plus two small black
      rectangles. Nothing reads as a door because a door is not a line — it is
      an OUTLINE:
      · shut lines run from the **sill all the way up to the window base**,
        and there are TWO of them per door edge, not one
      · the **B-pillar in the glass must line up with the shut line below
        it**. In the shot the glass divider and the body strips are at
        different x, which is most of why it reads wrong.
      · **handles sit just under the window line**, not halfway down the door
      · the window glass should be **divided by the same pillar**, so front and
        rear windows are separate panes
      · a **rear quarter window** behind the back door is what makes a
        four-door sedan read as a four-door

      Check every car in the fleet for both, and check that a two-door and a
      four-door actually differ — if they share a flank texture, that is the
      real bug.

- [ ] **Parked cars can leave a gap the player fits into but cannot leave.**
      The user got wedged between two of yours: *"im literally stuck here"*.
      Ref: `shots/user-stuck.png`.

      Builder F is adding depenetration to the rig so any trap becomes
      survivable — that is the safety net. **Your half is not creating the
      trap.** A safety net that fires regularly is still a bug.

      The player capsule is `RADIUS = 0.36`, so 0.72 m across. A gap between
      two colliders should be either **comfortably passable (≥ 0.95 m)** or
      **fully closed** — never in between. The dangerous band is roughly
      0.4–0.95 m: wide enough to walk into at an angle, too narrow to turn
      around or walk out of.

      Parking is drawn from the seeded distribution now (`f0f4792`), which is
      right and the user likes the variety — so **constrain the draw, do not
      go back to hand-placing.** After sampling each car's offset and angle,
      check the gap to its neighbour and re-roll or nudge until every gap is
      out of the dangerous band. Same for a car against the kerb, a car
      against a tree pit, and a car against the bus bench.

      Apply the rule to the whole fleet, not just the pair in that shot —
      including the cars you extended down the side street.

- [ ] **Profile feet read backwards. `ct/citizens.ts` is now YOURS.** The
      user: *"legs on these people is still off from the side, looks backwards
      on the feet somehow?"* Ref: `shots/user-feet3.png`.

      Ownership moved to you with this item — you already own `ct/crowd.ts`
      and you did the split that separated the atlas from the walking sim, so
      you know the file. It was desk-owned, which is part of why this has been
      attempted and dropped before.

      **The diagnosis, measured off the code.** In the profile view
      (`view === 2`) at stride 0:

      · **the two legs draw at exactly the same x.**
        `cx - 2 - stride` and `cx - 2 + stride` coincide when stride is 0, so a
        standing citizen has ONE leg. That is what the shot shows.
      · **the shoe has no toe.** The two feet span `cx - 5` to `cx + 6` — an
        11-texel plank, centred half a texel right of the leg, which is 4 wide
        at `cx - 2 … cx + 2`. So it sticks out roughly equally in FRONT of and
        BEHIND the ankle. A shape that is symmetric about the ankle cannot say
        which way it points, and the eye resolves that as "backwards" —
        exactly the word the user used.

      What a profile foot actually is: the ankle sits near the BACK of it,
      with a short heel behind — one or two texels — and the whole length of
      the foot forward of it. Roughly 1 back, 7 forward, not 5 and 6.

      · make the toe direction follow the facing, so the mirrored profile
        gets its toe on the correct side rather than inheriting a symmetric
        shape that looks wrong in one of the two
      · give the legs a small default offset at stride 0 so a standing person
        has two of them
      · keep the fix that is already there: feet must NOT part company at long
        stride, which is the "two shoes floating beside the person" bug the
        comment in that function describes. Whatever you do has to survive
        stride 2–5.

      **This is the third attempt at profile feet.** Check all 8 atlas angles
      with `__ct.atlases()` before you commit, standing AND walking — the
      previous fixes were judged on one angle and broke another.

- [ ] **The truck tailgate is aliasing into a checkerboard.** The user:
      *"textures on back of truck are janky"*. Ref: `shots/user-tailgate.png`

      This is `GOTCHAS.md` §4 arriving on a vehicle: *a surface 1–2 texels
      tall cannot hold detail.* The tailgate band is a thin face carrying
      dither, and at a grazing angle `NearestMipmapNearest` turns that dither
      into a crawling checkerboard — it is the same failure that produced
      three separate "the kerb looks bad" reports before the rule was written
      down. The fix there was: no dither, no fine noise on faces thinner than
      ~0.3 m, only large features many texels wide, and
      `minFilter = NearestFilter` so there is nothing to crawl.

      Apply the same rule to the vehicle fleet, not just this one panel — the
      truck is where it shows worst but any thin trim, bumper or sill has the
      same problem. Then walk round the fleet at grazing angles and check.

      **Also visible in that shot: the tail lights are asymmetric.** The left
      one is a wide bar at mid height, the right a shorter one lower down.
      Either that is a UV mapping fault on the box or the texture is not
      symmetrical; either way it reads as a mistake.

- [ ] **The truck bed is too shallow and its floor is body-coloured.** The
      user: *"truck bed needs to be a bit deeper and black in the bottom"*.
      Ref: `shots/user-truckbed2.png`. Same vehicle as the two items around
      it — do all three in one pass.

      **This is the second time they have asked for a deeper bed.** The first
      was *"truck geometry is much better, truck bed could be deeper though"*,
      and the rebuild that followed gave it real walls but did not gain much
      depth. In the shot the bed floor sits barely below the top rail, so it
      reads as a shallow tray rather than something you could put a load in.
      Take it to a real depth — a 1997 half-ton bed is around 0.45–0.5 m
      inside, most of the way down to the wheel arches.

      **And the floor must not be the body colour.** It is painted the same
      green as the outside, which is what makes the bed look like a pressed
      dish rather than a cavity. A bed floor is a dark ribbed liner or bare
      shadowed metal — near-black, so the inside reads as a hole. That single
      change does more for depth than the geometry does, because an unlit
      world has no shadow of its own to darken it for you.

      Ribs running front-to-back on the floor would sell it further, but
      **keep them coarse** — they are a near-horizontal face seen at a
      grazing angle, which is exactly the tailgate problem in the item above
      (`GOTCHAS.md` §4). Wide ribs, no dither.

- [ ] **Move the parked truck away from the alley mouth.** The user:
      *"move the truck a bit away from the alley"*. Ref:
      `shots/user-truckalley.png`. Small and quick — do it alongside the
      tailgate fix, it is the same vehicle.

      Nobody parks across an alley mouth, and it also blocks the sight line
      into the alley, which is where the dumpster, the cat and the graffiti
      all are. The alley gap is `AZ0 = -37` to `AZ1 = -43.5`. Shift the truck
      clear of that span with room to spare, and remember the parked
      arrangement is DRAWN from the seeded stream now (`f0f4792`) rather than
      hand-placed — so change the constraint the draw works within, do not
      hand-place it back.

## Next

- [ ] **Extend the detail down the side street.** The user names trees, kerb
      and cars specifically, and the point is that the side street currently
      stops being a real street about 15 m in. Carry the kerb, the gutter pan,
      the catch basins, the street trees in their dirt pits, the lamps and the
      parked cars east along it until the fog takes them.

      **Density must fall off, not stop.** A street that is fully detailed for
      40 m and then abruptly bare reads worse than one that thins out. Fewer
      trees, longer gaps between parked cars, the odd empty stretch.

      Kerb and gutter geometry belongs to builder B (`ct/tex-ground.ts`) — read
      how it is built there and follow it exactly, but if you need a change to
      that file, ask the desk. Do not drive-by edit it.

- [ ] **Pedestrians get more complicated paths.** Today they walk a lane. They
      should have somewhere to be: turn the corner, cross at the crossing (and
      only at the crossing), stop at a window, wait at the bus bench, come out
      of one shop and go into another, double back. Give them a graph of the
      walkable network — both sidewalks, both sides of the side street, the
      crossings — and let them route across it, rather than steering along a
      line.

      Non-negotiables: they must not walk through props (`citAvoid` exists for
      this), must not phase through each other, must never trap the player, and
      the **2 m sidewalk lane stays clear** (`GOTCHAS.md` §9) — the user checks
      this constantly.

      Vary what they are doing, not just how fast. A world where everyone walks
      at a different speed in the same straight line is not more alive than one
      where they all walk the same speed.

## Watch out for

- **`ct/rng.ts` order is load-bearing** (`GOTCHAS.md` §2). One seeded stream
  feeds tree heights and pigeon placement at construction. Inserting a draw in
  the middle moves every tree in the world. Append new draws at the END.
- **Builder B owns `ct/props.ts` and `ct/tex-ground.ts`** and is working in
  both right now on weather and night lighting. Rebase before every item.

## Done

- [x] **Split the walking sim out of `citizens.ts` into `ct/crowd.ts`**
      (`38cf9e6`), fingerprint-verified as world-neutral.
- [x] **Cars turn the corner** — a real junction at the end of the main
      street (`cb0386d`). The desk resolved its merge conflict against the
      interior-belt changes.
