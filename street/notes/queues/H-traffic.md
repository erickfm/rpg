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

- [ ] **Split the walking sim out of `ct/citizens.ts` into `ct/crowd.ts`.**

      Do this FIRST, before any behaviour work. `ct/citizens.ts` is a shared
      leaf module — three modules call `citizenAtlas` — and it is desk-owned
      for exactly that reason (`notes/OWNERSHIP.md`). But the two halves of it
      are unrelated: the ATLAS paints an 8-angle sprite sheet, and the SIM
      walks people around. Only the atlas is shared.

      So: leave `citizens.ts` as the atlas alone (still desk-owned, still
      read-only to you), and move the walking, steering and avoidance into
      `ct/crowd.ts`, which you own. Verify it moved nothing:
      `npm run fp before` → split → `npm run fp after` → `npm run fpdiff`.
      Textures and structure must come back **identical**; 4–6 pigeons drifting
      is the noise floor. Commit that as its own commit before you change any
      behaviour, so if the behaviour work goes wrong the split is not in doubt.

## Next

- [ ] **Cars turn the corner.** Right now traffic runs one axis. Give the road
      network an actual junction at z ≈ -98: a car reaching it picks a way to
      go, turns through a real arc rather than snapping its heading, and
      carries on down the side street toward the fog. Slow into the turn, and
      make the wheels and the body agree — a car that turns without leaning or
      slowing reads as a cardboard cutout sliding on ice.

      Watch for: two cars arriving at the junction together; a car turning
      through the crossing while a pedestrian is on it; and the parked cars,
      which must not be treated as traffic.

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

_(nothing yet — you are new)_
