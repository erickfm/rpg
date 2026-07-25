# Seam & texture-continuity audit — CROSSTOWN '97

> **Round 2 (live @ `9610e25`) is at the bottom of this file.** The block was
> re-cast after round 1 — new roster, new landmarks, `SHOP_BAND_H` introduced —
> so every camera below is aimed at a building that has since moved. Round 2
> re-shoots against the current world and says which of these 28 findings
> survived. Read the triage table there before acting on anything here.

## Round 1 — baseline `d731273`

**Branch** `audit/seams` @ `d731273` · read-only · nothing under `street/src/` was
touched. Sweep scripts added: `scripts/seams.mjs` (97 shots), `scripts/seams2.mjs`
(49 shots + a walkability probe), `scripts/seams3.mjs` (12 shots). All images are
`street/shots/seam-*.png`. Audited at 13:00 with a night spot-check at 22:30/23:00.

Method: every junction shot from at least two angles including one grazing, plus
**plan views** (pitch −1.3, straight down) over the ground abutments and **45°
bisector views** of every corner arris so both faces are the same distance from
the camera — screen-space size comparisons across a corner are meaningless
otherwise. Where a defect is a texel-density mismatch the number in the "what's
wrong" column is computed from the source, not eyeballed.

---

## Findings

| # | sev | kind | where (world coords + camera) | what's wrong | likely file | screenshot |
|---|-----|------|-------------------------------|--------------|-------------|------------|
| 1 | **high** | gap / untextured | every building-to-building join with a height change — 14 of them. e.g. DELI/CINEMA at z=−74 and LIQUOR/No.227 at z=−53, cam (−1.5, −64) yaw +x | Where a taller shell abuts a shorter one the taller one's exposed party wall renders as `endM`, a **flat untextured `#53382e`** — no brick, no courses, no windows. It reads as a brown cardboard wedge above the shorter roof. Visible from anywhere on the street looking down the block. | `ct/street.ts` (`placeBld`/`placeBldZ` mats arrays) | `seam-J-east-liquor-deli`, `seam-C-roofline-east`, `seam-S-sign-scale-side`, `seam-R-hotel`, `seam-R-parapet` |
| 2 | **high** | texture continuity + scale | the bodega's canted corner, x 7…10.4 / z −96…−86, cam (6.0, −99.0) → (9, −96) and (5.6, −98.6) | **The user's reported defect, confirmed and measured.** Four different brick sizes meet round one corner: main-street facade **1.125 × 0.457 m**, canted bay **1.107 × 0.427 m**, corner pier **1.05 × 0.428 m**, side-street wing **0.851 × 0.457 m**. Cause: `facadeTex` derives vertical density from `(32+floors·28)/(3.4+floors·2.4)` = 10.94–11.17 px/m, `bodegaBrick` hard-codes 11.7 px/m, and the 6.05 m wing hits `Math.max(64, …)` so its horizontal density jumps to 10.58 px/m. Each texture also starts its courses at its **own** top, so phase diverges too. | `ct/street.ts` (`bodegaBrick`) + `ct/tex-world.ts` (`facadeTex`) | `seam-X-bodega-S-arris`, `seam-A-bodega-corner-close`, `shots/user-seam.png` |
| 3 | **high** | texture continuity | **every** building on the block, horizontal line at y = 3.2 m. Worst on No. 227 (z −53…−35) where the whole ground floor is bare brick — cam (2, −44) yaw +x | Three different course heights stack on one elevation: shopfront band **0.40 m** (`shopfrontTex`, 40 px / 3.2 m), residential ground **0.50 m** (`resGroundTex`, 32 px / 3.2 m), wall above **0.447–0.457 m** (`facadeTex`). The bond steps visibly at the shop line the full width of the building. | `ct/tex-world.ts` | `seam-R-res-band-seam` |
| 4 | **high** | scale mismatch | alley floor, x −7…−13.6 / z −43.5…−37, abutting the west walk at x = −7. cam (−6.2, −40.2) plan and (−5.6, −40.2) grazing | The alley floor is ONE 64×64 canvas stretched over 6.6 × 6.5 m = **9.7 px/m**, abutting a sidewalk at **32 px/m** and a road at 14–19 px/m. Three-to-one grain jump in a single frame, plus the stain blobs and the drain each appear exactly once so they read as smears rather than as ground. | `ct/street.ts` (`alleyFloorT`) | `seam-P-walk-alley-mouth`, `seam-T-alley-threshold`, `seam-D-alley-floor` |
| 5 | **high** | functional (collision) | bodega door trigger at (8.7, −96.85), r = 1.05 | **You cannot enter the bodega from the sidewalk.** The fruit-crate collider `{7.5…9.7, −96.9…−96.2}` plus the 0.36 m player radius blocks x 7.14…10.06 / z −97.26…−95.84 — which *contains the trigger centre*. Probe: walking west along the north walk you stop at **x = 10.06, 1.36 m short**, no prompt. It only fires if you step into the roadway and walk in from the south (closest 0.41 m). Corroborates the user's "i cant enter cause the collision of the corner is still there" — though in this tree the culprit is the crates, not the chamfer. | `crosstown.ts` (colliders + `SPOTS`) | probe output in `scripts/seams2.mjs` |
| 6 | **high** | texture continuity | the two road planes abut at z = −98, full width of the intersection. cam (0, −98) looking straight down | The road grain **restarts and changes scale**. Main road tile = 3.33 × 4.47 m (`asphaltTex(10,134)` → repeat 3×30 on a 10×134 plane); side road tile = 3.44 × **5.00 m** (`asphaltTex(62,10)` → repeat 18×2 on a 62×10 plane). 12 % coarser in z and an unrelated phase, so a hard line runs across the junction. | `crosstown.ts` (`road` / `sideRoad`) | `seam-P-road-seam-98`, `seam-B-road-seam-98` |
| 7 | **high** | texture continuity | every vertical join where the neighbours have different floor counts — ARCADE/CAFE z=−22, CINEMA/DELI z=−74, HOTEL/RADIO z=−98, TAILOR/CHOP SUEY x=33.45 | Course height comes out of the floor count (`H = 32+floors·28` over `3.4+floors·2.4`) and every texture starts counting from its own roofline, so neighbours of unequal height diverge by up to half a course over the elevation. Neighbours with the **same** floor count line up perfectly (DELI/LIQUOR) — which is exactly why this reads as a bug rather than as variety. | `ct/tex-world.ts` (`facadeTex`) | `seam-C-east-cafe-arcade`, `seam-J-east-liquor-deli`, `seam-R-hotel` |
| 8 | medium | texture continuity | north-end cross building z=13.5 meeting BOOKS at x=7 and DINER at x=−7. cam (4, 10.5) → (7, 13.5), 45° bisector | Cross building is 144 px over 13.6 m = **10.59 px/m**; BOOKS/DINER are 11.08. Courses run at different heights and out of phase across the arris, and the cross building's windows are visibly larger. The shop band also dies into bare brick at the corner (the cross building has no shopfront). | `ct/street.ts` | `seam-X-north-cross-E`, `seam-C-north-cross-east` |
| 9 | medium | scale mismatch | east cross building x 57…63 meeting OPTICIAN at x=57 / z=−96. cam (52, −101) → (57, −96) | `facadeTex('#5c4436', 4, 22)` is painted for 22 m and mapped onto the box's 24 m face → **7.33 px/m** against OPTICIAN's 8.0. Bricks and windows are ~9 % larger on one side of a concave corner where both faces are the same distance from the eye. | `ct/street.ts` | `seam-X-side-east-end` |
| 10 | medium | geometry overlap | OPTICIAN spans x 46.45…58.45, east cross building starts at x=57 | 1.45 m of OPTICIAN's shell is buried inside its neighbour, taking ~1 m of its centred sign band with it. `NORTH2` runs to x=58.45 but the roster was laid out as if the street ended at 55. | `ct/street.ts` (`NORTH2` widths) | `seam-X-side-east-end` |
| 11 | medium | texture continuity | every tree pit, e.g. (5.4, −29.5). cam (5.4, −29.5) plan | The pit is 0.8 × 1.0 m at x 5.0…5.8 / z −30…−29, but the slab joints fall on **integer x and half-integer z** — so the pit straddles a joint instead of replacing slabs, contradicting `treePitTex`'s own comment ("it FITS the grid"). It also starts at x = 5.0 while the walk starts at 5.0625, so 6 cm of pit hangs over the kerb arris, 6 mm above it. | `ct/props.ts` (pit placement) + `ct/tex-ground.ts` (grid phase) | `seam-P-walk-treepit`, `seam-K-kerb-graze-clear` |
| 12 | medium | scale mismatch | the canted bay's shopfront, (8, −95) plane, against the shopfronts either side. cam (6.0, −99.0) → (9, −96) | `bayFrontT` is 48 px over 2.828 m = **16.97 px/m** horizontally; `shopfrontTex` next to it is 8 px/m. Mullions, frames and display glass are 2.1× finer across a single arris — the bay reads as a different, higher-resolution building. Texels there are also non-square (16.97 × 12.5). | `ct/street.ts` (`bayFrontT`) | `seam-X-bodega-S-arris`, `seam-A-bodega-corner-close` |
| 13 | medium | scale mismatch | every shop narrower than 8 m: FLOWERS (6 m, x 16.45…22.45), the bodega wing (6.05 m). cam (19, −102) → (26, −96) | `Math.max(64, wMeters*8)` clamps the canvas, so a 6 m shop is painted at **10.67 px/m** and an 18 m one at 8.0 — the narrow shop's brick, glazing and sign lettering come out up to 33 % finer than its immediate neighbour's. | `ct/tex-world.ts` (`facadeTex`, `shopfrontTex`) | `seam-S-sign-scale-side` |
| 14 | medium | scale mismatch | apartment hall/lobby/301, x≈200 | Three densities in one room: carpet/wood floor **35.6 px/m** (64 px per 1.8 m), wallpaper **23.7 px/m** (64 px per 2.7 m), ceiling **17.8 px/m** (32 px per 1.8 m). The ceiling is half the floor's resolution and its dither reads as chunky confetti. | `ct/apartment.ts` | `seam-E-hall3-ceiling`, `seam-E-lobby-corner` |
| 15 | medium | stretched texture | bodega interior walls, x 240…248 / z −19…−11 | `plasterT` is 32 × 54 mapped to 8 m × 2.7 m → **11.85 px/m horizontal × 20 px/m vertical**. Non-square texels at 1.7 : 1; every dither speck is a horizontal dash, and it abuts a lino floor at 24 px/m. | `ct/bodega.ts` | `seam-F-bodega-corner-NW` |
| 16 | medium | gap (sky) | alley, looking up toward the end wall. cam (−10, −40.2) pitch +1.15 | The end wall is 12.8 m tall; the flanks either side of it are 16.2 m (MUSIC) and 18.6 m (PAWN). Standing in the alley and looking up you see **open sky over the back wall**, between two buildings that are supposed to be five storeys of solid block. | `ct/street.ts` (`alleyEnd` height) | `seam-D-alley-up` |
| 17 | medium | layout continuity | No. 227's elevation, z −53…−35 | The ground-floor windows and the upper-floor windows are laid out by two unrelated algorithms (`resGroundTex.panel()` vs `facadeTex`'s fixed 22 px pitch), so **no window column stacks**. On the one building the player actually uses this is the most-looked-at facade in the world. | `ct/tex-world.ts` | `seam-R-res-band-seam` |
| 18 | medium | gap / junction | alley mouth, x = −7, z −43.5…−37. cam (−5.6, −40.2) pitch −0.75 | The west walk runs straight through the alley mouth unbroken; the alley floor sits **13.5 cm lower** and the only thing between them is the walk box's flat dark side face (`walkDarkM`). No threshold, no kerb, no ramp — you step off a 13 cm ledge into the alley. | `ct/tex-ground.ts` (walk slab) + `ct/street.ts` (alley floor) | `seam-T-alley-threshold`, `seam-P-walk-alley-mouth` |
| 19 | medium | texture continuity | alley mouth arrises at (−7, −37) and (−7, −43.5). cam (−4, −34) → (−7, −37) | PAWN's street brick is `#835444` and PAWN's own alley flank is `#623f32`; MUSIC's are `#6b4034` and `#563a2f`. Same building, 90° arris, no transition — it reads as four buildings, not two. Course pitch also differs (street 0.447–0.451 m vs alley 0.427 m). | `ct/street.ts` (flank palettes) | `seam-X-alley-N-arris`, `seam-D-alley-mouth-north` |
| 20 | medium | scale mismatch | centre lines, main street vs side street, meeting at the intersection | Main street: `repeat(1,38)` over 134 m = **3.53 m per dash cycle**. Side street: `repeat(1,22)` over 48 m = **2.18 m**. 38 % shorter dashes on one leg of the same junction. | `crosstown.ts` (`lineT` / `lineT2`) | `seam-B-side-centreline`, `seam-R-ramp-elev` |
| 21 | medium | thin-face aliasing | gutter pan, whole kerb line. cam (6.0, −97.6) plan, (4.35, −56) grazing | `gutterTex` puts 150 dither pixels + 90 grit pixels into a 96 × 14 canvas — **~8× the per-texel noise density of the walk** it abuts at the same 32 px/m. The pan reads as a gritty band of a different material scale rather than as concrete. | `ct/tex-ground.ts` (`gutterTex`) | `seam-P-kerb-ramp`, `seam-K-kerb-graze-clear` |
| 22 | low | floating geometry | bodega awning, bay-local (0, 2.15, 0.35), 2.828 × 0.9 m | The awning is the full width of the bay and 0.9 m deep, so its two corners project past both arrises and hang unsupported in front of the neighbouring shopfront bands. Its inner edge also sits ~9 cm *behind* the bay face (0.35 − 0.45·cos 0.18), i.e. it pokes through the wall. | `ct/street.ts` | `seam-R-ramp-elev`, `seam-A-bodega-corner-eye` |
| 23 | low | reads-wrong | kerb ramp on the corner return, centre of the 3.5 m arc at (5, −98). cam (3.2, −99.5) → (6.4, −97.4) | The ramp is geometrically present (reveal drops 0.14 → 0.025 m) but reads as a slight sag in the kerb line: no flared-side facets, no ramp panel in the walk surface, no change in the slab texture. You would not know it was a ramp. | `ct/tex-ground.ts` (`revealAt`, fan) | `seam-R-ramp-elev`, `seam-B-kerb-ramp` |
| 24 | low | untextured | bodega interior ceiling, y = 2.7, x 240…248 | Flat `0xb0aa9c` with no map at all, against a checkered lino floor and a dithered plaster wall. Reads as a hole. | `ct/bodega.ts` | `seam-F-bodega-ceiling` |
| 25 | low | geometry overlap | DINER (z 2.2…14.2) and BOOKS (z 1.2…14.2) vs the north cross building (z 13.5…19.5, y 0…13.6) | Both shells push 0.7 m into the cross building. They are also 2.6 m taller than it, so above y = 13.6 their facades and end caps stick out of its roof. The player can stand at z = 13 (bounds max), half a metre away. | `ct/street.ts` | `seam-C-north-cross-east`, `seam-X-north-cross-E` |
| 26 | low | free-standing plane / mirrored | alley flanks, `PlaneGeometry(7.0, h)` at x −7…−14, z −37.01 / −43.49 | The flanks are 7 m wide but the shells behind them are only 3.4 m deep, so 3.6 m of each is a single-sided plane with nothing behind it (it works only because you cannot get round the back). The north flank is placed with `rotation.y = π`, so its paint is horizontally **mirrored** — invisible today only because that texture has no asymmetric motif, but it will bite the moment anything legible goes on it. | `ct/street.ts` | `seam-D-alley-up`, `seam-D-alley-inside` |
| 27 | low | stale content | `SPOTS[0].label` in `crosstown.ts` | Prompt still reads **"[E] enter THE WHITMORE"** although `ct/apartment.ts` records that the name was removed and explicitly must not come back ("both are gone. Don't put one back"). | `crosstown.ts` | `seam-S-transom-227` |
| 28 | low | reads-wrong | the corner, x 7…16.45 / z −96…−86 | Three "BODEGA" sign bands within four metres of each other (main street, canted bay, side-street wing) plus the awning. From the intersection you read the word four times in one glance. | `ct/street.ts` | `seam-A-bodega-corner-eye`, `seam-R-ramp-elev` |

