# Interior audit — ten rooms, four builders, one kit

**Branch** `audit/seams`, based on `add-stick-and-city98` @ `ea641af` · read-only ·
nothing under `street/src/` touched. Port 4184.

**One of the ten rooms exists.** `ct/int-diner.ts` is the only kit room in the
tree; `int-burger`, `int-thrift`, `int-casino`, `int-hotel`, `int-pawn` and
`int-tax` are named in `OWNERSHIP.md` but not written yet. So "judge them as a
set" is currently a set of three: the diner (on the kit) and the apartment and
bodega (both predate it).

That changes where the leverage is, and it is worth saying plainly: **with nine
rooms still to be written, the defects worth finding are the ones the kit does
not prevent, because each of those will land nine more times.** This report is
therefore mostly an audit of the kit's contract, measured through the one room
that exercises it.

Instrument: `scripts/interiors.mjs` measures every interior region (ceiling,
clear size, wall thickness, floor/wall texel density, palette luminance, lamp
count, group discipline) and walks the entry and exit of each.
`scripts/interiors2-3.mjs` are the follow-up probes. Raw numbers in
`shots/interior-report.json`.

## The set, measured

| axis | apartment (pre-kit) | bodega (pre-kit) | **diner (kit)** |
|---|---|---|---|
| clear size | 2.4 × 8.4 (hall) | 8.0 × 8.0 | 8.6 × 7.0 |
| ceiling height | 2.55 per storey | 2.70 | 3.00 |
| wall thickness | 0.028 … 0.295, eight values | **0 — single planes** | **0.18 uniform** |
| floor px/m | **35.6** | **24.0** | **18.6 × 18.3** |
| wall px/m | 23.7 × 23.7 | **11.9 × 20 (non-square)** | 11.9 × 12.0 (square) |
| ceiling | textured | flat colour | flat colour |
| wall luminance | 0.51 | 1.00 | 1.00 |
| glow planes | 17 | 2 | 2 |

## Findings

| # | sev | instance | file | what's wrong | evidence |
|---|-----|----------|------|--------------|----------|
| 1 | **high** | floor and walls disagree inside **every** kit room | `ct/interior.ts` | The kit derives its two big surfaces from two unrelated constants: the floor from 32 px per **1.6 m** (≈20 px/m nominal), the walls from 32 px per `TILE_M` **2.7 m** (11.85 px/m). Measured in the diner: floor **18.6 × 18.3**, walls **11.9 × 12.0** — a **1.55 : 1** mismatch inside one room, in the two surfaces that fill most of the frame. It is identical in all ten rooms by construction. This is seam pattern #1 reproduced one layer down. | `shots/interior-report.json`, `shots/int-diner-front.png` |
| 2 | **high** | the floor density is not constant — it varies ±33 % with room size | `ct/interior.ts` | `linoT.repeat.set(round(W/1.6), round(D/1.6))`. The rounding to a whole tile count defeats the intent: W = 8.6 → 5 → **18.6** px/m; W = 8.0 → 5 → **20.0**; W = 2.4 → 2 → **26.7**; W = 2.0 → 1 → **16.0**. Ten rooms of ten sizes get ten floor densities spanning **1.67 : 1**, which is the "ten unrelated games" failure the kit was written to prevent. The comment says density comes "from the room's REAL METRES" — it does, then rounds it away. | measured across the region sweep |
| 3 | medium | the ceiling is an untextured flat colour | `ct/interior.ts` | `ceil` is a plain `MeshBasicMaterial({color})` against a textured floor and grained walls. It reads as a hole when you look up. Logged in the seam audit as finding 24 on the bodega; the kit has now institutionalised it for all ten. | `shots/int-bodega-cmp.png` |
| 4 | medium | nothing bounds palette luminance between rooms | `ct/interior.ts` | `palette` is four free hex ints, and the flat materials — not the glow — are what set a room's brightness. Measured wall luminance is 1.00 in both the diner and the bodega, ceiling 0.71 vs 0.67; with ten builders choosing freely there is no bound at all. The kit fixes lamp *count* (`round(D/3.5)`) and glow colour, i.e. the part that does not matter, and leaves the part that does. "Light level and colour temperature" is a set axis and it is currently unenforced. | region sweep |
| 5 | medium | the two pre-kit rooms are the odd ones out and are not on the kit | `ct/bodega.ts`, `ct/apartment.ts` | Bodega: walls are **zero-thickness planes**, texels **11.9 × 20** (1.68 : 1 anisotropic), no jambs, no reveal. The user's complaint that produced the kit — *"i need a door and not paper thin walls"* — is still literally true in the bodega. Apartment: floor 35.6 px/m against the diner's 18.6, and eight different wall thicknesses. As a set of three the world currently offers wall thicknesses of {0, 0.028–0.295, 0.18} and floor densities of {24.0, 35.6, 18.6}. | `shots/int-bodega-cmp.png` |
| 6 | medium | a room shorter than 2.15 m silently loses its door but keeps the hole | `ct/interior.ts` | `DOOR_H` is a fixed 2.15 regardless of `spec.h`. If a builder passes `h` below that, `addHole` rejects the door (`y1 > H`), `holes` comes back empty, and the front wall is built as one solid run — while the collider gap at `dAt ± dW/2` and **both** `[E]` spots are still registered from the same numbers. Result: an invisible doorway you walk through and a prompt with no door. Not currently triggered (the diner is 3.0 m); it is a trap laid for nine rooms not yet written. | source |
| 7 | low | `interiorMaxX()` is order-dependent and read once | `ct/interior.ts`, `crosstown.ts` | `bounds.maxX` is set from it when the rig is constructed (`crosstown.ts:285`), and it returns `SLAB_X0 + SLABS.length * SLAB_W`. Any room built *after* the rig extends the slab list but not the bound, so the last rooms would sit outside the player's walkable bounds. Correct today — the diner is built at line 240 — and a one-line trap for the nine still to land. | source |
| 8 | low | dead space inside a claimed slab has a ground height but no floor | `ct/interior.ts` | `interiorGround` answers `0` anywhere within a claimed slab, but only the room has a floor mesh. Unreachable today because the room's colliders hold you in; it becomes reachable the first time a builder puts a second space in their slab, or a teleport overshoots. | source |

