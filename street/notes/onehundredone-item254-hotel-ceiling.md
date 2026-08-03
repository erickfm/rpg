# onehundredone / item 254 — the hotel ceiling was not dark, it was ABSENT

**DONE.** The one real defect in the lobby is fixed, the four false observations
were left strictly alone, and **the ceiling's colour is unchanged** — which is
the part worth reading, because the row and the survey both framed this as a
tone problem and it is not one.

The user, 2026-08-02: *"[screenshot] hotel interior is strange. needs some
work"* (`FEATURE-REQUESTS.md:2476`). Worker ninetyseven had already surveyed the
room and disproved four of the row's five observations
(`notes/ninetyseven-item96-hotel-survey.md`); I did not re-litigate any of them
and I did not touch the chairs, the carpet, the corridor sign or the clerk.

---

## What was actually wrong — measured before anything was changed

`scripts/probes/w101-hotel-ceiling.mjs`, on the **built bundle** at `:4191`,
clock pinned to **13:00** (a game day is 24 real minutes, so an unpinned pair of
frames is two different times of day). **Five runs each**, because `dither()` and
`slabTex`'s speckle use unseeded `Math.random` on purpose (`paint.ts:4`).

| vantage | ceiling cover % | **edge density %** | distinct RGB | mean luminance |
|---|---|---|---|---|
| across-e | 39.6 | **1.78** `[1.73..1.87]` | 188 | 32.4 |
| across-w | 43.6 | **2.65** `[2.61..2.69]` | 194 | 33.3 |
| along | 22.8 | **3.13** `[3.06..3.25]` | 160 | 33.5 |
| entry | 23.0 | **1.34** `[1.29..1.38]` | 168 | 27.9 |

**Two facts, and neither of them is the colour.**

**ONE — THE CEILING HAD NO TEXTURE AT ALL.** `ct/interior.ts:889` builds every
room's ceiling as `MeshBasicMaterial({ color })` with **no map**. The diagnosis
is already written down in this codebase, by B, for the ground — `paint.ts:53`:
*"an untextured quad has no grain for the eye to attach to and no joints to give
it scale, so it reads as a TINT OVER the paving rather than as a piece of
paving."* B measured **123 ground-facing surfaces** in that state and it was
behind **four separate user complaints**. **Nobody ever swept the ceilings.**

In the ten pale rooms it does not show — a flat `#c4c1b4` at 2.5 m passes for
plaster. The hotel is the one room where it must: `ceil: 0x2e1c1e` is the
**darkest ceiling in the world**, on the **tallest room in the belt** (3.4 m),
in the **widest** (11 m). A large dark field containing literally one colour
does not read as dark. It reads as **absent**.

**TWO — NOTHING TERMINATED THE WALL.** The room has a skirting and a picture
rail at 2.35 m, and then 1.05 m of bare ox-blood running into black with a
razor-sharp step and no moulding on it. That step is why the eye reads the black
as *behind* the wall rather than *above* it.

**And that is the whole of "why only across the room".** Look ALONG it and there
is a lit pendant in frame, both side walls converging, and the field is 23% of
the picture. Look ACROSS and there is no lamp above you — the five hang in a
**single file down the centreline**, so at 2 m off-centre the nearest one is out
of frame — the field nearly **doubles to 40%**, and it is bounded by one straight
edge. Same ceiling, twice the frame, none of the things that were explaining it.

---

## What I changed — `src/proto/ct/int-hotel.ts`, one new section, ~60 lines

All of it inside the file the item names. **No colliders** (7 new `put()` calls,
0 new `solid()`), so nothing about movement, floors or seats moved.

1. **A coffer field.** `slabTex` sized from the room's real metres and mapped
   **1:1 — no repeat at all**, which is BUILDER-BRIEF §7b satisfied by
   construction. `ppm = 32 / 2.7 ≈ 11.9`, **matched to the kit's own wall
   density** (`ct/interior.ts:908`) rather than picked, so the ceiling does not
   draw at a different grain from the wall it meets. `joint: 1.3` m.
   Laid at `H − 0.010`, exactly as the carpet is laid 7 mm over the kit floor.
