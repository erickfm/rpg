# feat/entrance — builder C handoff

Worktree `../rpg-entrance`. Owns `ct/apartment.ts` and `resGroundTex` in
`ct/tex-world.ts`. Queue: `notes/queues/C-entrance.md`.

---

## QUEUE STATUS — everything in C-entrance.md is done

**Every unchecked item in my queue is already committed**, including all three
under `## Next`. The file was written just before `bd3a241` landed, so it does
not yet know about them. Desk: these can all move to `## Done`.

| queue item | commit |
|---|---|
| `## Now` — Hermit clipped and too clean | `bd3a241` |
| `## Next` — Paper-thin walls | `bd3a241` |
| `## Next` — 301 has no door | `bd3a241` |
| `## Next` — Ceiling lamps | `28b521d` |

I re-verified all four against the working tree rather than trusting memory,
because a merge (`18bba56`, profile feet + litter) landed underneath my last
commit and touched `ct/citizens.ts`, which my grime code is inside. Rebuilt
and re-shot all 48 interior angles afterwards: the merge and my changes
coexist correctly, and the other builder's profile-feet fix is visibly working
under the grime — see `shots/interior-postmerge/hermit-graze-s.png`.

**My queue is empty. I am idle and available for the next item.**

---

## What landed this session

Nine commits, each verified before the next started.

**`eaa04af` — build unblock (not my file).** The tree did not typecheck:
`walkTex` had moved to `ct/tex-ground.ts` and changed signature, but
`ct/street.ts` still imported the old one. Nothing could build, so I made the
minimal fix. Worth a look from whoever owns the ground refactor — `buildGround`
now builds the corner returns itself, so that triangle may be a redundant
coplanar patch that should be deleted rather than fixed.

**`28b521d` — hall lights.** The lamps were a bare additive radial-gradient
billboard with no fixture: no shade, no bulb, no ceiling rose. Modelled a
period flush-mount — bronze rose, shallow ribbed opal dome, low-segment so it
stays faceted like the rest of the geometry. The dome's texture runs rim→pole
because that is how `SphereGeometry` lays `v` out from `thetaStart`, so the
bands read as turned glass from underneath. Glow stepped into hard concentric
discs with an edge that breaks into loose texels, plus a dimmed copy laid flat
for the pool a flush-mount actually throws on the ceiling. All seven fixtures.

**`f9c4969` — stairwell top.** Probed the floor-picker first and found the
exact failure: **a 2.6 m drop in one step at lz 8.6**. At floor 3 the shaft's
west half is where flight A would carry on up to a fourth floor that does not
exist, so the picker's best offer over there was flight A a storey and a half
below. A collider hid the hole, which is its own kind of wrong — the floor
visibly ended and something you could not see stopped you. Added a landing
whose depth is bounded by **headroom, not taste** (flight A climbs underneath;
1.2 m keeps ~2.0 m clearance) and a railing standing exactly on the collider.
The landing is offered to the picker as an extra *candidate* rather than
special-cased into `rel`, so hysteresis still arbitrates and descent is
untouched.

**`cb25fcb` — door numbers.** The smear was canvas text at `bold 8px
monospace` landing off the texel grid, with NearestFilter then magnifying the
antialiasing into porridge. Numerals stamped from a 4×5 bitmap table; plate
toned from near-white to brass so it stops being the brightest thing indoors.

**`a7190c0` — hermit on the citizen atlas.** `updateHermit` still takes only
the hour: the billboard pass has already turned him by the time it runs, so
his own yaw *is* the angle to the camera. That kept the change inside
`ct/apartment.ts` with no signature to renegotiate with `crosstown.ts`.

**`e90fea7` — steeper stairs + continuous handrail.** One commit because the
rail geometry is *derived* from the pitch; splitting them would mean
committing a rail wrong by construction. 27.4° → 31.5°. Rise is fixed at
1.35 m by the storey height, so steepening is entirely a matter of run:
1.35/tan(31.5°) = 2.2 m. Taller risers rather than shallower treads — 7 of
0.193 m on 0.314 m treads — so the flight eats 0.4 m less floor and the half
landing gets it back.

The nice result on the rail: the ramp through the nosings sits half a riser
(0.096 m) above each flight's floor, so a rake at **0.904 m above the nosings
arrives at exactly 1.0 m above the floor at the bottom and 1.0 m above the
landing at the top**. Every joint mitres flat and no gooseneck is needed. It
falls out of the geometry rather than being tuned, so it still holds if the
pitch changes again. Continuity is guaranteed by construction — the run is a
polyline whose segments share endpoints, wrapping the *ends* of the core wall.

**`b956763` — basement.** The navy panel under the stairs is now a short
flight descending into the dark behind a padlocked chain-link gate. The gate
stands on the collider that was *already* there, so what stops you is what you
can see stopping you, and the picker is never asked for a height down there.

