# w2 — item 4: a Windows-style PC you can actually use

**Root cause, one line:** this is new work, not a fix — the library's
terminal chairs (`int-library.ts`) were geometry with no interaction behind
them; nothing in the tree turned "sit at a library computer" into a working
screen the way `slots.ts`/`blackjack.ts` do for their machines.

## What I built

`src/proto/ct/library-pc.ts` (new file). A bridge module in the exact shape
of `ct/slots.ts` / `ct/blackjack.ts`: no geometry, registered only through
`ct/world.ts`'s auto-incorporation (`export const ORDER`, `export function
register(ctx)`), opens a `makePanel` screen the instant the player sits in a
seat carrying `SEAT_LABEL = 'sit at the computer'`.

Two real apps, per the item's own steer ("two or three apps that genuinely
work beat ten stubs"):

- **CARD CATALOG.EXE** — a live-typed search over 30 hand-entered public-domain
  book rows (title/author/year/subject), matching on all three fields.
- **MINESWEEP.EXE** — a complete, playable Minesweeper: 11×9 board, 14 mines,
  first-dig-is-always-safe seeding, iterative flood fill, flagging, win/lose
  detection, restart. Fully keyboard-driven (arrows/space/F/R/TAB), matching
  every other panel in this world (`hud.ts` never hands a caller mouse
  coordinates).

A small desktop screen (teal background, two icons, a taskbar clock read off
`ctx.clock.now()`) sits between the two, selected with arrows/Enter.

## The item-3/item-4 split, and why the seat join is not live in this worktree

Item 4 explicitly says **do not edit `int-library.ts`** and to join on the
seat label `'sit at the computer'` — but that rename is item 3's job, and
item 3 was still `DOING w1` (a different builder, a different worktree) when
I worked this. So in *this* worktree the terminal chairs still publish the
old `'sit at the terminal'`, and sitting there does nothing new yet — by
design. The moment item 3's rename lands, this joins automatically with no
further change here (verified by construction: `seatedAtComputer()` reads
`ctx.seats()` and matches on the exact string).

## Verification

- `npx tsc --noEmit -p .` — clean.
- `scripts/w2-library-pc.mjs` (new, permanent — modelled on
  `L-slots-inworld.mjs`), against **dev (4181)** and the **built bundle**
  (`vite preview`, 4181), both green:
  - the module reaches `ct/world.ts`'s loader (`library-pc.ts@87`, confirmed
    via `world-wired.mjs` too — 12/12 modules, 12/12 rooms).
  - catalog search matches on title AND author, and a non-matching query
    returns zero rather than everything.
  - Minesweeper: first dig never a mine, flood fill actually opens more than
    one cell, restart reseeds, and a swept run of digs does end the game
    (dead or won) rather than running forever — confirmed the LOSE path
    specifically (screenshot-verified during dev: BOOM banner, every mine
    revealed in red).
  - the seat-join part correctly **aborts (exit 3, not a fail)** in this
    worktree with an explicit message that item 3 hasn't landed, rather than
    reporting a false red for a row it doesn't own.
- `node scripts/bugsweep.mjs` against 4181 (built bundle): 93 shots, zero
  STATION MISS, no new console errors.
- `node scripts/world-wired.mjs`: unaffected — 12/12 interiors still build
  (this module is not an `int-*.ts`, so it isn't part of that check's
  population, but running it confirms the room count didn't move).

## A defect I found and fixed in my own draft before it shipped

First draft statically imported `{ makePanel, UI }` from `./hud`. `blackjack.ts`
and `slots.ts` both document why that is wrong for this exact class of module
(GOTCHAS §28): `ct/world.ts` collects modules via an eager glob, and a module
in a *runtime* import cycle with that graph can resolve to an undefined
namespace in the Rollup bundle while working fine in dev — the documented
cause of GOLDEN ACES shipping missing. Switched to the same dynamic
`import('./hud').then(...)` both siblings use, and replaced the one `UI.font`
dependency with a local `font()` helper (matching how `blackjack.ts` inlines
`'bold 8px monospace'` rather than importing the shared one). Caught by
re-reading the sibling modules' own comments before shipping, then confirmed
by testing against the **built** bundle specifically, not just dev.

## Not fixed / found in passing

- The seat join (item 3) is out of scope by the item's own instruction —
  tracked above, nothing further to queue.
- No other files were touched. `int-library.ts` is untouched (verified via
  `git diff --stat`).

## Derivation note

The book catalog is original data — there is no existing list of discrete
book titles anywhere in the tree to derive it from (`int-library.ts`'s
shelves are a painted texture, not structured data; see the comment on
`shelfTex` there). `ORDER = BUILD.INTERIOR + 7` is placed one past
`blackjack.ts`'s `+6`, both a plain sort key.
