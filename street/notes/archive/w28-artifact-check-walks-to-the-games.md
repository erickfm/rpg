# w28 — the artifact check now walks to each game and sits down

Queue item 51. Port **4180** (proved free with `curl` → `000` before use, and
shut down at the end). File: `scripts/probes/L-games-in-artifact.mjs` — note
that this is where it actually lives; the item, and `scripts/checks.mjs:857`,
both cite it as `scripts/L-games-in-artifact.mjs`, which does not exist.

## Root cause, one line

`L-games-in-artifact.mjs` drove both casino games from `__slots.open()` /
`__blackjack.open()` — the module's API, not the way a player reaches the game —
so a game whose stool no longer seats you passed it green and would have shipped
unplayable.

## The item's premise was right, and I reproduced it

Not taken on faith. I removed the blackjack seat **at source** —
`int-casino.ts:1272`, `gameStool(TX + dx, TZ + 0.85, 0, BLACKJACK_SEAT)` →
`gameStool(TX + dx, TZ + 0.85, 0)`, so the four felt-table stools fall back to
the shared `'sit at the table'` and GOLDEN ACES has no seat of its own anywhere
in the world — then `npm run build && node scripts/pack-artifact.mjs` and ran
**the old check** against the resulting artifact:

```
OK    the blackjack table kept its rules through the pack
OK    the blackjack table deals a hand in the artifact (phase dealing)
  all checks pass — both games ship.                              exit 0
```

The artifact bytes moved (1,116,797 → 1,116,795), so that is a real, rebuilt,
repacked world with a missing seat being certified as shipping. That is exactly
the regression the item names, and it is the one that has already shipped here:
this same felt table registered no seat for weeks, and `open()` was the only way
in. The mutation is reverted (`git checkout -- src/proto/ct/int-casino.ts`); no
`src/` file is changed by this item.

## What the check does now

Per game, driven off a `GAMES` table so a third game is a few lines:

1. **The seat label is read out of the owning module's own source** —
   `slots.ts:1247` (`SLOT_SEAT_LABEL`) and `blackjack.ts:1198` (`SEAT_LABEL`) —
   by regex over the declaration, and the check **aborts (exit 3) rather than
   guessing** if the declaration is not there. BUILDER-BRIEF §8: a `.mjs` cannot
   import a `.ts`, so this is the honest form of "derive, never retype". It
   buys a second thing for free: change a label without repacking and the
   artifact publishes no seat under the new string, which is correctly red,
   because the file the user opens is then stale.
2. The player is stood **1.0 m behind that seat's own published approach point**,
   facing it. The facing is derived from the pose→approach geometry, **not from
   `pose.yaw`** — reading the yaw would make the instrument inherit the very
   fault this bug class is made of (96 stools once sat you looking at the far
   wall because that yaw was written the other way round).
   `int-casino.ts:1203` puts the approach at `seat − facing·0.8` and
   `facing = (sin yaw, −cos yaw)`, so `facing = normalize(pose − at)` and
   `yaw = atan2(−dx/len, dz/len)`.
3. **W is held until the player stops closing on the stool**, not until the
   prompt appears — see the numbers below. Both the distance covered (≥ 0.5 m)
   and the distance left to the stool (≤ 0.5 m) are verdicts.
4. `[E]` is **held** (BUILDER-BRIEF §5), and the player must end up seated **on a
   seat carrying that game's label**, read back from `__ct.seats()`, with that
   game's own panel id up. The label check is load-bearing: the same casino
   floor carries 21 other stools two metres away labelled `'sit at the table'`
   (roulette, craps, poker), and a walk that drifted onto one of those would
   otherwise read as a clean pass.
5. The game is then played **from the seat** (spin / deal), Escape must close the
   panel, and the player must get back up — BUILDER-BRIEF §11.

The RTP / rules / no-console-errors verdicts from the `open()` era are kept
unchanged. They check something sitting down cannot see: a tree-shake that drops
a strip or a pay row leaves a machine that runs and pays the wrong amount.

## Two things I measured that changed the design

`scripts/probes/w28-walk-to-seat.mjs` (committed) is where these came from.

**The prompt is up before you have walked anywhere.** The trigger radius is over
a metre, so stopping the walk on the offer gave a **0.10 m** "walk" for
blackjack and 0.31 m for the slots. A check that walks 10 cm is not walking. Held
to arrival instead, the real figures over four runs are **1.14–1.75 m** (SEVENS)
and **1.65–1.69 m** (GOLDEN ACES), ending **0.00–0.15 m** from the stool aimed
at. `MIN_WALK = 0.5` therefore has 2–3× margin.