### Checked and clean

Worth recording, because these are the places the same class of bug would
normally live and they are correct:

- **The sidewalk slab grid is genuinely continuous** through the corner return
  fan, the bodega gap triangle and both side-street walks — `walkTex`'s
  world-space repeat/offset and the fan's per-vertex `walkU`/`walkV` do the job.
  (`seam-P-walk-corner`, `seam-P-walk-side-north`.)
- **No mirrored text anywhere in this tree.** I read every legible string from the
  street: all shopfront names on both sides of both streets, the bay sign, OPEN,
  CITY WASTE, PHONE, the REZO / SNAK / KOBRA placas, the 227 transom, the door
  numbers, the watch face. All correct-handed.
- **The red-kerb rule holds.** Both legs of the junction and both sides of the
  hydrant are painted, and nothing else is. (`seam-R-side-red-kerb`,
  `seam-R-ramp-elev`.)
- **No z-fighting found.** Every coplanar pair I could find abuts or is
  polygon-offset. I looked hard at the road/wedge seam at the corner, the walk
  slab tops against the fan, the gap triangle against both walks, the paint quad
  against the kerb face, and the building end caps — nothing shimmered at any
  grazing angle or at 22:30.
- **The kerb face and arris do not crawl** at grazing incidence — the `thin()`
  mipmap-free treatment plus the coarse-features rule is working.

---

## Patterns — the root causes, not the instances

1. **Texture size is derived from the mesh, but the mesh's neighbour is never
   consulted.** Almost every finding above is one function computing px/m from
   its own dimensions in isolation: `facadeTex` from floor count, `bodegaBrick`
   from a hard-coded 11.7, `shopfrontTex` from a 40 px canvas, `bayFrontT` from a
   48 px one, `alleyFloorT` from nothing at all. The fix is not per-instance: it
   is a single world constant for masonry density (px per metre, square texels)
   that every wall painter takes as input and sizes its canvas from, exactly as
   `walkTex` already does for the ground. `walkTex` is the model — it is the one
   family of surfaces in the world with no continuity bugs.

2. **Every wall texture starts its courses at its own top edge.** Even at
   identical density, two neighbours of different heights are out of phase. Brick
   courses are a *world-space* datum: the bond should be laid from y = 0 up, not
   from each mesh's roofline down.

3. **`Math.max(64, w*8)` silently changes scale.** The clamp was presumably there
   to keep a canvas from getting too small to draw on, but its effect is that any
   building under 8 m wide is painted at a different resolution from the block —
   and this world is full of narrow shops. Same story for `Math.max(12, …)` in
   `bodegaBrick`.

4. **`endM` is a placeholder that has become load-bearing.** A flat colour was
   fine while every building was the same height. Now that heights vary, that
   flat colour is what you see above half the rooflines on the block. Exposed
   party walls need the same brick treatment the alley flanks already got.

5. **Ground surfaces authored before `tex-ground.ts` never joined the system.**
   The road planes, the side road, the centre lines and the alley floor each
   carry their own ad-hoc repeat. The kerb/walk/gutter module already proved the
   pattern (world extents in, repeat + offset out); the road did not adopt it,
   which is why the only ground discontinuity in the world is at z = −98.

6. **Colliders are authored against object bounds, not against the affordances in
   front of them.** The crates' box is generous enough to swallow the bodega's own
   door trigger. Anything that owns an `[E]` spot needs its approach corridor
   treated as reserved space.

---

## Coverage — what I did NOT get to

- **The landmarks the brief names do not exist on this branch.** There is no
  library, no church, no casino, and no hotel blade sign in `audit/seams` @
  `d731273`. The only HOTEL here is an ordinary `placeBld` shopfront band on the
  west side at z −98…−86 (`seam-R-hotel`). Likewise there is no GOLDEN ACES roof
  marquee. Those are being built in other worktrees (`rpg-alley`,
  `rpg-entrance`, `rpg-ground`, `rpg-split2b`) and will need their own pass once
  they land. **Categories 6 (mirrored) and 4 (gaps) are therefore unaudited on
  exactly the newest, least-tested geometry.**
