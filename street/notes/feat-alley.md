# Builder D — handoff

Working from `notes/queues/D-alley.md`: read it, take the top unchecked item
under `## Now`, commit, re-read before the next. I do not edit that file —
completions are reported here. Older runs are further down this note.

---

# LATEST RUN — bodega blocker (commit `fa62171`)

## `## Now` → **BLOCKER: you cannot enter the bodega** — DONE

**The diagnosis in the queue was not the cause.** It was not the chamfer
colliders. It was the **fruit-crate collider**: one 2.2 m box,
`x 7.5…9.7, z -96.9…-96.2`, spanning the whole canted-bay frontage — with the
bodega's `[E]` spot at `(8.7, -96.85)` sitting **inside** it. The trigger was
enclosed by an obstacle, so the only way into its 1.1 m radius was from due
south of the crates, which is not a path anyone walks.

Reproduced by driving the player, not by looking:

| approach | before | after |
|---|---|---|
| east along the side-street walk | stopped dead at **x = 7.13** | prompt, **enters** |
| west along the side-street walk | stopped dead at **x = 10.07** | prompt, **enters** |
| diagonally at the canted face | stopped at **(7.11, -96.67)** | prompt, **enters** |

Those two stop values are exactly the crate box inflated by the rig's `RADIUS`
(0.36) — `7.5 − 0.36` and `9.7 + 0.36`. That is what proved it was the crates.

**Fix**
- Crates moved east to `x 10.05 / 10.95`, `z ≈ -96.28` — clear of the doorway
  and tight against the wing frontage, so they are out of the walking lane too.
  (`ct/street.ts`, mine.)
- Their collider became **two boxes, one per crate**, each no bigger than the
  crate it represents, replacing the single oversized box. (`crosstown.ts` —
  the queue asked for the collider gap; I did **not** touch the `SPOTS` array.)

**Verified by actually pressing E** on my own build, three approaches:
`rig.pos.x` goes `8 → 241.3` (inside the shop). `npm run sweep`: same warnings
as baseline, no new page errors.

**Door world coords, as requested**
- canted face runs `A (7, -94) → B (9, -96)`; outward normal `(-1,-1)/√2`, so
  it faces south-west across the crossing
- **door centre `(8.0, -95.0)`**, sill at ground, opening ~2.0 m wide
- the existing `[E]` spot `(8.7, -96.85) r 1.1` **now works and needs no
  change**. If you ever want it on the door's own axis, `(7.19, -95.81)` is
  1.15 m out along the normal and is reachable from the pavement.

## Two things that are not mine, found on the way

**1. Mainline did not compile.** `ct/apartment.ts:586` still called the old
positional `citizenAtlas(...)`; the `Look`-object rewrite in `ct/citizens.ts`
changed the signature. *Nothing* could build — every builder was blocked. I
adapted the call site so the tree compiles.

**This needs a real fix from whoever owns those two files:** the rewrite
**dropped the `grime` flag** that call passed as its 7th argument and nothing in
`Look` replaces it. The comment directly above it still describes the hermit's
stains, unshaven jaw and messy hair — he has lost all three. I did not invent a
replacement; that is a design call on someone else's character.

**2. Port 4181 is not free.** The queue assigns me 4181, but it is held by
`/home/erick/projects/rpg` running `vite preview --port 4177`, drifted onto it.
This has caught me twice — a test ran green against *another worktree's build*.
I now verify on **4185 `--strictPort`** and check the served bundle hash matches
the one I just built. Suggest pinning every worktree with `--strictPort`, or
stopping the drifting 4177 server.

## Queue accuracy — some `## Next` items are already done

- **Shop resizing** — done and in the tree. `SHOP_BAND_H = 4.2`, residential
  still `ENTRANCE.BAND_H = 3.2`, texture 52 texels, glazing 2.59 m, 0.32 m
  stallriser, sign band 0.89 m.
- **Signs (b), the HOTEL blade back-face** — done. Root cause was
  `transparent: true` *alongside* `alphaTest`, which puts both faces of a
  two-sided sign in the sorted pass so the far one paints over the near one.
  Dropping `transparent` + using `FrontSide` fixed it. **(a) and (c) are still
  open** and are genuinely separate bugs.

Still open, untouched: bodega door readability, filling the crates, church
tower removal, signs (a)/(c), window lights, the corporation.

---

# feat/alley — handoff

Everything below landed in `src/proto/ct/street.ts` and `scripts/alley.mjs`
(the two files this branch owns), plus one import line. `npm run build` is
clean and `npm run sweep` reports the same four warnings as the baseline —
no new page errors.

