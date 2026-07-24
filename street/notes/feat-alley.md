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
