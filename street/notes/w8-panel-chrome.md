# w8 — item 0c, "no pop-up menus": frameless panels for ATM, slots, blackjack, library PC

## Root cause, in one line

`hud.ts`'s `makePanel()` always wrapped a caller's screen in a SECOND,
framework-drawn cabinet (moulded plastic bezel, four screws, a title stamp, a
caption strip) — but `drawScreen` (atm.ts), `paintMachine` (slots.ts),
`paintTable` (blackjack.ts) and `drawDesktop`/`drawCatalog`/`drawMinesweeper`
(library-pc.ts) each ALREADY paint a complete, self-contained fascia of their
own — the ATM's buttons/CRT/card-and-cash slots, the slot cabinet's
topper/paytable/reels/meters, the felt table's rail and its own
`BLACKJACK PAYS 3 TO 2` legend, the '95 desktop's own scanlines and taskbar —
filling the whole canvas edge to edge. The player was looking at two nested
machines, the outer one drawn by the framework and stamped with a title
("FIRST FEDERAL SAVINGS", "LOOSEST SLOTS", "BLACKJACK", "LIBRARY TERMINAL")
that duplicated or invented branding the inner one already carried (or, for
the library PC, that no real '95 desktop would print on itself). That outer
cabinet — bezel + title bar + caption box, centred and popping up over the
game — is exactly the *"i never want there to be menus popping up unless they
are embedded to look as if they are in the actual game"* law item 0c names.

## What changed

`ct/hud.ts`: `PanelSpec.chrome` gained a third value, `'none'`. When set,
`makePanel` draws NO case, no screws, no title band, no screen recess, no
caption band — the caller's `draw()` fills the canvas at (0,0,w,h), full
bleed. The DOM wrapper no longer pop-scales in (`scale(.94) -> scale(1)`,
the "dialog opening" cue) — it only cross-fades. The one thing every panel
still owes the player — how to leave — is NOT baked into the canvas; it is a
small plain-text DOM caption appended below the canvas element (see "found
but not fixed" for why it moved there mid-task).

Applied `chrome: 'none'` to the four panels item 0c names that already fit
the shape: `ct/atm.ts`, `ct/slots.ts`, `ct/blackjack.ts`, `ct/library-pc.ts`.
Removed each one's now-redundant `title`/`caseTint` fields.

Item 0c also names a fifth panel, inventory (pockets) — see below for why I
did not convert it in this pass.

## My own verdict on the after-images

Screenshotted all four before deciding this was done. ATM and blackjack read
clean on the first pass — one cabinet, no floating box, the hint/ESC caption
sitting quietly under the glass. The library PC did NOT: the first version
baked the ESC hint into the canvas's bottom-right corner, and that collided
visibly with the terminal's own taskbar clock, also bottom-right (screenshot
caught it immediately — both texts overlapping, illegible). That is why the
hint moved out of the canvas into a DOM caption below it: a caller's
`chrome:'none'` `draw()` legitimately owns the WHOLE canvas including its
corners, so nothing the framework adds can assume a corner is free. Re-shot
after the fix; clean on all four, and library-pc's own hint text already
says "ESC step back" for its own reason (TAB vs ESC have different meanings
there), so the caption logic skips appending a second ESC when the caller's
hint already contains one.

## Verified

- `npx tsc --noEmit` clean throughout.
- `npm run build` clean (pre-existing dynamic-import/chunk-size warnings only,
  unrelated).
- New script `scripts/w8-frameless-panels.mjs`: opens each panel the way a
  player actually would (the ATM's real `[E]` Spot via `__atm.open()` as its
  test affordance is the same shape `K-atm-walk.mjs` already proves works
  from the in-world spot; slots and blackjack by SITTING at a seat found via
  `__ct.seats()` and pressing E, matching `L-slots-inworld.mjs`'s own method;
  library PC via its own `__librarypc.open()` test affordance, documented in
  its file as the way to test it until item 3 wires its seat) — asserts the
  canvas is now exactly the caller's own declared size with none of the old
  `BEZEL*2 + TITLE_H + CAPTION` padding, and that Escape still closes every
  one of them and stands the player back up. Ran clean against dev (4187)
  AND the built preview (4189, `vite preview`) — GOTCHAS-class bug (§28) has
  hit this exact seam (dynamic `import('./hud')`) before, so both matter.
- Existing suites unaffected: `K-atm-walk.mjs` (full in-world ATM session,
  real `[E]` spot, money conservation), `L-slots-inworld.mjs` (sit → spin →
  cash out → stand, money conservation), `L-blackjack-inworld.mjs` (buy in →
  deal → stand → cash out, money conservation), `w2-library-pc.mjs apps`
  (catalog search, Minesweeper) — all pass unchanged, on the built bundle.
- `node scripts/bugsweep.mjs` against my dev server: 0 STATION MISS, 0
  console errors (only pre-existing perf/deprecation warnings unrelated to
  this change).

## Found but not fixed

1. **Pockets (`ct/inventory.ts`) is a different shape, not converted.** Its
   `chrome:'cloth'` relies on the framework's cloth background + stitching
   for its whole visual identity — `paintPanel` only draws the six item
   slots, not a bag/pouch background — so `chrome:'none'` would leave it
   looking like blank slots floating in space. Item 0c's own text treats
   pockets like the machines ("Applies to ATM, slots, blackjack, inventory,
   and the library PC"), but the RIGHT shape for a HELD object is the
   wallet's own precedent — bottom-anchored, slides up in your hands, no
   `makePanel` at all — not the stand-at-a-machine treatment this pass built.
   Converting it means moving the cloth/stitching art into `paintPanel`
   itself and repositioning the DOM element like the wallet's. Queuing as its
   own item rather than forcing it into this shape.
2. **Two more panels have the identical "redundant chrome" bug, not
   named by this item:** `ct/int-bank.ts`'s loan desk (`ct-loan`,
   `chrome:'cloth'`, draws its own full letterhead-paper background) and
   `ct/tenancy.ts`'s letter panel (`ct-letter`, `chrome:'cloth'`, already
   drops `title` for its own reason). Same fix, same shape — flagging for the
   desk to queue rather than touching files this item does not name
   (`int-bank.ts` especially mixes panel code with a lot of room geometry
   that belongs to someone else).