**There is only 0.42 m of clear floor behind a slot stool's approach point.**
Ask for a 1.0 m set-back and the world settles you at the same z = 7.01 either
way. Worse, at **1.5 m you are on the far side of the machine row behind**: the
player cannot get through, walks in on a different stool two rows away — and the
prompt still says `'sit at the slot'`, so that run would have passed. That is
the second reason the walk stops on arriving at *this* seat and not on the
prompt, and why the set-back is 1.0 and not larger.

| back | slot settles | walks to | blackjack settles | walks to |
|---|---|---|---|---|
| 0.6 | 7.01 (shoved 0.18) | 8.13 | −10.75 (no shove) | −12.03 |
| 1.0 | 7.01 (shoved 0.58) | 8.17 | −10.35 (no shove) | −12.04 |
| 1.5 | 5.04 (shoved 0.89) | 4.99 ✗ | −9.85 (no shove) | −12.02 |

## Proof

`--selftest`, against `dist/artifact.html` on 4180: **6 / 6 CAUGHT.**

```
CAUGHT  slots-gone         exit=1 fails=1
CAUGHT  blackjack-gone     exit=1 fails=1
CAUGHT  no-slot-seat       exit=1 fails=1     ← the item's DONE WHEN
CAUGHT  no-blackjack-seat  exit=1 fails=1     ← the item's DONE WHEN
CAUGHT  never-seats        exit=1 fails=6
CAUGHT  wrong-build        exit=3 (must be 3)
```

Plus the source-level removal above, which is the stronger form of the same
thing — bytes changed, artifact repacked, check red:

```
FAIL  the blackjack table publishes at least one seat under its own
      'sit at the blackjack table' (0 found)
  1 FAILED.                                                       exit 1
```

**A missing seat is a FAIL, not an abort**, deliberately, and that is the one
place I moved the exit-code line. A world that publishes no stool for a shipped
game has been *measured*, and it is wrong; aborting there would have made the
DONE WHEN unsatisfiable. GOTCHAS §34 is still respected — the population is
asserted before anything downstream of it, and the rest of that game is skipped
rather than passing for free.

Clean run: 23 OK, 0 FAIL, exit 0, stable over four consecutive runs.
`node scripts/bugsweep.mjs` against 4180: exit 0, **zero STATION MISS**, no new
console errors (only the pre-existing Canvas2D `willReadFrequently` and WebGL
`GPU stall due to ReadPixels` warnings).

No `fp before/after` was run and none is needed: nothing outside
`scripts/probes/` is changed, so the world cannot have moved.

## One trap, recorded because it nearly shipped green

The first selftest **SLEPT on `slots-gone` and `blackjack-gone`**. The check was
asserting the state `waitForFunction` had observed — which is by construction
from *before* the mutation landed — so deleting a station left the verdict green
and the run then died on the next `evaluate()`: exit 1 with **no FAIL line**,
which the selftest correctly refuses to count as a catch. Anything mutated at
runtime must be **re-read after the mutation**, never inherited from the wait
that preceded it.

## Found and NOT fixed — for the desk to queue

1. **`scripts/checks.mjs:857` still cites this file at the wrong path.** Its
   runnable recipe says `node scripts/L-games-in-artifact.mjs`; the file is at
   `scripts/probes/L-games-in-artifact.mjs`, so copy-pasting it fails. w25
   reported this twice (`notes/w25-artifact-repack.md`,
   `notes/w25-jump-apex-and-kerb-gy.md`) and it is still there — and it has now
   propagated into the wording of queue item 51 itself. A one-line comment fix
   in a file item 51 does not name, so I have not touched it (BUILDER-BRIEF §9).
2. **`slots.ts:1170`-ish docstrings say 96 slot stools; the world publishes 87.**
   Measured with `scripts/probes/w28-seat-census.mjs` against the artifact.
   `blackjack.ts:1169` repeats the 96. Stale comments only, no behaviour.
3. **`probes/w25-sit-in-artifact.mjs:173,223` call `window.__ct.pos().gy`, and
   `pos()` returns an ARRAY** (`crosstown.ts`: `[x, y, z, gy]`) — so that
   expression is always `undefined` and the `?? 0` silently warps to ground
   level. It happens to be right for the casino and would be wrong for anything
   upstairs. The new check passes `undefined` for `gy` instead, which leaves the
   current floor alone. Not fixed: it is w25's probe and not named by item 51.
   This is the same shape as the `L-slots-inworld.mjs:285` comment warning about
   exactly this array-vs-object mistake.
4. **`probes/w25-sit-in-artifact.mjs` is now largely subsumed** by this check —
   it does the slots half and nothing else. Worth deleting or reducing, but that
   is a call for the desk, not a silent removal.

## Files

- `scripts/probes/L-games-in-artifact.mjs` — rewritten (the item)
- `scripts/probes/w28-walk-to-seat.mjs` — where the set-back and reach numbers
  came from; kept because the note above is worth much less without it
- `scripts/probes/w28-seat-census.mjs` — seat labels and counts in a given build
