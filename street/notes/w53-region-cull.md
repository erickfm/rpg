# w53 — item 141: the exterior was drawing through the window

**The user:** *"facing the window in my room makes the game feel slow. like my
mouse moving across the screen feels like it drags."*

**Root cause, one line: 301's window wall faces the whole city with nothing
between them but a frustum test, so turning to face it submitted 2,691 street
meshes per frame that are hidden behind a brick light well 1.2 m from the
glass.**

Ports: **4183** (dev) and **4184** (preview of the built bundle). Both proved
`000` free before use, both shut down at the end.

---

## The desk's cause was right. Its constraint was wrong, and that is the story.

The item says: *"The player can see the street through his window — that view is
part of the world and **must not simply vanish**; a room whose window goes black
is worse than a slow one."* It then offers three fixes, all of them shaped by
that constraint — a portal test against the window rect, keep-near-drop-far, or
drop the populations and keep the skyline.

**He cannot see the street through his window.** 301's window looks into a
light well that he asked for in these words:

> *"a bit of a gap out of the window and then just a brick wall, almost like a
> little room outside the window that is just brick."*

`ct/apartment.ts:1751-1813` builds it as a closed box — a far wall 1.2 m from
the glass, brick returning down **both** sides, a floor three storeys down, a
drainpipe and a fire escape. `shots/w53-before-win-close.png` is that view with
the player's face against the glass: brick, corner to corner. Nothing of the
street is visible from anywhere in the room, at any pitch, including straight up
the well.

So the expensive, risky fix the item scopes was not needed. The whole 2,691 is
occluded, and it can be dropped outright.

## What was measured, and why these are counts

BUILDER-BRIEF §10 and the item both say no headless frame time transfers to the
user's machine, so nothing here is a timing. Two counts, both identical on any
hardware:

- **`scripts/probes/w53-drawcount.mjs`** wraps `drawElements`/`drawArrays` and
  their instanced forms on the WebGL context prototype in a Playwright init
  script — hooked before the app builds its renderer, so it is the real call
  count into the driver, not `renderer.info` (which this world does not expose).
- **`scripts/probes/w53-bands.mjs`** buckets the frustum-visible set by world x,
  against the address map `ct/interior.ts:40` states in prose.

| station | before | after | |
|---|---|---|---|
| **301 facing the window** | **4,012 draw calls/frame** | **182** | **22x** |
| **301 landing/hall** | **3,987** | **108** | **37x** |
| 301 facing away | 223 | 223 | unchanged |
| the street | 3,742 | 3,715 | unchanged (noise) |

Triangles move with them: 52,135 → 1,080 facing the window.

**Facing the window cost MORE than standing in the middle of the street.** That
is the user's report reproduced exactly, and it is why the street itself has
always felt fine — nothing is parked behind you out there.

The band split says whose it was: of the 2,784 frustum-visible renderables
facing the window, **2,691 were street geometry (x < 100)** and 93 were the room.
Facing away: 102, all room, zero street.

## The fix

`ct/interior.ts:22-25` — *"Interiors are not inside their buildings — they are
rooms parked far out along +x that you teleport to."* 301 is at x ~199; the
street ends at x 100. So a top-level scene child lying **entirely** west of 100
is street geometry, and while the player stands east of 100 it is not drawn.
x 100 is not invented here: it is that address map, and `crosstown.ts` already
used `px < 100` as "am I outdoors" to decide whether feeding the birds works.

It is deliberately conservative in four ways, because a black window is the
failure mode that matters:

- **anything straddling the boundary is never hidden** — the test is "entirely
  west of 100", so world-spanning objects fail it and stay;
- **any subtree containing a Light is never a candidate** — hiding a parent
  takes its lights out of the render, and this scene's two are global;
- **anything added after the first frame is never hidden** — a spot outline, a
  probe's car;
- bounds come from world-space bounding **spheres**, which over-estimate, so a
  wrong answer errs towards keeping the object.

It runs **last in the frame**, after every hook, because three modules write
`visible` on their own top-level objects every frame — the traffic fleet
(`ct/traffic.ts` adds each car to the scene directly), the rain, the star dome —
and a one-shot hide is undone by the next hook to run. It remembers what the
owner wanted at the moment it hid something, so leaving does not switch the rain
on for a frame on a dry afternoon.

**It constructs no object of any kind.** `scenedump.mjs` seeds `Math.random` and
three draws four random values per Object3D, so one new mesh here would repaint
every dithered texture after it. Box3/Vector3 carry no uuid — which is why,
unusually for a performance change, **`fp` is a valid proof for this one** and I
used it.

## Proof

