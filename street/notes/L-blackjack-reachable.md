# Blackjack is reachable: sitting at the felt table opens it

The user asked for this over a session ago — *"i would like a black jack
interface. very nice and impressive and try hard"* — and `ct/blackjack.ts` has
been complete, checked and unreachable since: it was built against a seat
label that no stool in the world carried.

## The fault

`ct/blackjack.ts:1183` declares `export const SEAT_LABEL = 'sit at the
blackjack table'` and `seatedAtTable()` (line 1188) opens the panel only when
the seat the player is sitting on has exactly that label. `int-casino.ts`'s
`gameStool()` helper hard-coded `label: 'sit at the table'` for every table it
drew — roulette (5 stools), craps (6), poker (6) — and the felt table at
`(TX, TZ) = (-2.6, -13.0)`, the one with a dealer already standing at it,
registered **no seats at all**. Blackjack's own docstring already named this
table and this exact fix; `notes/BLOCKED-L.md` was the ask that never got
picked up.

## The fix

Two changes, both in `int-casino.ts`, both inside my file:

1. **Import `SEAT_LABEL` from `./blackjack`** rather than retyping the
   string — the two-authorings problem this project keeps hitting (GOTCHAS
   §44's family). No import cycle: `blackjack.ts` imports only `./ctx` and,
   dynamically, `./hud` and `./slots`; it never imports `int-casino.ts`.
2. **`gameStool()` now takes an optional `label` parameter**, defaulting to
   `'sit at the table'` — so roulette, craps and poker are unchanged — and
   **four new stools at the felt table**, on the `+z` side (away from the
   dealer, who stands at `TZ - 0.95`), passing the blackjack label:

   ```ts
   for (const dx of [-0.55, -0.18, 0.18, 0.55]) {
     gameStool(TX + dx, TZ + 0.85, 0, BLACKJACK_SEAT);
   }
   ```

   `yaw: 0` is the camera convention (`Seat`'s own docstring: `0 = -z`), and
   `TZ - 13.0` is more negative than the seats' `z`, so facing `0` faces the
   table and the dealer beyond it — confirmed by `int-library.ts`'s own
   identical comment on its reading-table seats (`"camera yaw 0 looks along
   -z, into the room"`). The seats sit at `z = TZ + 0.85`, clear of the
   table's own `1.9 x 1.2` collider (which ends at `TZ + 0.6`) by 0.25 m; the
   default approach point the helper computes for `yaw = 0` lands a further
   0.8 m out, in the open floor between the felt and the pit rope — not
   inside the table.

No other stool's label changed. Roulette, craps and poker still publish
`'sit at the table'`, unmodified.

## Played it — the sequence and what `__blackjack.view()` returned

Driven with Playwright against my own dev server on port 4180, then again
against `npx vite preview` on the actual **built bundle** (GOTCHAS §37/§28 —
a static import can behave differently in dev vs. the Rollup output; this one
doesn't, but I checked rather than assumed). Script:
`street/scripts/L-blackjack-reachable.mjs`.

```
seat labels in the world: {..., "sit at the blackjack table":4, "sit at the table":21, ...}
  (21 = 17 casino [roulette 5 + craps 6 + poker 6] + 4 unrelated int-library.ts reading-table seats)

found the seat's world pose: {"x":676.85,"z":-12.15,"yaw":0,"atX":676.85,"atZ":-11.35}
approached the seat, prompt: "[E] sit at the blackjack table"
E sits the player down
sitting on the seat opens the blackjack panel

view() at open:
  {"phase":"betting","chips":0,...,"says":"BUY IN TO PLAY",...}

buyIn(200) -> view():
  {"phase":"betting","chips":200,...,"says":"PLACE YOUR BET",...}

SPACE (deal) -> view():
  {"phase":"dealing","chips":198,"hands":[{"cards":[...1 card...]}],...}

... dealt out, offered a move ("moves":["hit","stand"]) ...
H (hit) -> view():
  {"phase":"player","hands":[{"cards":[...3 cards...],"value":{"total":11}}],
   "moves":["hit","stand"],"says":"YOUR MOVE",...}
S (stand) -> hand settles, phase returns to "betting"

  (one run's hand resolved to a dealer bust on its own after H — "moves": []
  and phase left "player" straight to settle — the natural-resolution path
  L-blackjack-inworld.mjs already exercises; both are real outcomes of the
  same table, not two different code paths)

stood up: rail 198 chips -> wallet $14.50 -> $64.00
  (198 * $0.25 = $49.50, matches exactly)
Escape closes the panel
seated() is null afterward
held W after standing: moved 0.66 m — the world is not frozen
```

**The modal trap, proved rather than assumed** (per the task brief and
`notes/C-modal-traps-URGENT.md`): Escape closes the panel while seated,
`__ct.seated()` reports `null` immediately after, and the player can walk
again. There is no state in which the panel is up and both Escape and the
stand path fail to close it.

## The negative control

Warped to the first three of the casino's own 17 `'sit at the table'` stools
(filtered to the casino's own world-x cluster, `x < 1000`, since
`int-library.ts` reuses the exact same label string for its reading table —
found this only by dumping `__ct.seats()` and checking, not by assumption).
Sat at each one (`seated()` returns a real pose) and confirmed
`__hud.panel()` is never `'ct-blackjack'` at any of them:

```
stool 0: prompt "[E] sit at the table"  sat -> panel null
stool 1: prompt "[E] sit at the table"  sat -> panel null
stool 2: prompt "[E] sit at the table"  sat -> panel null
```

Also re-ran `scripts/L-blackjack-inworld.mjs` (the existing machinery check —
open/close, freeze, keys through the HUD gate, the one-wallet accounting) and
`scripts/L-slots-inworld.mjs` (slots' own seat-opens-the-game path, 96
stools) — both fully green, confirming the slot machine and the shared panel
framework are unaffected.

## A test bug worth writing down, not a world bug

The first run of my own check script reported 2 false failures in the
negative control: warping to a stool's approach point and pressing E once
sometimes did nothing, while an *identical* press moments later (the script's
own "stand back up for the next iteration" logic, since the player wasn't
actually seated) landed correctly at that same seat. This is flaky key
delivery right after a warp, not a reachability fault — the same coordinate
and the same key reliably seats the player on a retry, every time, including
against the built bundle. Fixed by retrying the press up to 3 times and
polling `seated()` rather than a fixed sleep (GOTCHAS §30). Worth knowing if
anyone else writes a seat-walk script that presses E exactly once after a
warp.

## Files touched

- `street/src/proto/ct/int-casino.ts` — the fix (import + `gameStool` label
  parameter + four blackjack seats)
- `street/scripts/L-blackjack-reachable.mjs` — new verification script (kept;
  named for its claim per GOTCHAS §24)

Nothing else under `street/src/` touched. `street/src/proto/ct/blackjack.ts`
needed no change — `SEAT_LABEL` was already exported and already correct; the
fault was entirely on the casino side.