2. **Four principal beams on the bay joints**, plus two down the length at
   `±W/4`. New `bayZ(i)` is derived **off `lampZ`** — `lampZ(0) − BAY/2 + i·BAY`
   — not written as a second `-hd + D·(i/N)` that happens to agree today. The
   user's complaint that started this room's lighting work was *"the pendant
   lights and the recessed panels are on different rhythms"*, caused by exactly
   that. One grid, and a consequence of it is that a beam is 2.6 m from any lamp
   **by construction**, so it can never foul the kit's rose-and-dome.
3. **A cornice** capping all four walls: a deep member in the room's own gold
   gone dusty, with a lit fillet on its bottom arris. Underside at **3.24 m** —
   it clears the corridor sign (top **3.21**) by 3 cm and the window pelmet
   (top 2.97) by 27, which is why the member is 0.16 deep and not 0.20.
4. **The four palette hexes hoisted to `H_FLOOR`/`H_WALL`/`H_CEIL`/`H_TRIM`**,
   same values, so the ceiling section derives its tones from the palette
   instead of a second hand-typed `0x2e1c1e` (§8).

**`H_CEIL` IS UNCHANGED AND THE CEILING IS STILL DARKER THAN THE WALL.** That is
this room's own written rationale (*"so the room feels tall and the light hangs
IN it"*) and it is what makes the frame the survey called handsome work. Mean
ceiling luminance moved **32.4 → 33.6**; the wall's is **49.0 → 49.0**.

---

## After — same probe, same pinned hour, five runs

| vantage | **edge density %** | distinct RGB | mean luminance |
|---|---|---|---|
| across-e | **5.26** `[5.15..5.40]` | 460 | 34.2 |
| across-w | **5.73** `[5.59..5.84]` | 465 | 34.6 |
| along | **6.51** `[6.36..6.74]` | 491 | 35.3 |
| entry | **2.75** `[2.58..2.86]` | 349 | 28.5 |

**The before and after spreads do not overlap on any vantage** — across-e is
`[1.73..1.87]` against `[5.15..5.40]`, a 3.0× separation with a clear gap.

**Edge density is this repo's own metric for this exact question**, not one I
invented: `paint.ts`'s note on `slabTex` settles the park-path case with
*"1.2% edge density against 4.9% for the jointed civic slab"*, where **1.2% was
the tint-over-paving failure**. The hotel ceiling across the room measured
**1.78% — squarely in the documented failure band — and now measures 5.26%,
past the documented good one.** It landed on the project's own scale.

Frames (my worktree; `shots/` is gitignored):
`shots/w101-hotel-{across-e,across-w,along,entry}-{before,after}.png`, plus
`shots/bug-hotel-wide.png` — **the survey's "this is the strange one"** — reshot
by the sweep at `37b21f4f2`.

**My own verdict, having looked at every one of them.** The across-the-room
frames are transformed: the razor-edged black band is gone and the ceiling
recedes as a coffered surface capped in gold. `along` and `entry` are improved
rather than transformed, which is right — they were never the complaint. In
`bug-hotel-far.png` the cornice also puts a top edge on the survey's *"large
untrimmed red mass filling the right ~40%"*; that mass **is the east wall at
close range in extreme perspective**, which answers the one thing the survey
explicitly refused to guess at.

---

## ⚠ TWO THINGS I GOT WRONG AND CAUGHT BY LOOKING, NOT BY A NUMBER