- **`fp`: `textures` and `structure` byte-identical to the parent commit**
  (`9eb79d4c` / `25c637ab`), 8,415 objects vs 8,415. `fpdiff` reports 9 `places`
  differing, all pigeons and walkers — against a **control of 2** from running
  the *same* code twice, which is the documented noise floor. `tints` and
  `places` never match run to run even unchanged; I verified that before
  believing the comparison.
- **`scripts/probes/w53-ab.mjs`: 224 samples over all 14 rooms, PASS.** Every
  room, 8 headings x 2 pitches, rendered with the cull off and on via the
  runtime toggle `__ct.cullRegions` — two frames of one world, not two builds.
  Worst station 11 px against a 40 px floor.
- **Its mutation run is RED.** `--mutate` additionally hides the nearest visible
  object and the check must fail; it does, on 13 of 14 rooms, most of them by
  the entire frame. A green `--mutate` means the check has stopped checking.
- **`scripts/probes/w53-walk-boundary.mjs`: PASS, on foot.** Walking east from
  the street at seven different z, the furthest anyone gets is **x 23.04** — the
  boundary at 100 is 77 m beyond anything walkable, so there is no seam to stand
  in. And across 18 samples walking out of 301, the cull state never once
  disagreed with where the player was.
- **`bugsweep`: 0 STATION MISS, 0 COVERAGE**, 96 shots, no console errors.
- **`check-seethrough`: pass** — no pavement visible through any shopfront.
- **Verified on the BUILT bundle** (`vite preview`, 4184): 182 draw calls,
  same as dev.
- **My own verdict on the frames:** `shots/w53-{before,after}-win-across.png`
  and `-win-close`, `-win-up`, `-win-down`, `-win-offset` — the well is the same
  brick, sill, cactus, glazing bars and drainpipe in both. `-street-n` is the
  full street, library, cars, citizen, bunting, fog. Nothing went black.

### Two things this check got wrong before it got them right

Worth reading in `w53-ab.mjs`'s header, because both are traps for the next
person:

1. **A pixel COUNT cannot tell a lost wall from a blinking bulb.** v1 failed the
   casino at 2,623 changed pixels against a 2,572-pixel control. Both were the
   marquee. `scripts/probes/w53-ab-mask.mjs` paints the masks and they are the
   same row of bulbs in different phases. Raising the threshold until it passed
   would have been exactly the defect BUILDER-BRIEF §7 forbids, so the check
   models the noise instead: N untouched frames give a per-pixel *range*, and a
   pixel fails only outside the range the world already produces there.
2. **`__ct.warp` with `gy` left undefined keeps the previous station's storey.**
   That stood the player in the walk-up at the belt's floor height and produced
   a 358-pixel "failure" which vanished when the room was visited alone. GOTCHAS
   7, and w52's note about `warp` needing `gy`, paid for a second time. Every
   station now passes its storey explicitly.

## Found and NOT fixed

1. **The street still draws 3,715 calls with a large part of it occluded by its
   own buildings.** This item removes the indoor case only; there is no
   occlusion culling on the street and I did not add any. It is a much harder
   problem than this one was (real occluders, moving camera) and it is *not*
   what the user reported — his complaint is specifically the room.
2. **The reverse direction is worth nothing and I did not implement it.**
   Standing on the street, the frustum test alone already excludes every
   interior: measured 2,906 frustum-visible renderables, **all** of them street.
   So hiding interiors while outdoors would save nothing. The cull is
   deliberately one-directional and the code says so.
3. **The `[E]` sight test no longer counts hidden street meshes as blockers**
   while indoors, because `crosstown.ts`'s `canSee` filters `m.visible === false`
   and they now are. No behavioural change is possible — indoors, no spot is on
   the street and the ray is at most 6 m — but it is a real coupling and the next
   person to move this boundary should know about it.
4. **w52's bigger fish is still there and untouched:** a 6 m sight ray still
   tests all 7,832 meshes (`notes/w52-perf-301-sight.md`, "found and not fixed"
   1). This item does not help it — `Raycaster` does not skip invisible objects.
5. **`A-verify-select-through` is red on mainline** — 35 of 44 stations, as w52
   recorded. Not touched, not caused here.

## Files

- `src/proto/crosstown.ts` — the cull, its classification, and `__ct.cullRegions`/`cullInfo`
- `scripts/probes/w53-drawcount.mjs` — real GPU draw calls per frame, per station
- `scripts/probes/w53-bands.mjs` — the frustum set bucketed by world x
- `scripts/probes/w53-ab.mjs` — the equivalence check, with `--mutate`
- `scripts/probes/w53-ab-mask.mjs` — paints where the pixels moved, for running a failure down
- `scripts/probes/w53-ab-look.mjs` — the off/on pair plus street-band objects in frustum, for one station
- `scripts/probes/w53-walk-boundary.mjs` — the boundary walked, not warped
- `scripts/probes/w53-shots.mjs` — the player's own standing positions, before/after
