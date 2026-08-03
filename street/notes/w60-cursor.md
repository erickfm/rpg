# w60 — item 133, the ATM cursor

**Port used: 4184.** Built bundle via `vite preview`, sha-matched by
`bugsweep.mjs`'s world guard (which caught a stale `dist/` twice).

> *"the atm interface is so good. but the mouse cursor is a bit misaligned. like
> the stick part of the cursor."*

## Verdict: I could not reproduce a misalignment, and all three of the item's DONE WHEN conditions are ALREADY met by the code as it stands

No behaviour change landed. What landed is the evidence, plus a comment at the
hotspots so this is not investigated a fourth time.

## The item's stated cause is false

> *"the hotspot is in CSS pixels while the art is at 2x … if the tip is at art
> pixel (0,0) that is fine, but the hand's `9` must be right in the SCALED
> image. That factor-of-two is the likeliest single cause."*

It is not the cause. Rasterised exactly the way `cursorUrl` rasterises it
(`S = 2`, `N = 16`, so a 32 × 32 PNG), parsed out of `ct/hud.ts` rather than
retyped:

| | drawn feature | in PNG px | declared hotspot | |
|---|---|---|---|---|
| arrow | point, source cell (0,0) | x 0…1, y 0…1 | `0 0` | **lands on it** |
| hand | fingertip, cells x 4…5 row 0 | x 8…11, y 0…1 | `9 0` | **lands on it** |

**The `9` is already the doubled value** — the fingertip is at source cells 4–5,
and 4.5 × 2 = 9. The undoubled-coordinate bug the item predicted is not present.
`scripts/probes/w60-cursor-hotspot.mjs` prints the table and renders both
cursors at 14× with the hotspot pixel marked in red:
`shots/w60-cursor-hotspots.png`.

## Nor is there a hit-test offset — measured end to end, at a real key edge

`scripts/probes/w60-cursor-lands.mjs` stands at the ATM, opens it, reaches the
PIN pad, and walks the **real mouse** one client pixel at a time across the edge
of key `5`, reading `document.body.style.cursor` after each move. The arrow/hand
swap is driven by `hotAt`, so this measures the hit-test through exactly the
path the player's hand goes through — no internals, no reimplemented ray.

```
key '5' occupies canvas px x 129…169, y 110…134
  left edge projects to client x 602.42 … right edge 674.00   (1.79 px per texel)
  the cursor becomes a HAND at client x 603
  MISALIGNMENT: 0.58 client px (0.33 texels)
  the cursor becomes a HAND at client y 374, drawn edge 373.44
  MISALIGNMENT IN Y: 0.56 client px (0.31 texels)
```

Both are inside the 1 px sampling step. A click 2 px inside that edge enters a
digit (`shots/w60-cursor-atm-edge.png`, one `*` on the PIN line). `pick()` in
`crosstown.ts:1443` is textbook — `getBoundingClientRect`, correct NDC — so
there was never a mechanism for an offset here.

The 1.79 px/texel I measured also independently agrees with `atm.ts`'s own
comment claiming "roughly 44% of frame width, ~1.9 screen pixels per texel", and
the uv mapping I derived reproduces its "u runs 0→1 as world z runs
+0.31→−0.31" exactly. Two claims in that file are now checked rather than
asserted.

## "the arrow reads as one continuous shape" — it does

No white fill leaks through the outline anywhere in either cursor. My own
checker flagged two cells as "outline touching no fill", **and both are false
positives I nearly acted on.** Traced as a closed polygon the arrow is:

> `(0,0)` down the left edge to `(0,14)`, up the barb's inner diagonal to
> `(3,11)`, down the tail's left edge to `(6,14)`, across the cap `(7,15) (8,15)`,
> up the tail's right edge to `(6,11)`, right along the head's underside to
> `(9,10)`, and up the long diagonal back to `(0,0)`

— closed, no gaps, every fill cell enclosed. The two flagged cells are `(0,0)`,
the apex, and `(0,14)`, **the bottom point of the left barb**. Both are 1-cell
*points* of the shape, which by construction have no fill beside them.

I had `(0,14)` written up as "a 1 px black stick hanging off the bottom-left" —
which fitted the user's words *"the stick part"* almost too well — and was about
to delete it. **Deleting it would have cut the point off the arrow.** Tracing
the polygon is what saved it. The probe now carries that trace as a comment so
the flag cannot be acted on by the next reader. This is BUILDER-BRIEF §7 exactly:
the measurement surprised me, and the answer was in the shape, not the checker.

## What I could NOT rule out — for the desk to put back to the user

**A CSS cursor is composited by the browser and never appears in a page
screenshot.** I can verify the source raster and I can verify the position; I
cannot photograph the pointer as it appears on his machine. So one hypothesis
survives, and it is cheap to settle with one question:

> **Does the cursor look like 1997 pixel art at all, or does it look like your
> normal system arrow?**

If it is the system arrow, the custom image is being refused — Chrome rejects
cursor images past a size limit measured in *device* pixels, so a HiDPI display
can silently fall back — and everything above is true and irrelevant, because he
is not looking at this art. If it is the pixel art, then the two mechanisms by
which a cursor can be misaligned are both measured correct, and I would want the
screenshot before touching anything.

A second, weaker possibility worth naming: arrow and hand have hotspots 9 px
apart in x, so the **shape visibly jumps sideways** at the moment it swaps from
arrow to hand crossing onto a key. That is inherent to two cursors with
different hotspots and is what Windows did too — but it is the one thing in
here that genuinely looks like the cursor shifting, and it happens exactly when
he is aiming at a key.

## Found and NOT fixed

- **Four instrument faults of my own, in this item alone**, all caught before
  they reached a conclusion. The worst: the alignment probe assumed a
  `PlaneGeometry`'s uv `u` runs along local `+x`. **The ATM screen's rotation is
  baked into its vertices** — `matrixWorld` is a pure translation and
  `geometry.parameters` still reports the pre-rotation size — so that assumption
  projected both edges of a key onto the *same screen column*, two points that
  differed only in depth, and reported the key as `0.0 client px wide`. The fix
  is to read the corners off the `uv` and `position` attributes. **Any probe in
  this repo that maps a texture coordinate onto a mesh via
  `geometry.parameters` is wrong wherever geometry was baked** — worth a sweep.
- The screen texture is **300 × 205**, not 600 × 410: `scale: 2` is the panel's
  drawing scale and does not appear in the texture's backing size. Guessing the
  latter made a probe report "the ATM screen mesh is not in this world" while
  standing in front of it with the panel open.
- `bugsweep.mjs` prints a 14-line `warning:` baseline on a clean run (also noted
  in `notes/w60-mug.md`). Still worth an allowlist.
- I did not touch `ARROW_ART`, `HAND_ART` or either hotspot. Nothing about them
  is wrong.

## Verification

- `npm run typecheck` clean; built bundle.
- `node scripts/bugsweep.mjs` against 4184: **0 STATION MISS, 0 COVERAGE**.
- `scripts/probes/w60-cursor-hotspot.mjs` — raster + hotspots + continuity.
- `scripts/probes/w60-cursor-lands.mjs` — end-to-end click alignment, x and y.
- `scripts/probes/w60-screen-basis.mjs` — the baked-rotation finding.
