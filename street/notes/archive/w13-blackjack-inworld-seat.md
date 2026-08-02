# w13 — item 23: `L-blackjack-inworld.mjs` was calling a door that already had a handle

**Root cause (one line):** the check called `window.__blackjack.open()`
directly with nobody seated, and `27be185fc`'s deliberate "not seated means
not open, no condition on it" tick — the fix for the global `[E]` deadlock
the user hit twice — correctly closed the panel again one frame later,
failing every check downstream; the check was stale, not the world, because
`ct/int-casino.ts` had since registered four real seats carrying
`blackjack.ts`'s own `SEAT_LABEL` and the check never caught up to it.

## The fix

Rewrote the check to sit at the real seat rather than bypass it: find the
seat from `window.__ct.seats()` (matching `SEAT_LABEL`, a citation copy of
`ct/blackjack.ts`'s constant since a script cannot import a TS module the
browser build compiled — `L-blackjack-reachable.mjs` already does the same),
warp to its approach point, press E, and let sitting open the table. Same
pattern `L-slots-inworld.mjs` uses for the slots.

Also added the check item 23 explicitly asked for: a force-stand via
`window.__ct.stand()`, which never touches the panel's own Escape handler,
must still close the table on its own. Every OTHER check in the file (the
initial sit, the money-mode ESC) stands up *through* the panel, so none of
them can exercise `27be185fc`'s actual rule. This one does, and it is what
"proved the trap has not returned" means here — verified green, both before
and after rebuying/redealing around it.

## Verified, my own

- All three modes (`all`, `keys`, `money`) green on dev (`:4198`) **and** the
  built preview bundle (`:4197`, rebuilt from the same commit).
- `L-blackjack-reachable.mjs` re-run and still fully green, unchanged by
  this fix (it does not touch that file) — 30/30 checks including the
  4-seats-carry-the-label assertion this fix now relies on.
- `npx tsc --noEmit` clean (the file is `.mjs`, not typechecked, but the
  build that serves the world it drives is).

## Not fixed, and precisely where

**`notes/BLOCKED-L.md` and `ct/blackjack.ts`'s own `SEAT_LABEL` doc
comment** (the block starting "THE SEAT THIS OPENS AT, and the reason it is
not wired yet") **are both stale.** They say the felt table has no seats and
a player cannot reach the game by sitting down. That was true when they were
written; `ct/int-casino.ts` closed it (four seats at `(TX, TZ) = (-2.6,
-13.0)` carrying `BLACKJACK_SEAT`, confirmed live via `window.__ct.seats()`
and by `L-blackjack-reachable.mjs` staying green). `BLOCKED-L.md`'s own
text says exactly this: *"if you read this and the table has seats, it is
closed."* It has seats. I did not edit either file — item 23 named only
`scripts/L-blackjack-inworld.mjs`, and both of those are outside it
(`ct/blackjack.ts` in particular is a live, heavily-commented file I do not
own). Flagging precisely so the desk can queue a one-line close on
`BLOCKED-L.md` and a comment update in `blackjack.ts` for whoever holds that
file.

## Derived, not copied

`BJ_LABEL = 'sit at the blackjack table'` is a citation copy of
`ct/blackjack.ts`'s exported `SEAT_LABEL` — cited because a `.mjs` Playwright
script cannot import a TypeScript module the Vite build compiled, and
`L-blackjack-reachable.mjs` already carries the identical citation for the
identical reason; a third re-derivation would only add a third place for the
string to drift from the other two.