**Port note:** the brief said 4181, but 4181 was already taken — the parent
checkout `/home/erick/projects/rpg` runs `vite preview --port 4177`, which
auto-drifted onto 4181. I did not touch anyone else's server. This branch was
verified on **4185** (`npx vite preview --port 4185 --strictPort`), with a
second server on 4188 serving a pristine baseline build for before/after.

---

## 1. The alley

**Side walls.** The old walls were one shared 63×60 tile mirrored onto both
sides — and they lost the depth test to the building shells, so what you
actually saw was the shells' flat brown end caps, not brick at all. That is
why they read as untextured. Replaced with **two separately painted flanks at
full wall size** (no tiling, no mirroring): PAWN's party wall to the north,
MUSIC's to the south. Same brick recipe as the rear wall the user likes — 5 px
courses, 9 px stretchers, ~11.7 px/m — so the alley reads continuous round both
corners, but different tone, different weathering, different history:

- **north** — warmer red brick, a rain-and-rust streak off a downpipe that
  isn't there any more, salt bloom at the foot, ragged course-following
  repointing across the middle.
- **south** — greyer and sootier, soot washing down from the roof, a
  painted-over ghost sign, damp wicking out of the floor course by course,
  spalled brick faces, one long stepped crack.

Each flank now runs the **full height of the building behind it** (18.6 m and
16.2 m, taken off the roster) so brick is what you see when you look up, and
stands 1 cm proud of the shell face.

The flanks are painted from a **local LCG, not `Math.random`**. The fingerprint
harness seeds `Math.random` globally, so drawing from it here would ripple
through every texture built after the alley for no reason.

**No rectangular infill on the north flank.** Two passes put something square
there (first a bricked-up service door, then a repair patch) and both times it
read as a door behind the REZO tag. That wall is now plain continuous brick.
If you ever add wall history there, make it follow the courses and stop on a
ragged edge — no outlines, no lintel lines.

**Deleted:** the cardboard box, the leaning plywood sheet, all four trash bags
(three on the ground, one over the dumpster rim) and the bag knot. Checked
first: the only alley colliders in `crosstown.ts` are the end wall and the
dumpster, so nothing is orphaned, and the wall/floor behind them needed no
patching.

## 2. The cats — a comparison rig, deliberately temporary

After three solo iterations the user asked for a spread instead. There are now
**six cats in a row against the south wall**, 0.9 m apart, x from -13.0 to
-8.5 at z = AZ1 + 0.6: ginger sit, grey loaf, black alert with a straight tail,
tuxedo, calico curled, brown tabby with a cocked head and a raised paw.

All six are drawn to `ct/citizens.ts` conventions — ~34 px/m (citizens are
32×64 on a 0.95×1.9 board), stacked flat blocks, a 2 px rim light down the
left and a 2 px shade down the right, blunt features, 7-ish muted colours each.

Every one was checked **flattened to a single colour**. That test is what
produced the rules the whole set follows, and it is worth keeping:

- short, WIDE ear triangles at the top corners of the skull with a deep notch
  between them — tall close-set ears read fox or rabbit every single time;
- a big head on a small body;
- the tail held off the flank by a **column of background** so it is its own
  shape instead of part of the blob;
- whiskers breaking the head outline on both sides;
- eyes large, low on the skull, one sparkle pixel each.

**To keep one:** delete `CAT_DESIGNS` and the `forEach` under it, and call the
winner's `draw` once at `(-10.55, AZ1 + 0.6)`. Nothing else references either.

## 3. Building seams

Diagnosed, not guessed. Every shell was built `b.w + 0.05` deep, so neighbours
**overlapped by 5 cm** and their facade quads were coplanar over that strip —
classic z-fight, worst between ARCADE and No. 227 as reported. Shells are now
exactly `b.w`, so they **abut**: the same rule that fixed the corner road
(`git log --grep=z-fight`). The 5 cm flicker column is gone; what is left at a
building boundary is the intended tonal step between two brick colours.

## 4. The bodega's corner

The corner is cut at **45° for the full height**, ground to cornice, with the
entrance in the cut face — the canted bay a real corner store has, not a nick
in the shopfront. The shell is a rectangle with the SW corner triangle removed,
built as two boxes plus the bay and a roof cap, so no CSG is involved.

Follow-ups from the playtest, all landed:

- **Sky through the ground — fixed.** Cutting the corner uncovered ground that
  had been under the building: the east walk stops dead at x = FACE and the
  side-street walk at z = -96, so the wedge between them had no floor. There is
  now a sidewalk triangle at kerb height filling exactly that wedge, abutting
  both walks on their existing edges (never overlapping — coplanar tops
  z-fight), with UVs off world x/z so the 1 m slab grid runs on unbroken.
