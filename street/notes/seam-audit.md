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