**`45864b0` — wider doors.** The leaf inside `doorTexN`'s painted casing is 26
of 32 texels, so a 0.95 m plane was a 0.77 m leaf. `DOOR_W` 1.11 gives 0.90 m.
301's real wall gap went 0.80 → 0.95: at a 0.36 m rig radius the old gap left
8 cm and you scraped through.

**`bd3a241` — walls, 301's door, hermit forward + grime.** Three reports, one
root cause: openings with no depth. `wallMesh` builds a box now (0.14 m), so
this is fixed **once for every wall** rather than opening by opening — the
box's thin axis is its local z, which the `ry` rotation already carries round
to the wall normal. Everything that used to sit ~0.02 off a wall *plane* was
consequently buried inside the wall and had to move out onto the new faces
(door leaves, mailboxes, lobby door, 301's window).

The hermit was being sliced by the flat black door quad — he stood on it and
his billboard rotates, so it swept through the plane as it turned. His opaque
half-width is 0.36 m (the atlas paints him cx±10 of 32, times the 1.14 m
plane), so his rotation circle only clears the wall at AX(2.04) or less;
AX(1.95) leaves 9 cm. That also settles the older "neighbour is still flat"
complaint — the atlas was never the problem, but in a doorway at the end of a
corridor exactly one of five painted columns was ever on screen.

`citizenAtlas` gained an optional `grime` 0…1. At 0 — every existing caller —
not one extra fill happens, so the four street citizens are byte-identical.

---

## How the floor-picker work was verified

Anything touching `ground(x,z)` was checked by **walking the picker step by
step, feeding its own output back in** — the only way to see what hysteresis
actually does, and something a screenshot cannot show. `warp()` sets `gy`,
which *is* `lastGy`; the sim re-picks from it; `pos()[3]` is the result.

- Stairs: 10 walks, lobby → floor 3 and back down every flight, both lanes.
  All continuous, biggest single step 0.12 m against a 0.193 m riser, each
  landing exactly on its floor.
- Basement: walking the east lane straight through the shaft, the picker never
  once returns a height below the lobby floor. There is nothing to fall into.
- 301's doorway: crossed both directions, hugging either jamb, level the whole
  way on floor 3.

Also standing: `npm run build` clean, `npm run sweep` 48 shots with no page
errors, `scripts/verify.mjs` passing, and the street entrance tested end to
end by actually pressing E (`verify.mjs` warps instead).

---

## Two things still open in `crosstown.ts` — NOT my file

Both were reported earlier and are still there as of `bd3a241`.

1. **`crosstown.ts:243` still reads `'enter THE WHITMORE'`.** The building has
   carried no name since the nameplate came off — the gold 227 on the transom
   is its only identification. This is the string the player reads at the
   door, so it is the one place the dead name is still visible.

2. **The lobby `[E] out to the street` exit does not work.** Press E and you
   stay put. I verified this on the unmodified baseline before any of my
   changes, so it is pre-existing. The exit lands at `FACE - 1.1` (x 5.9) but
   the *enter* spot is `FACE - 0.45` (x 6.55) with radius 1.05 — you land
   0.65 m away, inside the re-enter trigger, and one held E ping-pongs you
   straight back in. It is the same bug `crosstown.ts`'s own bodega-exit
   comment says was fixed *there* by landing well outside the radius; the
   walk-up never got the same treatment. One-line fix.

---

## Notes for the desk

- **Port.** `C-entrance.md` says port 4180, but 4180 is held by a stale
  `vite preview` from a *different* repo (`/home/erick/projects/rpg`), which
  silently served me the wrong world until I caught it. I am on **4190 with
  `--strictPort`** so it fails loudly instead of drifting. Worth fixing in the
  queue file, or killing the squatter.
- **`fpdiff` gives false positives on any change that adds a texture.** The
  seeded `Math.random()` stream shifts, so every texture created afterwards
  gets different dither grain — my entrance change showed 68 structure diffs
  of which the real count was 6 removed / 4 added. Strip
  `/\d+x\d+:[0-9a-f]+/` from the structure signatures and re-diff as
  multisets. Worth folding into `scripts/fpdiff.mjs` as a `--geom` flag.
- **`scripts/interior.mjs`** is mine and new: 48 interior angles — lamps,
  stairwell, rail joints from both sides, cellar, door plates, hermit from
  every reachable side, wall reveals. `scripts/entrance.mjs` is the 27-angle
  facade sweep from the earlier round.

## Known limits, deliberate

- **Residential buildings under ~11 m get no ground-floor windows.** A 4 m
  entrance bay leaves panels too narrow for a 1.5 m window plus piers. It
  degrades to bare brick with the doorcase still correct, which is the right
  failure, but it is a real limit of `resGroundTex`.
- **Ground-floor brick courses are 0.50 m; the facade above is 0.446 m.**
  A slight course-pitch step at the storey line. Pre-existing, affects every
  building, and fixing it means touching shared brick.
- **The stoop is not a collider.** You walk through the step rather than onto
  it. Invisible in first person because the camera rides well above a 0.17 m
  step; adding one is a `props.ts`/rig concern.