**My own probe lied first, exactly as the brief warns.** Version one took "the
room-sized plane up high" and read `material.color` off it for its reference
tone. The moment my second, **mapped** ceiling plane matched the same filter,
`material.color` on a mapped `MeshBasicMaterial` is the **white tint
multiplier** — so the reference became `#ffffff` and the probe reported
`cover 0.0%, lum 252.7` for a room that had not been lightened anywhere. **A
probe that changes its own reference between the before run and the after run is
not measuring a change**, and this one would have printed a triumphant number
either way. It now takes the tone off the plane with **no map** — the kit's own,
which this file never touches — and aborts (exit 3) if there isn't one.

**`THREE.Color.lerp` mixes in LINEAR space.** My first beams read as sawn timber
and the room as a barn, so I dropped the blend from 0.30 to 0.17 — and the
reshot frame **looked identical**, because `new THREE.Color(hex)` converts sRGB
to linear and the mix moved the beams from RGB (85,63,31) to (72,52,31),
thirteen levels. Every other colour in this file is a hand-picked sRGB hex, so
the blend belongs in the same space: it is now a byte blend, `mixHex(H_CEIL,
H_TRIM, 0.21)`. **I only caught this because I re-shot and looked.** No number I
was printing would have told me.

I also walked `grain` back from 0.11 to 0.055 for the same reason: `slabTex`
scales speckle *contrast* off `grain` (`paint.ts:139`), and on a near-black base
0.11 put pale texels at ~(84,69,68) — at 11.9 px/m one texel is 8.4 cm, so from
underneath they read as a ceiling **with bits missing**.

---

## Verification

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `node scripts/health.mjs` (built bundle, `:4191`) | `WORLD OK`, **exit 0** |
| `scripts/interiors-walk.mjs hotel` (built bundle) | **29/30**, no `[interior:*]` warning |
| `node scripts/bugsweep.mjs` | **96 shots, 0 STATION MISS, 0 COVERAGE**, no new console errors |
| new colliders | **0** — 7 `put()`, 0 `solid()` |

The single `interiors-walk` FAIL — *"the customer station comes from the world,
not from memory"* — **is the pre-existing instrument debt ninetyseven recorded
in both of its runs**: no served-spot is published in this room, so the check
falls back to the authored pair and cannot falsify it
(`F-keeper-stations-audit.md`). Not caused by this change; not touched.

**`fp`/`fpdiff` was deliberately NOT used.** This change adds meshes, and
CLAUDE.md is explicit that `scenedump.mjs` seeds `Math.random` globally while
three draws UUIDs per mesh — so it would have reported a texture catastrophe
that is not there.

---

## FOUND AND NOT FIXED — for the desk to rank

1. **EVERY CEILING IN THE WORLD IS AN UNMAPPED FLAT COLOUR.**
   `ct/interior.ts:889` is one line and it serves all 13 rooms. I fixed the
   hotel from inside the hotel because that is the file item 254 names; **the
   other twelve still have it.** It does not read as badly in the pale rooms —
   that is precisely why it survived — but it is B's 123-surface finding
   repeated on a class nobody swept, and the cheap general fix is `slabTex` in
   the kit with each room's own `pal.ceil`. **This needs a kit-owner, not me.**
2. **`scripts/masonry.mjs` cannot see any of it.** It sweeps only faces tagged
   `userData.masonry`, so no ceiling in the world is checked by anything. Same
   blind spot BUILDER-BRIEF §7b describes for pillars, doors and benches.
3. **The lobby suite and chairs are still untextured `MeshBasicMaterial` boxes**
   (`int-hotel.ts:530`, `:973–977`) — ninetyseven filed this and it is still
   true. It is the same defect class I just fixed on the ceiling, one storey
   down, and it is the thing I would do next in this room.
4. **The five pendants hang in a single file down an 11 m-wide room.** That is
   why the across-the-room sightline had nothing overhead to explain the dark in
   the first place; the coffers now carry it, but a second file of fittings, or
   wall brackets, is the furnishing answer the survey pointed at. **Not a
   defect — a judgement call, and it wants the user's eye, not mine.**