3. **Pre-existing, unrelated bug found while testing, NOT fixed:** sit at a
   slot stool, stand up (Escape), walk straight to the blackjack table and
   press E — the prompt correctly reads `[E] sit at the blackjack table`, but
   pressing E does not seat the player (`__ct.seated()` stays false,
   `__hud.panel()` stays null). **Reproduced identically on the UNMODIFIED
   code** (`git stash` the five files this item touched, same repro
   sequence, same failure) — it predates this change and is not something
   `chrome:'none'` caused. It looks like it lives in the shared seat/spot
   machinery (`crosstown.ts` / `fp.ts`), neither of which this item names or
   grants. A fresh page (no prior seat visited) sits at either machine fine,
   which is what let `scripts/w8-frameless-panels.mjs` still verify both
   panels — one page per seat, noted in the script's own comment. Queuing for
   the desk to route to whoever owns `fp.ts`/`crosstown.ts`'s seat handling.
4. **True pixel-perfect world-anchoring was not attempted.** Item 0c's
   fullest version — the panel projected exactly onto the real 3-D screen
   mesh, the way the TV (`ct/apartment.ts`) does with a live texture on real
   geometry and no DOM panel at all — would need the ATM's screen transform
   from `ct/bank.ts` and the interactive slot/table's transform from
   `ct/int-casino.ts`, neither of which this item names, and neither exports
   what would be needed. What this pass delivers — one cabinet instead of
   two, no title bar, no floating box, centred because the seat/approach was
   already built facing the machine — resolves the literal complaint in item
   0c's own quoted text without that deeper cross-file work. If the user
   wants literal pixel-perfect world-anchoring beyond that, it is a separate,
   larger follow-up needing coordination with whoever owns those two files.
5. **library PC's seat is still unreachable by sitting** — a gap `library-pc.ts`'s
   own top-of-file comment already documents: it joins on seat label
   `'sit at the computer'`, but `ct/int-library.ts:1261` still registers its
   chairs as `'sit at the terminal'` (queue item 3, a different row, not
   landed). Pre-existing, not mine to fix; used `__librarypc.open()` to test
   the chrome change instead, same as the file's own comment prescribes.

## Derived vs. copied

- `slots.ts`'s `FACE = { w: 320, h: 256 }` and `blackjack.ts`'s
  `FELT = { w: 320, h: 256 }` are already-exported constants — imported into
  the verification script's expectations by citation, not retyped from a
  screenshot.
- `atm.ts`'s `W = 300, H = 214` and `library-pc.ts`'s `W = 320, H = 220` are
  private constants inside files this item grants me — read directly, not
  copied across an ownership boundary.
- The "already self-contained" claim for each `draw()` (the actual reason
  `chrome:'none'` is correct here rather than just convenient) was derived by
  reading `drawScreen`/`paintMachine`/`paintTable`/`drawDesktop` in full, not
  assumed from the panel's visual result.

## New file

`scripts/w8-frameless-panels.mjs` — kept; it is the only check that walks all
four converted panels' real opening path (spot/seat) and asserts the
padding-free canvas size, so it is worth the desk keeping in the suite for
whoever touches `chrome:'none'` panels next.