## Checked and sound — recorded so nobody re-walks them

The kit's door machinery is correct, and I tested it rather than reading it.
**I nearly filed two false positives here** — my first walk test reported no
prompt at the diner door, and my first exit probe reported the player unable to
move. Both were my own errors: a bad DOM visibility check, and a way-out spot I
guessed at instead of computing from `dAt`/`hd`. Recomputed and re-run:

- **Entry is reachable from every approach.** North along the west walk, south
  along it, and straight in off the road all close to **0.21 m** against a
  1.05 m trigger. The prompt fires (`[E] into the DINER`). No repeat of
  GOTCHAS §8.
- **The way-out spot and the arrival point both show the prompt; the middle of
  the room does not.** That is exactly the kit's stated intent — you land a
  stride clear of the threshold with the way-out prompt already up.
- **Walking at the doorway from inside stops at z = 3.30**, i.e. inside the
  reveal with the prompt showing, and you cannot continue into the dead slab.
  The blocker-on-the-far-face trick works.
- **The exit landing is legal** — free to move in 4/4 directions, on the west
  walk at the right building, facing out across the street.
- **Group discipline is respected**: 0 of the diner's 56 meshes hold a local x,
  so the night sweep will not eat the furniture.
- **The kit's own warnings did not fire** for the diner — it passes its checks.
- **Room size against frontage is right, and it is the rule to hold the other
  nine to**: clear 8.6 + 2 × 0.18 = **8.96 m** against DINER's 9.2 m roster
  width. A room should fill its shopfront to within a wall thickness.

## Patterns

**1. The kit enforces structure and leaves finish free — and finish is what
makes ten rooms read as one world.** Everything that would break *obviously* is
locked down: addressing, wall thickness, jambs, door height, the collider that
cannot swallow the trigger, the exit-gap check. Everything that will break
*quietly* is a free parameter: floor density, palette, ceiling treatment. The
kit's own preamble names the fear correctly — "you would feel it immediately as
ten unrelated games" — and then guards the half of it that a builder would
probably have got right anyway.

**2. Same root cause as seam pattern #1, one layer down.** Two painters in one
file each pick their own px/m from their own constant, and nothing ties them.
The exterior now has `WALL_PPM`; interiors have 1.6 m for floors and 2.7 m for
walls, and no shared datum. The fix has the same shape: **one `INTERIOR_PPM`,
both surfaces derived from it, and the floor's repeat computed so the tile count
lands on the density rather than the density landing on the tile count.**

**3. Every check the kit performs is a `console.warn`.** The checks themselves
are good — overlapping openings, a door taller than the room, an exit inside its
own trigger. But a warning is invisible in a headless build and to a builder who
does not open the console. `scripts/interiors.mjs` already captures them; they
would be worth a build gate before nine more rooms arrive.

**4. The two pre-kit rooms should be ported, not grandfathered.** The bodega is
the room a player is most likely to enter first and it is the one that still has
paper walls. Every axis this audit measures puts it outside the set.

## Coverage — what I did NOT get to

- **Nine of the ten rooms do not exist.** Everything above is the kit measured
  through one room. When the others land the set comparison has to be re-run —
  the instrument is written and takes one command.
- **The queue asks whether each interior's window agrees with where its building
  stands on the street.** For the diner the *frontage* check passes (8.96 m
  against 9.2 m). The window's position along that frontage is a design
  correspondence between two objects in different parts of the world, and I
  could not verify it geometrically — I can only state the rule for the others:
  the room's front wall is the shopfront, so window centre and width should be
  read off the same numbers `ct/street.ts` paints the glazing from.
- **Light was measured, not judged.** I have luminance figures for the flat
  materials but did not compare rooms side by side by eye at matched exposure,
  which is the only way "colour temperature" really gets settled.
- **The apartment was measured by region, not walked**, this pass — its stairs,
  landings and room 301 were walked in the seam audit and have changed since.
- Daylight only; interiors are excluded from the night sweep by design, but I
  did not verify that exclusion still holds for the kit's rooms.
