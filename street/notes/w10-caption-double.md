# Item 0e — the frameless panel caption is double-rendered

## Root cause (one line)

`crosstown.ts`'s per-frame loop writes the world's own `[E] ...` prompt
(`ct-prompt`, anchored near the bottom of the viewport) every frame regardless
of whether a panel is open, and item 0c's frameless-panel captions (`ct-hud.ts`
`cap` div, added under each panel's own canvas) land in the same vertical band
— so while seated or standing at a converted panel, two independent captions
render on top of each other.

**Not what the item description guessed.** It reads as if the panel's own
`hint()` and the framework's `ESC` string were somehow both being painted —
they are not; `hud.ts:508-513` already combines them into one clean string
(`"press the numbered buttons   ·   ESC"`, verified by direct DOM read). The
actual second string is the **world's own `[E]` prompt**, which item 0c never
taught to get out of the way. Measured directly (not guessed) on the built
slots panel before the fix: `ct-prompt` at viewport y 603.8–632.0 px, the
panel's own caption at y 610.9–629.1 px — near-total overlap, not adjacent
lines.

## Fix

One change, entirely inside `ct/hud.ts` (this item's grant), no other file
touched: `prompt()`'s setter now force-hides `ct-prompt` whenever `panelUp()`
(hud.ts's own panel registry) reports a panel open, instead of trusting
whatever `crosstown.ts` asked it to show that frame.

```ts
prompt: (text) => {
  if (text === null || panelUp()) { promptDiv!.style.display = 'none'; return; }
  ...
```

This covers all four converted panels (atm, slots, blackjack, library-pc) —
and every future frameless or chromed panel — with one guard, because
`panelUp()` is the same registry every panel already joins by existing.

## Verified

- `scripts/w10-caption-double.mjs` (new): opens each of the four panels the
  way a player actually would (ATM by walking to its Spot and pressing E;
  slots/blackjack by sitting; library-pc via its own documented
  `__librarypc.open()` test affordance — its seat is not wired yet, see
  below), and for each: checks the world prompt is hidden, the panel's own
  caption is showing, the two do not overlap, and — for the seat-opened three
  — that standing back up via Escape restores the world prompt (no new trap).
  **ALL OK** against dev (port 4193) and the **built preview bundle**
  (`vite preview`, port 4197).
- `scripts/w8-frameless-panels.mjs` (pre-existing, item 0c's own): still ALL
  OK, no regression to chrome sizing, Escape, or the panel-plus-seat wiring.
- `scripts/K-atm-walk.mjs` (pre-existing): still ALL OK — full ATM flow
  (card, PIN, balance, withdraw, cash conservation, walk-away) untouched.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean (pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` /
  chunk-size warnings only, unrelated to this change).
- `node scripts/bugsweep.mjs`: zero STATION MISS, no new console errors (93
  shots).

## Found, not fixed — pre-existing, unrelated to 0e

`ct/library-pc.ts:20-30` documents its own gap in its header comment: the
library's terminal chair still carries the OLD seat label
(`'sit at the terminal'`, `int-library.ts:1261`) while `library-pc.ts` joins on
`SEAT_LABEL = 'sit at the computer'` — so sitting at the actual terminal chair
in the world does **not** open the panel yet. This is queue item 3's job
(rename the label in `int-library.ts`), explicitly out of `ct/hud.ts`'s grant,
and pre-dates this item. `w10-caption-double.mjs` works around it the same way
the project's own `scripts/w2-library-pc.mjs` does — via
`window.__librarypc.open()` — rather than sitting.

## Derived vs. copied

The overlap measurement (y ranges, exact caption strings) was read live off
the DOM via `getBoundingClientRect()`/`textContent` in the test script, not
hand-typed from source — nothing here is a copied constant.
