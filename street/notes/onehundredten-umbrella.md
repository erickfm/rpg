# Item 271 — *"umbrella looks so janky."*

Worker onehundredten, 2026-08-03. Port **4661**. `ct/crowd.ts`.

## Root cause in one line

**Height, not width.** A hat sits *on* the head; an umbrella floats above it,
and what the eye reads is the **daylight in between** — `UMB_CLEAR` was
**0.10 m**, which at a normal walking distance is not daylight at all.

## Why the previous fix could not have worked

The file already names this failure — *"a first cut at 0.95 m / 32 px read as a
HAT rather than a brolly — a canopy has to be wider than the shoulders it is
keeping dry"* — and the fix applied was to widen it to `UMB_M = 1.14,
UMB_PX = 38`. That sentence is true and it is not the cause. Width does not
separate two silhouettes stacked vertically.

## Measured before touching anything

**The sheet is not the problem.** `w110-umbrella-sheet.mjs` pulls the live
38×38 texture out of the scene and prints it as a character map. Everything the
desk listed as missing is *painted*: dome rows 2–14, ferrule rows 0–1, **shaft
rows 15–29**, wooden crook rows 30–32, scalloped hem, four one-texel ribs.

⚠ **My first version of that finder matched 17 meshes** — "any 38×38 map" — and
handed back an opaque noise tile. The shipped filter also requires a *square*
`PlaneGeometry` and **>25% transparent texels**. A probe that answers
confidently about the wrong object is the failure mode this project keeps
paying for.

**So the fault is in how the parts are SEPARATED, not in whether they exist.**
`w110-umbrella-look.mjs` shoots one walker at **1.6 m, 4 m and 8 m** in rain
(the old `w96-umbrella-closeup.mjs` frame had its walker ~12 m off behind a
street tree, canopy nine px tall — nothing judgeable). At 4 m:

- the 0.10 m gap subtends **1.4° ≈ 12 screen px**; hair and canopy are both
  dark, so they fuse into one mass on the shoulders — **a cap**;
- the shaft is one texel of `#4a4a52` drawn **straight down over dark brown
  hair**, so it contributes nothing;
- dome aspect **13 rows / 36 texels wide = 0.36** — a plate, not a canopy;
- the canopy is **one flat colour**, so it has no volume.

Before/after: `shots/w110-umb-before-0-{1p6,4,8}m.png` /
`shots/w110-umb-after-0-*.png`.

## What changed — three things, in order of how much they did

1. **`UMB_CLEAR` 0.10 → 0.30 m.** Most of the fix. It also does the second job
   for free: it **moves the shaft off the hair and into open air**, where one
   dark texel against the street reads immediately. *No change to the shaft's
   drawing at all.*
2. **`UMB_HEM` 0.37 → 0.46 of `UMB_PX`** — dome aspect 0.36 → 0.47, about what
   a real 8-rib canopy does. Still a fraction, not a literal.
3. **Form.** Lit right flank / shadowed left flank (light from the right, the
   same reading `ct/hud.ts` uses for the wrist) and a dark **underside band**
   at the hem, so the rim is a shell edge rather than a bright brim.

**`UMB_CLEAR` is a LOOKED-AT value and the comment says so.** There is nothing
in the file to derive it from — it is how much air a person reads as "held
above". I deliberately did not dress it in a formula; the constant I met in
item 275 (`WATCH_DROP`) wore one that was arithmetically wrong by 45 px and
would have broken the thing it claimed to protect.

## The three constraints the item said must survive — all do

| | |
|---|---|
| billboard, not a sixth atlas view | untouched |
| colours indexed, **never** `rnd()` | no random draw added; `UMB_CANOPY` untouched |
| rows are fractions of `UMB_PX` | `Math.round(UMB_PX * 0.46)`, still a fraction |
| px/m matches the citizen | `UMB_M`/`UMB_PX` untouched → **33.3** vs the sheet's 33.7 |

## Found and fixed in passing — a latent trap

**The scalloped hem cuts holes with `clearRect`, and it was drawn BEFORE the
crown highlight.** Anything shaded after it refills the notches with a
translucent pixel. My flanks would have silently undone it. The scallop is now
the last thing drawn on the canopy, with a comment saying why it must stay
there.

## Proof

- Looked at all six frames myself. At 4 m and 8 m the canopy now floats clear
  of the head with visible sky under the hem and a readable shaft; at 1.6 m the
  lit/shadow split gives it a dome. **My verdict: it reads as an umbrella.**
- `w96-umbrellas.mjs` (the existing pass/fail) — **PASS**, 10 wet hours up,
  16 dry hours furled, 0 partial. The hysteresis is unaffected.
- `tsc --noEmit` clean · `health.mjs` **WORLD OK** · `bugsweep`
  **0 STATION MISS, 0 COVERAGE**, no new console errors.

## Not fixed — for the desk

1. **Both arms still hang at the sides** — the desk listed this and it is real:
   nobody appears to be *holding* the umbrella. It cannot be fixed from
   `crowd.ts`, because the arms are painted into the **citizen atlas**, and a
   raised-arm pose is a new `Look` field that every atlas caller would inherit.
   Genuinely out of this item's boundary (BUILDER-BRIEF §9); worth its own row.
2. **The canopy now tops out around 2.5 m.** I saw no clipping under the
   library portico or the shopfront awnings in these frames, but I did not
   sweep every soffit on the block. If anything is hung lower than 2.5 m over
   the pavement, a canopy will now pass through it.