- **Night pass was a spot-check, not a sweep** — four shots (corner, kerb, lamp,
  alley) at 22:30/23:00. I did not walk the block at night.
- **Room 301, the stair flights and the stair undersides** got one angle each,
  not two. The half-landing soffits and the `divider` core wall are unexamined at
  grazing angles.
- **I sampled 5 of 8 west-side and 5 of 8 east-side building joins**, plus 3 of 4
  on the north side street and 2 of 5 on the south. The pattern is systematic
  (finding 7), so I do not expect surprises in the rest, but they are not shot.
- **Cars, citizens, the cat, pigeons, litter, rain and puddles** were not audited
  except where they happened to be in frame.
- **Interiors of the bodega beyond the four walls** — the gondolas, cooler and
  counter got one angle each.
- I could not verify **finding 5** end-to-end by actually pressing E and landing
  inside, only that the prompt does/does not appear from each approach; the warp
  hook bypasses collision so the teleport itself is untestable from a script.

---

## Note on the mid-turn build requests routed to this session

Five build requests arrived in this session — SIGNS, WINDOW LIGHTS, BODEGA,
CHURCH tower, BURGER BARN palette. They are addressed to the builder ("you own
these", "I am handing you `facadeTex`"), and this brief makes me read-only. I
have not edited anything.

Three of them target geometry that **does not exist on this branch**: there is no
church, no bell tower, no BURGER BARN, no GOLDEN ACES marquee and no hotel blade
sign anywhere in `audit/seams` @ `d731273`. `grep -riE 'church|burger|tower'` over
`street/src/` returns nothing here; the church and BURGER BARN are in
`ct/street.ts` on `main`/`feat/alley`/`feat/ground`/`live`. Whoever holds those
branches owns those changes.

The bodega items I *can* speak to from this branch's evidence:

- **Bodega (1) — cannot enter**: reproduced and root-caused here as finding 5.
  Door world coordinates for the desk to check `SPOTS` against: the canted bay's
  plane is centred at **(8, −95)** with outward normal **(−0.707, 0, −0.707)**;
  the door leaf is on the bay centreline, so the natural standing spot is about
  **(6.6, −96.4)**, not the current **(8.7, −96.85)** — the existing trigger sits
  behind the crates and off the door's axis.
- **Bodega (2) — door not readable / OPEN over a window**: confirmed; the door,
  the two display panes and the reveal are all one 48 × 40 canvas at 16.97 px/m
  and the `open` plane is placed at bay-local x = −0.82, i.e. over the left glass.
- **Bodega (3) — crates**: confirmed as drawn; they are seated correctly (base at
  y = 0.14 = walk top), so "floating" is reading as float because there is no
  contact shadow and the slat texture wraps the bottom face.
- **Signs**: the two signs described (GOLDEN ACES marquee, hotel blade) are not in
  this tree, so I cannot diagnose them. The general rule the builder needs is
  worth stating anyway: for a plane, a back face gives **mirrored-but-upright**;
  **upside-down AND mirrored** is a 180° rotation about the plane's own normal
  (`rotation.z += π`, or an equivalent negative Y scale), which is a different
  transform and cannot be fixed by flipping the face. Test with an asymmetric
  string — "F" or "R" alone is enough.
- **Window lights**: a feature request, not a seam. Worth flagging for whoever
  does take it: the overlay plane must be built from the **same** canvas geometry
  as the facade it sits on, or it will inherit findings 2, 7 and 13 — a lit-window
  overlay derived independently will not register with the dark windows painted
  underneath it on narrow shops or on buildings with an odd floor count.
- **Church / BURGER BARN**: not in this tree, see above.

None of these five were logged to `street/FEATURE-REQUESTS.md` from here — that
file is owned by whoever holds the live branch, and an edit from this worktree
would collide.

---

# Round 2 — re-run against the re-cast block (`live` @ `9610e25`)

Round 1 was shot at `d731273`. Since then ~2,000 lines landed across every file
it covered: the whole roster was re-cast, `SHOP_BAND_H` was introduced, and four
landmarks arrived (library, church, casino pylon, hotel blade). Sweep
`scripts/seams4.mjs` (50 shots, layout recomputed from the new rosters),
`scripts/seams5.mjs` + `scripts/seams6.mjs` (16 shots, signs from both sides).
Images are `shots/seam2-*.png`.

Current layout, for anyone aiming a camera:

```
WEST  z   DINER 14.2..5 · MERIDIAN 5..-5 · LIBRARY -5..-21 · BURGER BARN -21..-37
          [alley -37..-43.5] · LAUNDRY -43.5..-55.5 · BARBER -55.5..-68
          THRIFT -68..-82 · GROCERY -82..-98
EAST  z   CAFE 14.2..3 · HARDWARE 3..-9 · A-1 TAX -9..-22 · LIQUOR -22..-35
          No.227 -35..-53 · PAWN -53..-65 · DELI -65..-76 · RECORDS -76..-86
          BODEGA -86..-96
NORTH2 x  FLOWERS 16.45..22.45 · CHOP SUEY 22.45..33.45
          HOTEL ORPHEUS 33.45..45.45 · GOLDEN ACES 45.45..57
SOUTH2 x  ST BRIGID -7..11 · GARAGE 11..23 · BILLIARDS 23..35 · SMOKES 35..46
          LOANS 46..57
```

## New findings

| # | sev | kind | where (world coords + camera) | what's wrong | likely file | screenshot |
|---|-----|------|-------------------------------|--------------|-------------|------------|
| R1 | **high** | mirrored texture | **both** `twoSided` signs: HOTEL blade at (44.35, 7.4, −96.72), GOLDEN ACES pylon at (51.225, 25.2, −95.0). Cam (42, −96.72) vs (46.5, −96.72); (34, −103) vs (56, −103) | **The mirroring is not fixed.** `twoSided` builds two planes at `rotation.y = ±π/2` and calls `pixTex(tw, th, draw)` with the **identical** `draw` for both, so the two faces are mirror images in world space. Demonstrated: the blade's `E` and `L` read correctly from the west and reversed from the east; GOLDEN ACES reads correctly from the west and reversed from the east. Both faces are reachable on foot (the side street runs to x = 57). The comment above the helper asserts the opposite — *"the back face gets a texture that was painted mirrored, so the two faces carry genuinely different images"* — and no code does that. A future reader will believe this is handled. | `ct/street.ts` `twoSided()` | `seam2-Z-blade-west-near` / `seam2-Z-blade-east-near`, `seam2-W-marquee-west-reach` / `seam2-W-marquee-east-r2` |
| R2 | **high** | floating geometry | GOLDEN ACES rooftop pylon, legs at z = −91.8 and −98.2, frame box z −99.6…−90.4 | **The pylon stands on nothing.** GOLDEN ACES' shell is only 3.4 m deep — z −96.0…−92.6. The two legs are placed at `−95.0 ± 3.2`, i.e. 0.8 m *behind* the back wall and 2.2 m *in front of* the facade, out over the sidewalk. Their bottoms are at the correct roof height (17.2 m) but there is no roof under either of them. The 9.2 m frame box overhangs the building by 3.6 m at the front and 2.2 m at the back. From the street the whole pylon reads as hovering — which is the original "hanging out with no sense" complaint in a new form. | `ct/street.ts` (casino pylon) | `seam2-W-marquee-west-reach`, `seam2-Z-marquee-east` |
| R3 | **high** | texture continuity | z = −35 (LIQUOR ∣ No. 227) and z = −53 (No. 227 ∣ PAWN). Cam (−1, −53) yaw +x | **New, introduced by `SHOP_BAND_H`.** `bandOf()` gives shops 4.2 m and the walk-up `ENTRANCE.BAND_H` = 3.2 m, so the ground-floor/upper-wall boundary — the one continuous horizontal datum running the length of the block — **steps 1.0 m** at both of No. 227's party walls. It is the player's home building and the step is at eye level. | `ct/street.ts` `bandOf()` + `ct/tex-world.ts` | `seam2-V-res-band-step`, `seam2-V-res-band-step-2` |
| R4 | medium | untextured | LIBRARY z −5…−21 (LIB_H 13.2) between MERIDIAN (5 floors) and BURGER BARN (4 floors) | Round-1 finding 1 recurring on the most carefully composed building on the block: the library is shorter than both neighbours, so a slab of flat `#53382e` sits on each of its shoulders, framing the entablature. | `ct/street.ts` | `seam2-N-library-front` |
| R5 | medium | palette (open request) | BURGER BARN, west z −21…−37 | The red/yellow the user asked to drop is still in four places: fascia lettering `#f2d24a`, the mustard accent stripe `#e8a02a`, the interior glow `#e8c26a`, and the menu-board rules `#f2d24a`. | `ct/street.ts` `burgerFront()` | `seam2-Z-burger-close`, `seam2-Z-burger-night` |
| R6 | low | duplicate resource | `twoSided()` | `pixTex()` is called once per face with identical arguments, so every two-sided sign allocates two identical canvases and two GPU textures. Harmless today; it becomes a real difference the moment one of them picks up `dither()`, which is unseeded. | `ct/street.ts` | — |

## Triage of the round-1 findings against the current world

| round-1 # | status | note |
|---|---|---|
| 1 (untextured party walls) | **still live** | `endM` unchanged, and height variation increased. Now also frames the library (R4). |
| 2 (bodega chamfer brick) | **still live** | `facadeTex` and `bodegaBrick` both untouched. `seam2-V-bodega-arris` |
| 3 (shop band vs wall courses) | **still live** | `SHOP_BAND_PX` 52 over 4.2 m = 12.38 px/m → 0.404 m courses against 0.447–0.457 above. The seam moved from y = 3.2 to y = 4.2; the mismatch is unchanged. Now compounded by R3. |
| 5 (bodega unreachable from the walk) | **still live, unchanged** | Re-probed on live: walking west along the north walk you stop at **x = 10.09**, closest approach **1.39 m** against a 1.1 m trigger — no prompt. Off the roadway: 0.44 m, prompt fires. Collider `{7.5, 9.7, −96.9, −96.2}` is byte-identical in `crosstown.ts`. |
| 6 (road grain at z = −98) | **still live** | `seam2-V-road-seam-98` |
| 7 (courses break on floor-count change) | **still live** | `facadeTex` untouched. `seam2-V-endcap-east` |
| 4, 16, 18, 19, 26 (alley) | **still live** | Alley code untouched; BURGER BARN is now the north neighbour, so the flank palettes belong to a different building than the comments say. `seam2-V-alley-mouth-plan`, `seam2-V-alley-up` |
| 11 (tree pits off the slab grid) | **still live** | `seam2-V-treepit-plan` |
| 8, 9, 10 (north/east cross buildings) | **not re-shot** | Rosters around them changed; needs its own pass. |
| 12, 13 (bay shopfront / narrow-shop clamp) | **still live** | `Math.max(64, …)` unchanged; FLOWERS is still 6 m. |
| 20 (centre-line dash pitch) | **still live** | `crosstown.ts` lines unchanged. |
| 27 (`THE WHITMORE` label) | **still live** | `crosstown.ts` `SPOTS[0]`. |
| 14, 15, 21, 22, 23, 24, 25, 28 | **not re-verified** | Interiors, gutter noise, awning, kerb ramp — those files did not change, so I expect them unchanged, but they are not re-shot. |

## Notes for the two open build requests

**Church tower** (`ST BRIGID`, x −7…11, facade z = −110). Baseline shots before
removal: `seam2-N-church-front-wide`, `seam2-N-church-below`,
`seam2-N-church-roof-plan`, `seam2-Z-church-tower`, `seam2-Z-church-tower-2`.
Two things the "reads as finished" check will need:

- The tower carries a **dark spire as well as the cross** (visible at distance in
  `seam2-Z-blade-east-near` and `seam2-N-aces-graze`). It is the block's only
  vertical accent on the side street and the one thing that reads at 40 m — with
  it gone, the south side of the side street has no silhouette event at all.
- The gable already has a small round medallion at its apex
  (`seam2-N-church-front-wide`, above the rose window), so a modest cross there
  has somewhere to sit without re-composing the front.

**Signs.** R1 and R2 are the two live defects. R1 is one fix in one helper and it
cures both signs. R2 is arithmetic: the legs need to land inside z −96.0…−92.6.
The other original complaints — marquee squared to the street, standing on legs
and a frame rather than one stick — are **already addressed** on live and read
correctly (`seam2-W-marquee-west-reach`).

---

# Round 3 — re-verifying pattern #1 after builder A's density fix

Base `add-stick-and-city98` @ `6976f13`. A's change is `ct/tex-world.ts` only
(`notes/A-density.md`). Verified independently rather than from A's table:
`scripts/density.mjs` pairs every texture canvas with the face it is mapped to
and reports px/m on both axes, so "one density" is measured off the running
world, not read off a constant. Confirmation shots `shots/reverify-*.png`.

## Measured densities now (103 wall-sized exterior faces)

| surface | px/m across × up | verdict |
|---|---|---|
| every `facadeTex` upper wall, 3/4/5 floors | **8.00 × 8.00** | one density, square texels |
| every `shopfrontTex` band, incl. the three character fronts | **16.0 × 15.95** | 2× — integer multiple, commensurate |
| `resGroundTex` (No. 227) | **16.0 × 15.94** | on the same grid |
| FLOWERS, 6 m — the clamp case | **7.93 × 8.02** | clamp gone |
| bodega canted bay, upper | 11.50 × 11.70 | **untouched** |
| bodega canted bay, shopfront | 24.0 × 12.38 | **untouched, 1.94 : 1 anisotropic** |
| east cross building | 7.33 × 7.65 | **untouched** |
| north cross building | 8.00 × 7.65 | across fixed, up still wrong |
| library + church ashlar | 8.00 × 11.75 | **new instance, 1.47 : 1 anisotropic** |
| alley flanks + end wall | 11.43 × 11.72 | **untouched** |

## Which instances actually closed

| finding | verdict | evidence |
|---|---|---|
| 3 — shop band vs wall courses | **CLOSED** | band and wall are now 16 and 8 px/m, an exact 2×, so a 0.5 m course is 8 px and 4 px and lands on the same world lines. `reverify-V3-shopband`, `reverify-V1-flowers` |
| 7 — courses break on floor-count change | **CLOSED** | HARDWARE (3 fl) ∣ A-1 TAX (5 fl): courses run straight through the party wall and the window rows that exist on both sit at the same heights. `reverify-V2-join-3v5` |
| 13 — narrow-shop clamp | **CLOSED** | CHOP SUEY ∣ FLOWERS ∣ BODEGA in one frame, identical brick across both joins. `reverify-V1-flowers` |
| 17 — window bands drift up the elevation | **CLOSED as a side effect** | A also found `facadeTex` painting 2.53 m storeys onto 2.4 m ones. Rows now land on real floors. |
| R3 — 1.0 m band step at No. 227 | **half closed** | the **brick** now crosses the join in phase — the 1.0 m offset is exactly two 0.5 m courses, so it lands in step. The **band line and the window rows still step**, because the building's storeys genuinely are 1.0 m lower. `reverify-V4-227-band` |
| 2 + 12 — the bodega canted bay | **OPEN, and now worse** | `bodegaBrick` and `bayFrontT` are hand-painted in `ct/street.ts` and were not part of the fix. The bay still runs 11.5 × 11.7 against neighbours that are now a clean 8 × 8 — so fixing the block has **increased** the contrast at the one corner the user actually complained about. `reverify-V5-bodega-arris` |
| 9 — east cross building | **OPEN** | still `facadeTex(..., 22)` painted onto a 24 m face → 7.33 across. Not a density bug; a wrong argument at the call site. `reverify-V8-east-cross` |
| 8 — north cross building | **half closed** | across is 8.00 now; up is 7.65, because `street.ts` builds both cross buildings 13.6 m tall while `wallHeight(4)` is 13.0. `tex-world.ts`'s own comment warns that these must stay in step. `reverify-V7-north-cross` |
| 19 — alley flanks vs street brick | **OPEN** | 11.43 × 11.72, painted in `ct/street.ts`. `reverify-V9-alley-arris` |
| 4, 6, 20, 21 — alley floor, road grain, centre lines, gutter noise | **OPEN as expected** | these are pattern #5 (ground surfaces), not #1 |
| 1 — untextured `endM` party walls | **OPEN** | not a density defect. Still visible above every height change, incl. framing the library. `reverify-V2-join-3v5`, `reverify-V6-lib-meridian` |

**New instance of the same pattern**, in a file that did not exist when pattern
#1 was written: `ct/civic.ts` paints the library and church ashlar at 8.00 ×
11.75 px/m — square-texel discipline not adopted, 1.47 : 1 anisotropic, and the
stone course grid is not commensurate with the brick it abuts at every
civic-to-shop party wall. `reverify-V6-lib-meridian`, `reverify-V6-church-garage`.

## Was the pattern mis-stated?

A says yes and I agree, but for a different reason than A gives.

A's point — that walls need "one density and a y-datum", not the full
world-space offset `tex-ground.ts` needs — is right, and the horizontal perp
phase that is left over is genuinely cosmetic.

The bigger miss is one neither of us caught at the time: **pattern #1 was
written as if `tex-world.ts` were the only place masonry is painted.** It is
not. Four other painters draw brick or stone — `bodegaBrick` and the alley
flanks in `ct/street.ts`, `bayFrontT` on the canted bay, and the ashlar in
`ct/civic.ts` — and none of them import `WALL_PPM`. So a fix that was complete
*within its file* closed 4 of 10 instances, and the ones it did not reach are
now the most conspicuous, because their neighbours got tidied and they did not.

Restated, and this is the version worth keeping:

> **Every surface that paints masonry must derive its canvas from the surface's
> real metres at the world's one density. The defect is not that a painter
> computes density badly; it is that any painter computes it at all.**

A single exported helper that takes `(widthM, heightM, baseY)` and returns a
canvas would have made all ten instances impossible, and would make the next one
impossible too. That is a desk-level change across `tex-world.ts`, `street.ts`
and `civic.ts` in one commit — the same shape as the signature change A
correctly declined to make alone.

## Coverage

Shot the ten instances above and measured all 103 exterior wall faces. I did
**not** re-verify findings 14, 15, 21–25 (interiors, gutter noise, awning, kerb
ramp) — unrelated files, unchanged. Interiors were measured by density only, not
walked. Daylight only.

---

# Round 4 — pattern #1 after the cross-file mandate: closed

Base `add-stick-and-city98` @ `1b990d7`. A's cross-file commit is `a848b9d`
(`notes/A-density-cross.md`). Measured with `scripts/density.mjs` over every
textured face in the world; confirmation shots `shots/rv2-*.png`.

## The five open instances, plus the civic one

| finding | before | **after** | verdict |
|---|---|---|---|
| 2 — bodega canted bay, upper | 11.50 × 11.70 | **8.13 × 8.02** | **CLOSED** |
| 12 — canted bay shopfront | 24.0 × 12.38 | **15.91 × 15.95** | **CLOSED** — now on the 2× band grid with its 20 neighbours |
| 9 — east cross building | 7.33 × 7.65 | **8.00 × 8.01** | **CLOSED** — real 24 m extent now passed |
| 19 — alley rear wall | 11.43 × 11.72 | **8.00 × 7.97** | **CLOSED** (flanks fall in an 8 × 8 group) |
| civic ashlar (library, church, tower) | 8.00 × 11.75, tower 10.81 | **8.00 × 8.03 / 8.06 / 8.04** | **CLOSED** |
| 1 — untextured `endM` party walls | flat `#53382e` | flat `#53382e`, 5 sites | **still open — correctly outside A's mandate.** Never a density defect; needs brick on the exposed flank, not a canvas size. |

## Every remaining non-conforming face in the world

Nothing masonry is left outside the grid. What is left is either ground —
pattern **#5**, a different root cause, still open — or not masonry at all:

| face | px/m | what |
|---|---|---|
| main road | 19.20 × 14.33 | finding 6, pattern #5 |
| side road | 18.58 × 12.80 | finding 6, pattern #5 |
| alley floor | 9.70 × 9.85 | finding 4, pattern #5 |
| corner asphalt wedge | 18.29 × 18.29 | ground, square |
| sidewalk | 32.0 × 32.0 | ground, square, correct |
| lamp pools / halos, tree sprites, sign faces | — | not masonry |

**Pattern #1 is closed.** Every masonry surface in the world now measures 8 × 8
or 16 × 16 within canvas rounding. That is the first pattern in this audit trail
to go all the way from instance to root cause to complete closure.

## Two things worth recording about *how* it closed

**A found instances I missed, and the reason is instructive.** My list came from
walking the world; A's came from grepping the painters. Three custom shop bands
— BURGER BARN, PAWN, A-1 TAX — were at 8 × 12.38 against 18 neighbours at
16 × 15.95, and I never logged them because I shot the joins either side of them
rather than the bands themselves. Independent confirmation that they are fixed:
**the 16 × 15.95 group has grown from 18 faces to 21.** A walk finds what is
conspicuous; a grep finds what is uniform. This pattern needed both.

**The pattern reasserted itself during the fix.** A rebased mid-task and found a
*new* non-conforming painter — `partyTex` in E's library courtyard, deriving its
own `Math.round(FLANK_H * 11.2)` — written after the pattern was documented. It
now measures 8 × 8. That is the strongest argument for the shape of the fix that
was adopted: a shared `masonry()` helper makes the next one impossible, whereas a
list of corrected instances would have been out of date the day it was written.

### Regression check at `83f7c67`

Six commits touched `tex-world.ts` / `street.ts` / `civic.ts` after Round 4's
measurement — including `0a648f7` "Move the three special shopfronts into
tex-world.ts", `938a3b8` the church front reset in metres, and `cff1464` DINER
and LAUNDRY swapping identities. Re-measured: **107 wall-sized exterior faces,
all still 8 × 8 or 16 × 16 within canvas rounding.** The four faces added since
Round 4 all fall into existing conforming groups.

Pattern #1 is holding under continued change, which is the property a shared
`masonry()` helper was supposed to buy and a corrected instance list would not
have. The only non-conforming faces are still the two roads (19.20 × 14.33,
18.58 × 12.80) and the alley floor (9.70 × 9.85) — **pattern #5, unassigned.**

### Regression check at `5803367e`

Ten further commits touched the three masonry files since the last check —
including `b5f8264a` (MERIDIAN and LAUNDRY merged into one 19.2 m bank),
`e71b1da4` ("Rebuild the pawnshop; retire the last legacy-texel painter"),
`499892c7` (the church inlaid with a churchyard) and `5cbb1620` (four shopfronts
given depth). Re-measured: **every masonry face is still 8 × 8 or 16 × 16.**

The merge is the useful case: a brand-new 19.2 m facade — wider than anything
that existed when `masonry()` was written — came out at **8.02 × 8.00**, and its
shop band at **15.99 × 15.95**. A new building at a new size lands on the grid
without anyone thinking about it. That is the property the helper was bought for.

**One new non-conforming face, and it is not masonry.** The GOLDEN ACES pylon
sign now measures **13.53 × 11.94** (face 6.8 × 6.2 m, canvas 92 × 74) where it
was 10.45 × 10.57. `d2e5d02d` resized the boards when it gave the signs
something to stand on, and the canvas did not follow — so texels that used to be
near-square are now 1.13 : 1. Signage never went through `masonry()` and arguably
should not, but it is the same failure in a subsystem the pattern does not
cover: **a canvas that does not move when its surface does.**

### Regression check at `a4c64a82`

Two commits touched the masonry files since the last check: `a4c64a82` (export
the shopfront depth vocabulary) and `03cdac1a` ("GOLDEN ACES and HOTEL ORPHEUS:
the only two light sources in the world").

**Pattern #1 passes. Every masonry face is still 8 × 8 or 16 × 16.** That is the
queue item's test and it is clean for the third consecutive check.

**But the non-masonry anisotropy noted last round has gone from one face to
seven**, all of them from the lighting-and-signage work:

| face | px/m | aspect | what |
|---|---|---|---|
| 0.50 × 6.90 m, canvas 22 × 118 | **44.0 × 17.1** | **2.57 : 1** | the HOTEL blade |
| 1.24 × 15.8 m, canvas 44 × 224 (×2) | **35.4 × 14.2** | **2.50 : 1** | tall frontage strips |
| 6.80 × 6.20 m, canvas 92 × 74 (×2) | 13.5 × 11.9 | 1.13 : 1 | GOLDEN ACES pylon |
| 8.50 × 4.0 m, canvas 32 × 32 | 3.76 × 8.00 | 2.13 : 1 | light pool |
| 12.5 × 6.8 m, canvas 32 × 32 | **2.56 × 4.71** | 1.84 : 1 | light pool |
| 9.50 × 4.6 m, canvas 32 × 32 | 3.37 × 6.96 | 2.06 : 1 | light pool |
| 12.5 × 6.6 m, canvas 32 × 32 | **2.56 × 4.85** | 1.89 : 1 | light pool |

Two different things here, and they deserve different answers:

- **The light pools** are soft radial gradients stretched over large ground
  areas at 2.6–9.4 px/m. Anisotropy in a gradient is plausibly deliberate — a
  pool cast along a wall *is* elliptical — so this is a question for whoever
  owns them, not a defect I can call.
- **The blade is a sign carrying the word HOTEL at 44 × 17.1 px/m.** Its glyphs
  are drawn 2.6× denser across than up, so they render condensed. Low severity —
  earlier shots read fine — but it is a legibility decision being made by an
  arithmetic accident, on a sign this audit has now been round three times.

The pattern remains: **a canvas whose size does not follow from the surface's
real metres.** Masonry is now immune to it by construction; signage and lighting
have inherited it wholesale, and there are seven faces where there was one.
Worth a decision before there are twenty — the fix has a known shape and the
helper already exists.

---

# Round 5 — finding 1 closed; pattern #1 holds at 2.5× the surface area

Base `add-stick-and-city98` @ `34a9563e`. Four commits touched the masonry files:
`4ce8355d` (buildings get real depth and roofs), `e466c43c` ("A return is made
of what the building is made of"), `de401556` and `cedf7680` (window-light hours).

## Finding 1 — CLOSED

The last open instance from the original seam sweep. `endM` was one flat brown,
`0x53382e`, on the side, end and return of every building on the block whatever
its front was made of — visible above every height change, and framing the
library on both shoulders.

`e466c43c` introduced `flankTex(brick, w, h, baseY, cope)`: a blind party wall
painted from the **same brick as the front**, at the same masonry density,
phased off the same world-Y datum. Measured:

- **Flat-colour `endM` sites in `ct/street.ts`: 5 → 1.**
- Flank and return faces now measure **7.94–8.02 × 8.00–8.10 px/m** — on the
  world grid with everything else.
- `shots/fl-F2-east-join2.png`: the exposed flank beside the used car lot is
  brick, coursed and coped, where it was a brown slab.

The reasoning in the commit is worth preserving because it is the right
distinction and this audit did not make it: *a blind party wall IS correct — a
flank does not want the front's windows, glazing or sign. What it must not be is
a different **material**.* I logged this as "untextured" for eleven rounds; the
defect was never the absence of windows, it was the absence of brick.

**Every instance in the original seam audit's pattern #1 list is now closed.**

## Pattern #1 holds at 275 faces

`4ce8355d` gave every building real depth, which took the world from **107
wall-sized exterior faces to 275** — the flanks, returns and roof edges that
were previously flat colour are now painted surfaces. All of them are on the
grid:

| group | faces |
|---|---|
| ≈ 8 × 8 (1×) | 43, 36, 30, 13, 8, 6, 6, 5, 4, 4, 4, 4, 2 … |
| ≈ 16 × 16 (2×, shop bands) | 17 |

Nothing masonry sits outside 8 × 8 or 16 × 16 within canvas rounding. **A 2.5×
increase in painted wall area produced zero new instances.** That is the
strongest evidence the helper has given: the pattern did not merely get fixed,
it stopped being reachable.

## Still outside the grid — unchanged, and not masonry

Roads (19.20 × 14.33, 18.58 × 12.80) and the alley floor (9.70 × 9.85) —
**pattern #5**, still unassigned. Plus the lighting-and-signage set, which has
grown again: **six light pools now** at 2.56–9.41 px/m and 1.2–2.1 : 1
anisotropic, and the three sign faces. The newest pool is 32 × 32 px over
9.5 × 11.5 m at (10.2, 0.2, −4.4) — **3.37 × 2.78 px/m**, the coarsest surface
in the world by a wide margin.

### Regression check at `7148e296`

`5403232a` — "The shopfront painters read the band table instead of restating
it" — is the kind of refactor that could quietly move the 2× band grid, since it
changes where the band heights come from. Re-measured: **277 wall-sized faces
(275 + 2 from the gap work), every group identical to the previous check.** The
band group still holds 17 faces at 16 × 15.95; every masonry face is still 8 × 8
or 16 × 16.

Behaviour-neutral, which is what a refactor of a shared painter should be, and
worth having measured rather than assumed given it touches the one table three
painters now depend on.

---

# The 12 mirrored faces: my attribution was inferred by eye. Here is what it is worth.

Builder A has just corrected a misattribution of their own (`ea9ecbd7`): a
cluster their tool printed at x 34–50, z −101…−94 was called "the car lot"
because the numbers *looked* like it, and it is actually `ct/vice.ts`. Their
conclusion is the right one and it lands on me:

> **No name is better than a name inferred by eye.**

That is a different cluster from mine — A's is at x 34–50, mine is 12 mirrored
faces at **x = 7.18**, z +13.23 → −8.03 — so A's correction does not overturn my
finding. But my routing note said *"they belong to `ct/lot.ts` **by position**"*,
and position-implies-owner is precisely the move A just retracted. So: what is
that claim actually worth?

**Three independent facts agree, none of them a registry lookup:**

1. the faces span **z +13.23 → −8.03**, which is 21.3 m of the car lot's 23.2 m
   frontage (`placeLot(ze, 23.2)`, `ct/street.ts:853`)
2. `doorsweep.mjs` walked the whole east walk and found **no shop door anywhere
   between z +13 and z −8** — the other east doors are at z −21, −36, −45,
   −61.5, −96. That stretch has no shopfront *because the lot is there*
3. the 64 × 20 canvas matches `pennantT` at `ct/lot.ts:227`; the only other
   64 × 20 in the world is a horizontal awning underside at `ct/vice.ts:733`

**What would settle it, and it is one line.** A's note says `ct/lot.ts` already
computes `LOT.bounds` at `lot.ts:397` from its site, and that pushing it to
`globalThis.__bounds` would let any probe *ask* who owns a coordinate instead of
guessing. If that lands, this attribution stops being an inference and becomes a
lookup — and so does every future one.

Until then the desk should read my line as **"almost certainly the lot, on three
agreeing circumstantial facts, not verified"** — and if the lot's owner looks and
says it is not theirs, they are right and I am wrong, exactly as A was.

I am also flagging the one way all three facts could agree and still mislead:
if a shared sign factory draws the lot's banners on the lot's behalf, the
geometry sits in the lot's frontage while the code lives elsewhere — which is
the *precise* shape of A's vice.ts case. Position cannot distinguish those two,
and neither can I from outside.

---

# Round 6 — pattern #1 CANNOT be re-verified by this instrument any more.

Re-ran `scripts/density.mjs` at `ea9ecbd7`. The headline number looks like a
severe regression and **I do not believe it**:

```
1959 textured faces · 367 wall-sized exterior faces
on the world grid (8 or 16 px/m, both axes):  241  (65.7%)
OFF the grid:                                 126
```

Against my last round — **277 faces, all masonry ones on the grid** — that reads
as 126 new violations. It is not. **The tool's net stopped being a masonry net.**

Its filter is geometric, not material (`density.mjs:65`):

```js
r.filter(x => x.face[1] > 3 && x.c[0] < 100 && x.img[0] > 20)
```

— *any* face over 3 m tall, outside the interior belt, with a canvas wider than
20 px. That was a fair proxy for "wall" when the only things that size were
walls. The park's far half has since been furnished, and it is full of objects
that are wall-sized and are not masonry.

## What the 126 actually are

| off-grid group | reading | masonry? |
|---|---|---|
| **~57 faces**, 3 at a time, canvas **24 × 24**, 4–6 m, y 4.8–6.6, all at x −10…−37, z −71…−96 | consistent with the **park's tree crowns** | no |
| 10 faces, 10.91 px/m, canvas 48 × 48 on 4.4 × 4.4 m at (−9.5, 0.2, −93) etc. | the **lantern ground pools** — I measured these exact coordinates as glow decals last round | no |
| 6 faces, 32 px/m, 1.94 × 126.5 m at (−6, 0.1, −46.8) | the **sidewalk sheet** | no |
| 2 + 2 faces, 35.4 / 36.4 px/m on 1.24 × 15.8 m at (46, 13.5, −96.7) | **blade signs** | no |

**I am labelling those by inference, not by lookup** — the same move A just
retracted in `ea9ecbd7`, and I am flagging it rather than repeating it silently.
The coordinates, counts and canvas sizes are measured; the words "tree" and
"lantern" are mine.

## The candidates that could genuinely be masonry

Small, and worth someone's eyes rather than a mandate:

| where | face | canvas | px/m |
|---|---|---|---|
| (−6.9, 2.8, −9) — upright, 8 faces | 3.4 × 5 m | 32 × 48 | **9.41 × 9.60** |
| (5.7, 2.4, −1.5) — upright, 11 faces | 3 × 4.5 m | 60 × 90 | **20 × 20** |
| (51.0, 22.7, −94.3) — 2 faces, high | 6.8 × 6.2 m | 92 × 74 | **13.53 × 11.94** |

## What I am NOT claiming

**I am not calling this a pattern #1 regression, and nobody should be routed on
these numbers.** Pattern #1 is a rule about masonry, and I no longer have an
instrument that isolates masonry. Reporting 65.7% as a conformance rate would be
a confident wrong verdict of exactly the kind this audit exists to prevent —
it would send a builder to "fix" the density of tree foliage.

**What would fix the instrument.** The same one-line change A proposes: modules
publishing their bounds (or their material provenance) to a registry, so a face
can be *asked* what it is instead of inferred from its size. Until then, the
honest scope of `density.mjs` is **"faces over 3 m that carry a texture"**, and
its header calling itself a check of *"one masonry density"* now overstates it.

Pattern #1's actual status is therefore **unverified this round**, not failed —
and it was last genuinely verified at 277 faces.

---

# Round 7 — the 12 mirrored faces are **`ct/lot.ts`. Asked, not inferred.**

C's `userData.mod` stamp (`cf966b3d`) turns my open attribution into a lookup.
Run against a **fresh build**, because A's note records their first probe
returning zero stamps against a stale `dist`:

```
720 of 3369 meshes carry userData.mod
   373  lot
   347  walkup
```

Walking up from each mirrored face for an inherited mark:

| face | canvas | at | **owner** |
|---|---|---|---|
| 1.07 × 2.08 | 64 × 20 | (7.18, 3.01, **+13.23**) | **lot** |
| 0.77 × 1.98 | 64 × 20 | (7.18, 2.70, +11.30) | **lot** |
| … ten more, alternating the two sizes … | | | **lot** |
| 1.07 × 2.08 | 64 × 20 | (7.18, 3.01, **−8.03**) | **lot** |

**All 12. No exceptions, nothing unattributed.**

They are evenly spaced **1.93 m apart** along the lot's fence line from z +13.23
to −8.03, alternating between two sizes — a **pennant string**, which is what
the 64 × 20 `pennantT` canvas said it was.

## What this settles, and what it says about the method

My Round 6 note said the desk should read my attribution as *"almost certainly
the lot, on three agreeing circumstantial facts, not verified"*, and named the
one failure mode that would defeat all three — a shared sign factory drawing the
lot's banners on its behalf, geometry here and code elsewhere. **That failure
mode did not occur**, and I could not have known that from outside. The stamp
could have come back `vice` and I would have been wrong in exactly the way A was.

So the finding is unchanged and now **routable**: `ct/lot.ts`, 12 pennants, every
one of them mirrored — `side: DoubleSide` with the texture's u axis running left
for a viewer, so the string reads reversed from one side of the fence.

Three notes worth keeping:

- **The inference was right and that is not the point.** Being right by
  inference and right by lookup are the same answer with different warranties.
  A's misattribution and mine were the same move; his happened to be wrong.
- **347 meshes stamp `walkup`** as well as the lot's 373. The pattern is
  spreading on its own, which is the best sign it is the right one.
- `ct/vice.ts` still has not stamped, so A's thirteen remain `(unattributed)`.
  That is the next place the stamp pays for itself.

## Round 7b — the three off-grid candidates, looked at

All three still read `(unattributed)` — only `lot` and `walkup` have stamped —
so these are eyes, not lookups, and I say which is which.

**c1 — (−6.9, 2.8, −9), 3.4 × 5 m, canvas 32 × 48, `9.41 × 9.60 px/m`, 8 faces.
The PUBLIC LIBRARY.** Pale ashlar, pilasters, `PVBLIC LIBRARY` cut into the
entablature, recessed entrance, steps. This is **masonry, and it is off the
grid** — the one genuine pattern #1 candidate of the three, and it is very
likely the civic-ashlar instance already on the open list.

**c2 — (5.7, 2.4, −1.5), 3 × 4.5 m, canvas 60 × 90, `20 px/m`, 11 faces. Not
masonry.** The frame is the car lot frontage: the yellow **"…DOWN WE FINANCE"**
banner, a `TODAY ONLY` A-board, a cone, chain-link, and the pennant strings.
Signage carries its own density by right; 20 px/m here is not a defect.

*(Incidentally, the pennants read **correctly** from this side — which is what
"mirrored" should look like: right from the street, reversed from the other
face. It is the same string I attributed to `lot` in Round 7.)*

**c3 — (51.0, 22.7, −94.3), 6.8 × 6.2 m, canvas 92 × 74, `13.5 px/m`. MISS, and
my fault.** The subject is **22.7 m up** and my camera ring starts at 4 m, so
the shot is pitched ~80° and the frame is an unreadable tilted slab. **The
candidate distance has to scale with the subject's height** and mine does not.
Not graded; the instrument needs fixing before this one can be answered.

### Where that leaves pattern #1

The 126 "off-grid" faces reduce, on inspection, to **one real masonry candidate:
8 faces of civic ashlar at 9.41 px/m**. Everything else looked at so far is
foliage, ground decal, sidewalk sheet or signage — none of which the rule
governs — and one face I could not see properly.

That is a far smaller and more routable statement than the raw number, and it is
why I refused to publish 65.7% as a conformance rate last round.

## Round 7c — I fixed my camera, and it answered a question that had beaten me six times

**The fix.** My candidate ring started at 4 m regardless of how far up the
subject was, so a face 22.7 m in the air was shot from underneath at ~80° pitch.
Distance now scales with the rise:

```js
const rise = Math.max(0, Y - eyeY);
const minD = Math.max(4, rise / Math.tan(35°));   // keep the pitch under 35°
```

Both remaining candidates then resolved on the first try.

**c3 — (51.0, 22.7, −94.3), 13.5 px/m.** Shot from 29.9 m at 35° and legible: a
**rooftop bulkhead** — a plain slab-sided box above the parapet with a thin mast
on top, flanked by brick parapets with stone copings. The flanking parapets show
coursing clearly; **the box does not**. It reads as a painted rooftop structure
rather than coursed masonry, so I do not think the rule governs it.

*Caveat, stated because it matters:* at 30 m fine coursing would not resolve
anyway. What I can say is that it does not read as brick where the parapet
beside it plainly does — a comparison inside one frame, which is worth more than
either judged alone.

**c4 — (46.2, 13.5, −96.7), 35.4 px/m.** The **GOLDEN ACES and HOTEL ORPHEUS
blade signs**, both legible, plus the 777 marquee and the ORPHEUS canopy.
Signage. Not masonry, and 35 px/m on a 1.24 m-wide blade is how you get readable
letters.

### The dividend

That frame is the shot **four earlier cameras failed to get** — every street-level
attempt within ~8 m of the blades ends up under the GOLDEN ACES marquee canopy,
which is why I gave up on cameras and answered the handedness question off the
scene graph instead. The height-scaled ring solves it by standing back 17 m: at
that distance the canopy no longer occludes and **both blades read in one
frame**.

I am not re-opening the blade question on it — Round 2 answered that
structurally, and one direction is not both. But the lesson is worth keeping and
it inverts the one I wrote earlier:

> *"When a check fails twice the same way, change the instrument."* — still
> right. But **twice I changed instrument when the camera merely needed to step
> back.** Abandoning the camera cost me nothing that time because the scene-graph
> answer was better. Here it would have cost me the answer entirely.

### Pattern #1's open set is unchanged

Still **one candidate: 8 faces of civic ashlar at 9.41 px/m** on the library.
Everything else off the grid that I have now looked at is foliage, ground decal,
sidewalk, signage, or a rooftop structure that does not read as masonry.

## Round 8 — the 12 mirrored faces are real, routed, and **invisible**. Close them.

Still 12 at `2c061b97`, unchanged, all `lot`. Before this goes to a builder as
work, the question I should have asked three rounds ago: **can a player see it?**

`ct/lot.ts:263` draws each pennant:

```js
const inset = Math.floor((18 - row) * 0.42);
const w = 14 - inset * 2;
g.fillRect(x0 + 1 + inset, row, w, 1);
```

The inset is applied to **both** sides and the width shrinks by twice it. Every
pennant is a **left-right symmetric triangle**. The four across the canvas run
red, white, red, white — mirroring that sequence gives white, red, white, red,
which on a repeating band is a half-cell phase shift, not a difference. The only
asymmetric ink on the texture is `dither(g, 64, 20, 40)`, which is noise.

**So the mirroring is undetectable.** `u · right < 0` is true, the faces really
are flipped, and nothing about the rendered world differs because of it.

### What I am recommending

**Close it. Do not route it to C.** There is no player-visible defect here and a
builder sent to fix it would spend their time confirming that.

### Why I am not withdrawing the finding

Two reasons it was still worth having:

1. **It is latent, not absent.** These 12 faces are the only mirrored uprights
   in the world. The day anything with lettering, a logo or a left-facing arrow
   is drawn through the same path, it reads reversed — and it will be reported
   as a new mystery rather than as this. Recording it as *known and harmless
   here* is what makes that cheap next time.
2. **The instrument is proven.** `handed.mjs` checked 207 upright mapped faces
   and returned exactly the 12 that are genuinely flipped, with no false
   positives — verified now against the source, not just against itself.

### The lesson, which is about me

I carried this finding for eight rounds. I measured it, defended it, got its
attribution wrong, corrected that by eye, then corrected *that* by lookup — and
**never once asked whether the thing it described was visible.** All of that
work was on provenance, and the cheapest question was the one about consequence.

> **Establishing that a defect is real is not the same as establishing that it
> matters.** I did the first four times and the second never.

Pattern #1 got this right — it was reported with what a player sees. This one
did not, and it is the only finding in the audit I would now file differently.

## Round 9 — seam sweep of ground that had never had one

The original brief was *"walk the whole world, shoot every junction from at
least two angles including a grazing one."* Two areas have appeared since and
neither had ever been swept: the **side street** (lit only at `4f6f7d58`) and
the **park's far half** (unreachable until the clamp lifted — every earlier
sweep of mine stopped seven metres in).

`scripts/seamnew.mjs` finds building corners in that ground from the scene,
then stands **7 m off to one side** so the face runs away from the eye — a
grazing angle, not square on — with standability, line of sight and landing all
verified. **26 distinct corners found, 8 shot, 3 read.**

### Result: no seam defects in the three I read

- **park far corner (−39, −98)** — two ivy-clad brick faces meeting, coursing
  continuous on both, a tree trunk standing in the junction
- **park wall run (−24.8, −68)** — coursing runs unbroken along the wall at a
  grazing angle, which is where a repeat error would show first. Ivy, bench,
  path, railings, lamp beyond
- **side street (16.45, −96)** — FLOWERS fascia running away, RADIO / DELI /
  RECORDS opposite, pier, glazing, tree, lamp, parked car. No discontinuity at
  the corner

**Five of the eight are unread**, and I am not claiming them. Three grazing
angles finding nothing is coverage extended and a clean result, not a
certificate.

### Two things the frames showed that I was not looking for

1. **`[E] sit on the bench` fires in the park's far half.** The seats out there
   are wired, not just modelled — which is the *"can you sit on every bench"*
   request, confirmed in the one part of the park nobody could reach until
   recently.
2. **It was raining, and the road was wet.** Rain streaks and a dark wet
   carriageway in the side-street frame — a third independent confirmation of
   the wetness system, from a frame taken for an unrelated reason.

### An observation about the planting

Both park corners have **a tree trunk standing in the junction** and ivy over
the brick. Whether or not that is deliberate, it is the reason there is nothing
to report: the corner where two walls meet is the hardest thing in this world to
get right, and in both cases it is not visible. Masking a seam is a legitimate
way of solving it, and cheaper than making two textures agree.

---

# Round 10 — PATTERN #1 IS NOT CLOSED. 42 of 109 masonry faces, horizontal axis only.

`ddd36f8a` stamps every masonry texture with what it is and at what density, and
its note says pattern #1 is **clean by declaration**. That is literally true, and
I can confirm it:

```
3375 meshes · 978 textured · 109 carry a masonry stamp

DECLARED densities:    85 × 8 (mult 1)     23 × 16 (mult 2)     1 × 32 (mult 4)
declared off the 8/16 grid: 1
```

**The declaration is clean. The mapping is not.**

## 42 of 109 stamps disagree with the face they are on

```
stamps checkable against geometry: 109
stamps that DISAGREE with their face by >0.6 px/m: 42
```

And the disagreement has one shape. **All 42 have the vertical axis correct and
only the horizontal wrong** — the stamp records what the canvas was *painted
for*, and the face it is applied to is a different width:

| painted for | applied to a face | declared | **measured** |
|---|---|---|---|
| 19.2 × 13 m | 15.9 × 13 m | 8 | **9.69** × 8 |
| 16 × 13 m | 21.6 × 13 m | 8 | **5.93** × 8 |
| 12 × 13 m | 23.5 × 13 m | 8 | **4.09** × 8 |
| 12.5 × 13 m | 17.8 × 13 m | 8 | **5.62** × 8 |
| 12 × 4.2 m | 23.5 × 4.2 m | 16 | **8.17** × 15.95 |

Heights always match — 13 to 13, 4.2 to 4.2 — which is why the vertical density
is right every time. Widths never do.

**Horizontal density runs 0.43× to 5.83× of declared.** Brick coursing is
stretched to well over double width on some elevations and compressed on others.

## Is it visible? Yes, and that is the point

Per my own triage rule I have to answer this rather than assume it. Two
elevations on the same street: one at **4.09 px/m** and one at **9.69 px/m** —
**a 2.4× difference in brick width between neighbouring buildings**, with the
courses the correct height on both. Bricks that are the right height and twice
the width do not read as a different building; they read as *wrong*.

This is the original complaint, unchanged, and it has been hiding behind an axis.

## Why nothing caught it until now

Three things had to line up:

1. **`density.mjs` could not isolate masonry** — its filter was geometric, so
   109 real masonry faces sat in a net of 367 that also held foliage, ground
   decals, sidewalk sheets and signage. I reported that as an instrument failure
   in Round 6 and declined to publish a conformance rate. That was right.
2. **The declaration alone looks clean**, because the painter *is* computing 8
   px/m correctly — for the width it was told about.
3. **`map.repeat` is 1 × 1 on all 42**, so tiling is not compensating. I checked
   this before writing any of the above, because I made exactly the
   ignore-the-repeat error on floor density earlier in this audit and did not
   intend to make it twice.

## The restatement

My Round-3 pattern said the defect is not that a painter computes density badly,
it is that *any* painter computes it at all. The stamp fixes the computing. This
is the other half:

> **A density is a property of the pairing, not of the texture.** `masonry()`
> knows what it painted and at what scale; it does not know what it will be
> mapped onto. Until the face's real width is what the canvas is sized from —
> or until the stamp is checked against the face at build time — a correct
> declaration and a wrong wall can coexist, and they currently do on 39% of the
> masonry in this world.

The stamp makes this **checkable**, which is a large step forward and is why
this finding exists at all. `scripts/masonry.mjs` is that check and it takes
about twenty seconds.

## Round 10b — and here is what it looks like

I asserted the 2.4× brick-width spread was visible. My own triage rule says
prove that rather than assume it, so I shot it: the **4.09 px/m** elevation at
(−18.8, 10.7, −49.5), from 12.8 m at 35° with the height-scaled camera.

`shots/cand-brick-409.png` does not merely show it. It shows **two elevations
meeting at a vertical corner with different brick widths on either side** —

- **left face:** long, wide, flat bricks
- **right face:** visibly narrower bricks
- **course heights on both: the same**

The mismatch is not a subtle thing you find by comparing two buildings at
opposite ends of the street. **It is legible in one frame, at one corner, in a
single glance** — the two walls meet and the bond does not carry across.

That is a seam in the original sense of my brief: *a junction where two textures
do not line up*. It has been in the world the whole time, and every sweep I ran
missed it because I was measuring faces one at a time against a grid instead of
against **each other**.

### What this changes about the finding's priority

In `AUDIT-TRIAGE.md` I ranked everything by whether a player can see it. This
goes to the top of the route list, above all four current entries:

| | |
|---|---|
| **visible?** | Yes — at a corner, in one glance, without looking for it |
| **how many** | 42 of 109 masonry faces, 39% |
| **how wrong** | horizontal density 0.43× to 5.83× of declared |
| **checkable?** | Yes, `scripts/masonry.mjs`, ~20 seconds |
| **owner** | `masonry()` in `tex-world.ts` and its callers |

### The measurement I should have made months of rounds ago

Every density pass I ran asked *"is this face on the grid?"*. Not one asked
*"does this face agree with the face it touches?"* — which is the actual
complaint, and the only question a **seam** audit was ever about. The grid was a
proxy for agreement, and a proxy is what let a 2.4× mismatch sit inside a
world where every face is individually declared correct.

---

# Round 11 — the right question, asked at last: **135 of 239 touching pairs disagree**

`scripts/seampairs.mjs` compares each masonry face against the faces it
**touches**, instead of against the grid. That is the question the brief was
always about — *a junction where two textures do not line up* — and it is the
one question no tool in this project has ever asked, mine included.

```
109 masonry faces · 293 touching pairs
   239 pairs declare the SAME density   ← like-for-like, no design intent to explain a gap
    54 pairs declare different          ← wall against shopfront band: deliberate, excluded

LIKE-FOR-LIKE PAIRS DISAGREEING BY MORE THAN 15%:   135 of 239   (56%)
of those, pairs where BOTH faces pass the 8/16 grid check:   ALL of them
```

**Horizontal density across masonry faces runs 3.43 to 46.67 px/m** — a **13.6×
range** in a world whose rule is one density.

Worst offenders, both faces declared 8 px/m:

| ratio | measured | where |
|---|---|---|
| **11.41×** | 4.09 vs **46.67** | (−18.8, 10.7, −49.5) / (−13.9, 8.6, −40.3) |
| 7.87× | 5.93 vs 46.67 | (−17.8, 10.7, −29) / (−13.9, 8.6, −40.3) |
| 5.83× | 46.67 vs 8 | (−13.9, 8.6, −40.3) / (−10.5, 8.6, −37) |
| 4.02× | 7.97 vs 32 | (51.2, 10.8, −96) / (60, 6.8, −103) |
| 3.29× | 26.12 vs 7.93 | (13.4, 9.5, −86.2) / (13.4, 9.5, −96) |

## Why every previous tool was blind to this, including mine

**Both faces of all 135 disagreeing pairs pass the 8/16 grid check.** Not some —
all. The grid test asks each face a question it can answer correctly while the
pair is wrong, so no amount of running it harder would ever have found these.

I ran that test in Rounds 3, 4, 5, 6 and 7 and reported pattern #1 as closed on
the strength of it. It was the wrong test, run carefully.

## Two distinct causes, and they need different fixes

1. **Canvas painted for one width, mapped to another** (Round 10) — 42 faces
   where the stamp's `wMeters` and the face's real width differ. Heights always
   match; only the horizontal is wrong.
2. **Faces that touch and were never compared** — the 46.67 px/m face at
   (−13.9, 8.6, −40.3) is 5.8× its own declaration and sits against three
   neighbours at 4.09, 5.93 and 8. Nothing in the pipeline looks at a junction.

The stamp (`ddd36f8a`) is what made both findable. It is the right foundation
and this is what it exposes.

## The restatement, final form

> **Pattern #1 was never about density. It was about agreement.** "One density"
> is a way of getting agreement for free — if every face is 8, every junction
> matches. But the rule was enforced per face and the goal was per junction, and
> those come apart the moment a canvas is sized from anything other than the
> face it lands on. 39% of faces break their own declaration; **56% of
> like-for-like junctions do not match.**

`scripts/seampairs.mjs` is the check, it runs in about twenty seconds, and it is
the one I would put in the build if only one could go there.

---

# ⚠ RETRACTION — Rounds 10, 10b and 11 are WRONG. Pattern #1 is clean.

**I published a headline finding two commits ago and it is an error in my own
instrument.** Retracting it in full, with the measurement that kills it.

## What I claimed

- Round 10: *"42 of 109 masonry faces disagree with their own stamp"*
- Round 10b: *"the mismatch is legible at one corner, in one glance"*
- Round 11: *"135 of 239 like-for-like touching pairs disagree by more than 15%"*
- and I promoted it to the **top** of `AUDIT-TRIAGE.md`'s route list

## Why it is wrong

**A `BoxGeometry` has four side faces. Two are `parameters.width` across and two
are `parameters.depth`.** I used `width` for all of them.

All 42 "disagreements" were boxes. Checking each against both dimensions:

```
42 stamped BoxGeometry faces
   density correct against the box's DEPTH:  42
   density correct against the box's WIDTH:   0
   correct against NEITHER dimension:         0

   painted for 19.2 m · box 15.9 × 19.2 · declared  8 · vs W  9.69 · vs D  8.02
   painted for   12 m · box 23.5 ×   12 · declared  8 · vs W  4.09 · vs D  8.00
   painted for    7 m · box  1.2 ×    7 · declared  8 · vs W 46.67 · vs D  8.00
```

**Every box's depth is exactly its painted-for width.** The masonry is on the
depth-facing pair, at exactly 8 or 16 px/m. The famous "46.67 px/m face" is a
7 m-wide face I measured against a 1.2 m edge.

## The corrected result

```
109 masonry faces · 293 touching pairs
faces whose density matches NEITHER of their dimensions:   0
pairs disagreeing by more than 15%:                       54 of 293
```

And all 54 are a **declared-16 face against a declared-8 face at exactly 2×** —
the shopfront band against the wall above it, which I had already identified as
deliberate and excluded from the like-for-like set in Round 11.

> **Like-for-like disagreements: zero. Every pair of masonry faces declaring the
> same density agrees with its neighbour. Pattern #1 is clean — by declaration
> and by measurement.**

## Round 10b's photograph, retracted too

I read `cand-brick-409.png` as two walls meeting with different brick widths. It
is a near wall about 3 m from the camera and a far wall about 12 m away. **That
is perspective.** I had rejected exactly this explanation for the library
candidate a few rounds earlier and then accepted the same appearance as evidence
when it agreed with a number I already believed.

## What actually happened, and it is not subtle

I have caught this same class of error three times in this audit — the
`map.repeat` omission on floor density, the citizens that matched my door
filter, the camera that did not scale with height. Each time I wrote that the
lesson was to check the instrument against a second source.

**Here I had the second source and ignored it.** The stamp records `wMeters`.
For all 42, `canvas ÷ wMeters` came out to exactly 8.00 or 16.00 — I printed
that column, looked at it, and read it as "the texture is painted correctly for
a width it is not applied to" instead of the far simpler "`wMeters` is the face
width and my face width is wrong."

A number that lands on **exactly 8.00** forty-two times is not a coincidence,
and I treated it as one because it fitted a defect I wanted to have found.

## Status

- **Pattern #1: CLEAN.** No further verification needed on current evidence.
- `scripts/masonry.mjs` and `scripts/seampairs.mjs` are both fixed and now handle
  box faces. `seampairs.mjs` is still worth having — *"does this face agree with
  the one it touches"* remains the right question, and it now answers **yes**.
- `AUDIT-TRIAGE.md` entry #0 removed.

## Postscript to the retraction — I was second, and my own fix was circular

Two things I did not know when I wrote the retraction.

**1. Mainline caught it before I did.** `7fe644b9` — *"The 42 are a box face
index, not a density fault"* — and `fe310665`, `793721de` land the same
diagnosis independently, ahead of my retraction. My bad finding was live for
three commits and the system corrected it without needing me to. That is the
multi-agent setup working exactly as intended, and it is a better outcome than
my having been careful enough not to publish it.

**2. My repair was circular; theirs is sound.** My corrected `seampairs.mjs`
picked whichever box dimension *matched the declared density*:

```js
for (const w of cand) if (Math.abs(img.width/w - ms.ppm) < 0.6) { fw = w; break; }
```

That assumes the declaration is right in order to decide which face it is on —
so it can **never report a mismatch**. It would return "like-for-like is zero"
on a world where every wall was wrong. Mainline indexes the actual face from the
material index instead:

```js
if (mi===0||mi===1)      { fw=(pr.depth??0)*S[2];  ... }   // ±x faces
else if (mi===4||mi===5) { fw=(pr.width??0)*S[0];  ... }   // ±z faces
```

That measures the face the texture is genuinely on and can still disagree with
the stamp. **I took their version; mine is deleted.**

So the sequence was: I built a wrong instrument, drew a false conclusion from
it, and then built a fix that could only ever confirm the answer I had just been
handed. The correct check came from the module that knows its own geometry — the
same conclusion as `userData.mod` and the masonry stamp, for the third time.

> **An auditor outside the code can measure what a thing looks like. It cannot
> reliably infer what a thing *is*.** Every instrument I own that tried to has
> eventually been wrong: the geometric masonry filter, the door-leaf shape
> filter that found citizens, the float detector that found lamp bulbs, and now
> the box face. Every one was fixed by the world declaring something instead.

## Round 9b — the five unread frames, read. Sweep complete.

I left five of eight shot and unread and said so. My own §20 says that is not an
observation, so here they are. **All eight now read.**

| frame | what it shows | verdict |
|---|---|---|
| seam-0 | park wall run, grazing — coursing unbroken, ivy, bench | clean |
| seam-1 | **MISS** — aimed high, over half the frame is sky | see below |
| seam-2 | park far corner, two ivy-clad faces meeting | clean |
| seam-3 | **BODEGA** frontage running away, crates, tree in a proper pit | clean |
| seam-4 | **FLOWERS** frontage, RADIO / DELI / RECORDS opposite | clean |
| seam-5 | **CHOP SUEY** frontage at an extreme grazing angle | clean — see note |
| seam-6 | **HOTEL ORPHEUS**, `[E] into the HOTEL ORPHEUS` firing | clean |
| seam-7 | side street south, VACANCY neon, canopy, red entrance mat | clean |

**Seven clean, one miss. No seam defects in the new ground.**

`seam-5` is the strongest negative result of the set: at that grazing angle the
fascia band, the sub-fascia and the glazing head run **dead straight and
continuous** from the near end of the block to the far end, across several
different frontages. A step in band heights between neighbours would be glaring
from there and there is none.

### One observation from the missed frame, flagged not filed

`seam-1` is badly aimed, but what is in it is worth an eye: from low inside the
park, the **tree canopies show straight horizontal lower edges and straight
vertical edges against the sky** — three adjacent crowns each terminating on a
hard rectangular boundary rather than tapering into foliage.

That may be the billboard quad showing where the alpha does not taper, or it may
be an artefact of this one bad angle. Recent commits deliberately reworked crowns
(*"one ragged mass, not a bunch of balls"*, *"distinct clumps, lit tops, sky
holes"*), so the owner will know immediately which it is.

**I am flagging it, not filing it.** I have over-read an image twice this session
— the brick corner that was perspective, and the casino fittings that were
deliberate hangs — and this is a single badly-aimed frame. It wants five seconds
from the person who drew the tree, not a ticket.

### The sweep, closed

New ground swept, 26 corners found, 8 shot at grazing angles, **8 read**,
nothing to route. The last loose end I was carrying is closed.