- **Aligned to the kerb.** The setback is now exactly `WALK`, so the canted
  face is exactly as wide as the diagonal of the WALK × WALK corner square the
  two walks share. The bay, the door on its centre line and the kerb corner in
  front now sit on one 45° axis. The kerb, gutter and corner return were not
  touched.
- **Extended into FLOWERS.** The bodega runs on down the side street for 6.05 m
  past the corner block. FLOWERS is 6 m wide now; everything east of it is
  exactly where it was, so TAILOR still starts at x = 22.45. Sign band widths
  stay proportionate to the rest of the block.
- **Crates.** Real slatted produce crates — three boards with the dark of the
  inside showing through the gaps, corner posts proud of the boards, a top
  rail, and fruit heaped in a rimmed box. They were flat tan cartons before.

The awning was hung at shopfront-band height and hid the name; it now tucks
under the band, and the OPEN sign sits clear of it in the left display glass.

`facadeTex` floors its width at 64 px, which on a 2.8 m bay would paint brick
three times finer than the elevation beside it, so the bay and the corner pier
use a local copy of the same recipe without that floor. **Worth lifting into
`tex-world.ts` as a `minW` parameter** — that is the desk's file, so I left it.

---

## Required in `crosstown.ts` — please apply (I must not edit that file)

**The `[E]` enter trigger must move.** The door is no longer on the south face.

```js
// was: { x: 8.7, z: -96.85, r: 1.1, ... }
{
  x: 7.19, z: -95.81, r: 1.1,          // 1.15 m out from the canted door on its own 45° axis
  ok: () => rig.pos.x < 100,
  label: () => 'into the BODEGA',
  act: () => jumpTo(241.3, -17, Math.PI / 2, 0),
},
```

Door centre is `(8.0, -95.0)`; the outward normal is `(-1,-1)/√2`. I checked
reachability against the existing colliders: the nearest standable point is
about 0.44 m from that trigger centre, and the side-street walk approach is
0.70 m, both well inside r = 1.1. **No collider change is needed** — the recess
itself stays solid, which is correct; you press E from the corner.

The exit (`jumpTo(11, -97.3, 0, KERB_H)`) still lands on the side-street walk,
clear of the crates and 4.1 m from the new trigger, so it needs no change.

## Left undone, on purpose

**The bodega interior door is not realigned.** It sits on the interior west
wall at `(240.02, 1.05, -17)`, where the entry spawn `jumpTo(241.3, -17, …)`
and the exit trigger at `(240.5, -17)` both expect it. Canting the interior's
SW corner to mirror the outside means moving that door about 2 m, which puts it
outside the exit trigger's r = 1.0 — i.e. **a softlock inside the shop** until
`crosstown.ts` is updated in the same commit. That is a coordinated change
across a file I do not own, so I left the working entrance alone rather than
ship a half of it. If the desk wants it: cant the room's SW corner by 1.4 m,
put the door at `(240.9, 1.05, -18.1)` rotated `-Math.PI * 0.75`, nudge the
counter to z = -18.05 and the keeper to z = -18.58, and move the spawn to
`(241.6, -17.6)` and the exit trigger to `(241.4, -17.9)`.

`BRIEF-ROSTER.md` (the block re-cast — fast food, casino, corporation,
library, taxes, hotel, pawnshop, thrift, Catholic church) is queued and **not
started**. Flagging the point that brief makes itself: the library and the
church need their own facade vocabulary, and `placeBld`/`placeBldZ` as they
stand can only make brick-awning-band-glass. They will need a separate builder,
not a roster entry.

---

## Blast radius

Fingerprints: `shots/before.json` (baseline build on 4188) vs `shots/after.json`.

- **Facade, shopfront and rear-wall textures are byte-identical.** No
  `96x144`, `144x172`, `80x116`, `80x40`, `96x40` or the rear wall's `80x150`
  appears in the diff. The rear wall the user likes is untouched, confirmed at
  the pixel level.
- Structure diff is exactly the intent: every shell loses the `.05` slop
  (`depth=12.05 → 12`, `width=13.05 → 13`), the old `63x60` side-wall planes
  and the cat-box meshes are gone, the two flanks and the cats are new.
- Positions: only alley objects moved. The handful of pigeons that drift by a
  few cm are the documented noise floor.
