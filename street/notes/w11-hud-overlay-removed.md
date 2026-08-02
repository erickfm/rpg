# w11 → desk: item 0g, "remove the on-screen HUD text — re-filed to the right files"

## Root cause, in one line

`index.html` declared a `#style-hud` div and its CSS, and `src/main.ts`'s
`load()` wrote a title card (`CROSSTOWN '97 1/1`), a feel line (`The small
world — one hand-made street.`) and a controls strip into it on every world
load — a fixed on-screen HUD sitting over the game the user asked removed
twice (item 0d misfiled it against `ct/hud.ts`, which has nothing to do with
it; w4 measured that and correctly released it without editing, per
`notes/w4-hud-overlay-text.md`).

## The fix

- `src/main.ts`: removed the `const hud = document.getElementById(...)` line
  and the `hud.innerHTML = …` assignment in `load()` that built the title/
  feel/controls block. Left a short comment pointing at why (item 0d/0g) and
  noting the `[E]` prompt is a different element entirely.
- `index.html`: removed the now-unused `#style-hud` div and its four CSS
  rules. Nothing else in the page referenced it (`grep -rn "style-hud" src/
  index.html` after the edit: no hits outside history).

## What was deliberately NOT touched

- **The `[E]` prompt** (`#ct-prompt`, painted by `ct/hud.ts`/`crosstown.ts`)
  is a completely separate DOM element from `#style-hud` and was never part
  of this code path. Confirmed still working: `interiors-walk.mjs church`
  (run for item 9c, same session) exercises it repeatedly (`"[E] into ST
  BRIGID'S"`, `"[E] out to the street"`, etc.), and the church screenshot
  below shows the door/seat prompts unaffected.
- **The build-stamp watermark** in the bottom-right corner (visible in the
  screenshot below, reading `88d535ea1+ 22:03`) looks similar but is a
  different, deliberate mechanism — painted by `ct/hud.ts` from
  `virtual:build-stamp`, and read by `scripts/lib/which-world.mjs` to prove a
  verification script is measuring the right server (`GOTCHAS`, "which world
  did this script just measure?"). It is infrastructure, not the "overlay
  descriptions... controlls" the user asked removed, and removing it would
  break every script that calls `reportWorld()`. Left alone.

## Verified

- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/index.html` shrank from 0.99 kB to 0.50 kB,
  consistent with the removed markup/CSS and nothing else changing shape.
- `node scripts/bugsweep.mjs` on dev: 0 STATION MISS, 0 console errors.
- Screenshot (`shots/w11-church-rear.png`, reused from item 9c's structural
  check, gitignored) taken on **both dev and the built bundle** (`vite
  preview`): the bottom-left title/feel/controls block is gone in both; the
  build-stamp watermark and the world itself are otherwise unchanged.

## Found but not fixed

Nothing further in this file. `notes/w4-hud-overlay-text.md` (the original
misfile report) can be considered closed by this.

## Derived vs. copied

Nothing copied — the removed markup/CSS/JS was read directly out of the two
files this item grants, not retyped from a screenshot.

---

*w11. Touched: `src/main.ts`, `index.html` (the files this item grants).
No new files.*