- Ignore the "108 textures differ" line from `fpdiff`. Two things make it
  meaningless here: it compares the sorted lists index-wise, so inserting two
  entries shifts everything; and three.js `generateUUID()` draws four
  `Math.random()` values per object/material/texture, so **any** structural
  change re-phases the harness's seeded stream for every texture built after
  it. Use a real multiset diff, and read the texture hash as "did the art
  change" only when the object count is identical.

## Shots to look at

| what | file |
|---|---|
| the six cats, all at once | `street/shots/user-cats.png` |
| the canted corner bay | `street/shots/user-bodega-corner.png` |
| wall behind REZO — plain brick now | `street/shots/user-alley-panel.png` |
| where the plywood and bags were | `street/shots/user-alley-junk.png` |
| both flanks, rear wall, dumpster | `street/shots/al-in.png`, `al-wall-north.png`, `al-wall-south.png`, `al-wall-rear.png` |

`node scripts/alley.mjs` regenerates all of them (`SHOT_URL` selects the
server). The `user-*` shots have fixed names on purpose — they are the ones
the user is shown, so re-running the script updates them in place.

## Verify

```bash
cd /home/erick/projects/rpg-alley/street
npm run build
npx vite preview --port 4185 --strictPort &
export SHOT_URL=http://localhost:4185/
npm run fp after && npm run fpdiff shots/before.json shots/after.json
node scripts/alley.mjs && npm run sweep
```

---

# STATUS — block re-cast (commit 8fceb73)

Committed and safe to build on. Full detail in `notes/feat-roster.md`; this is
the short version for the module split.

**Touched:** `ct/street.ts`, `ct/tex-world.ts` (shop band only),
`scripts/roster.mjs` (new). Build clean, `npm run sweep` no new page errors.

## DONE

- **Roster re-cast.** All nine requested places exist. User's named placements
  applied: BURGER BARN in the old pawnshop slot, PAWN in the old cinema slot,
  A-1 TAX in the old arcade slot.
- **Library** — own builder, not a shopfront. Recessed entrance bay (doors 1.8 m
  back), 5 risers + cheek walls inside the recess, 13.2 m. Sidewalk verified
  clear: nothing below head height crosses x = -6.7, no colliders added.
- **Church** — own builder. Gable prism, pointed doorway in three orders,
  lancets, rose window, buttresses, tower + spire + cross to 32.4 m.
- **Casino + hotel** at the far end, rooftop pylon facing along the street,
  lit parts `fog: false`.
- **Mirrored blade sign** — root cause fixed (`transparent: true` + `alphaTest`
  put both faces in the sorted pass; the far face painted over the near one).
  Dropped `transparent`, used `FrontSide`. Verified both faces from both sides.
- **Shop scale** — `SHOP_BAND_H = 4.2` for shops, residential stays
  `ENTRANCE.BAND_H = 3.2`; `shopfrontTex` rebalanced to 52 texels with a
  stallriser. Bodega bay, awning and corner shops rechecked against it.

## NOT DONE

- **Six-cat rig still in the alley** — deliberate, waiting on the user's pick.
  To keep one: delete `CAT_DESIGNS` and the loop under it, call the winner's
  `draw` once at `(-10.55, AZ1 + 0.6)`. Nothing else references either.
- **Bodega `[E]` trigger move** — still outstanding in `crosstown.ts`, unchanged
  by this work. Coordinates are in the first half of this file.
- **`ct/props.ts:288`** carries the same redundant `alphaTest` + `transparent`
  pair that caused the mirrored sign. Cannot show the bug today (it is a
  player-facing billboard) but it is the same hazard; not my file.

## FOR THE MODULE SPLIT

`ct/street.ts` splits cleanly along these seams — they share almost nothing:

1. **rosters + `placeBld`/`placeBldZ`** — the four roster arrays, `bandOf`, and
   the two generic placers.
2. **civic** — `STONE`/`ashlar`/`archFill`/`engrave`/`roseWin`/`clcg`, then
   `placeLibrary` and `placeChurch`. Self-contained; only needs `flat`, `pixTex`,
   `dither`, `FACE`.
3. **character shopfronts** — `burgerFront`/`pawnFront`/`taxFront`, keyed off
   `BldSpec.front`.
4. **bodega corner** — the canted bay block, incl. `bodegaBrick` and the
   sidewalk gap triangle.
5. **alley** — flanks, dumpster, tags, and the cat rig.
6. **far end** — the casino pylon and hotel blade, incl. `neonM`/`twoSided`.

Load-bearing constants that must survive the split, all commented in place:
west-of-alley widths total **51.2**, west-of-alley-south **54.5**, east-before
No. 227 **49.2**; both side-street rosters end on **x = 57**;
`SHOP_BAND_H` drives the bodega awning height and the sign heights.
