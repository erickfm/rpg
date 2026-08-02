# w9 — item 0b: interaction reach far too wide (fp.ts)

## Verdict: the item's literal diagnosis was stale; the underlying bug was real and is now fixed

**Root cause, in one line:** `pickSpot`'s comment claims "NEAR BEATS LOOKED,
ALWAYS", but the code computed a single combined key `offAxis + d * 0.02` for
every candidate — so a touching-but-facing-away spot (large `offAxis`) could
still lose to a merely-aimed-at spot across the room (small `offAxis`), which
is exactly the reported bug seen from the door's side: standing in the
doorway looking into the room, the bed (aimed at) beat the door (touched, but
behind you).

## Part (a) of the item — REACH_MARGIN=0.6 — was ALREADY FIXED, before this item was even queued

The item's own measurement ("`fp.ts:463` adds `REACH_MARGIN = 0.6` to every
spot, so it is live to 1.3 m") is stale. `git log` shows commit `b1707b600`
("Selection width, the other half: aim-free proximity only for what you
touch", 26 Jul) already replaced the aim-free-proximity margin with
`TOUCH_MARGIN = 0.15` — a quarter of the old slack — for this exact user
complaint. The item was queued on `ebfdcb773` (1 Aug), five days *after* that
fix landed, apparently from a grep of the `REACH_MARGIN` name (which still
exists — it survives as the debug-ring radius at `fp.ts:695` and in a lot of
comments/citations in `int-hotel.ts`, `int-jail.ts`, `int-casino.ts`) rather
than from live measurement. `REACH_MARGIN` plays **no role in the actual
near-test today** — confirmed by reading `pickSpot` end to end.

So: the "bed reaches you at 1.3 m" claim does not reproduce on this checkout.
The bed's real aim-free touch radius is `0.7 + 0.15 = 0.85 m`. Beyond that it
requires being aimed at (via `lookTolerance`), same as everything else.

## Part (b) — "a door you are standing in should beat furniture across the room" — was real, reproduced, and is now fixed

`scripts/w9-reach-repro.mjs` (kept) isolates it: warp to the apartment door's
own stand-point (d=0.00, touching, `r=0.95`), face the bed's coordinate
(aimed-at, `r=0.7`, ~9 m away by straight-line but irrelevant — the offAxis
term dominated). Before the fix: `[E] sit on the bed and watch TV`. After:
`[E] close the door`.

**Fix:** `src/proto/fp.ts`, `pickSpot()`. Split into two tiers instead of one
combined key: `near` (touching) candidates are ranked by distance only and
unconditionally beat any `looked`-only candidate; `looked` candidates keep
the old screen-centre-first ordering when nothing is near. This is exactly
what the pre-existing comment already claimed the code did — the comment was
correct in intent, the implementation just never enforced it.

## Verification

- `npx tsc --noEmit` — clean.
- `scripts/w9-reach-repro.mjs` — FAILs on stashed (pre-fix) code, PASSes with
  the fix. Confirmed both ways with `git stash` / `git stash pop`.
- `scripts/D-look-selects.mjs` — 12 pass, 0 fail, 1 skip (pre-existing skip:
  "enter No. 227" line never clear in sampling — unrelated to this file).
- `scripts/A-verify-301-door.mjs` — both room-side and hall-side door
  interactions still work (open/close from either side).
- `scripts/D-confirmed-prompts.mjs` — 15/15 pass, every CONFIRMED-row prompt
  this rests on still fires.
- `scripts/bugsweep.mjs` — 93 shots, zero STATION MISS, zero console errors
  (only pre-existing benign warnings: THREE.Clock deprecation, Canvas2D
  readback perf hints, one GPU-stall driver message).
- `scripts/seats-walk.mjs` — **ran both ways for comparison, not as a gate**:
  baseline (pre-fix, stashed) 35/238 pass; with the fix 56/238 pass. My change
  is a net improvement, not a regression — a touched-but-facing-away seat
  used to occasionally lose to something better-aimed nearby, same bug class.
  **The remaining ~182 failures are pre-existing and NOT investigated here** —
  they are out of scope for item 0b (a different question: whether seats can
  be reached/locked/exited correctly, not whether the right thing is
  selected when several things compete). Whoever owns seat mechanics should
  treat that count as a fresh finding, not evidence against this fix — I did
  not have time to classify how many of the 182 are stale-instrument vs real.

## Found but not fixed

- `int-hotel.ts:176`, `int-jail.ts:122`, `int-casino.ts:257` still cite
  `REACH_MARGIN = 0.6` in their own landing-clearance comments/math (e.g. "a
  spot is live out to 1.65 m, so step out 2.05 m to clear it"). Since the
  real aim-free touch margin is now `TOUCH_MARGIN = 0.15`, those clearances
  are almost certainly more generous than necessary today — not wrong, just
  stale citations of a fact that changed 26 Jul. Not touched: those files are
  not named by this item, and the clearances being *too* generous is not a
  bug, just derived-value rot per BUILDER-BRIEF §8. Worth a follow-up row if
  the desk wants those tightened back up.
- `seats-walk.mjs`'s 182 pre-existing failures (mix of "sit in the pew",
  "sit at the counter", "sit at the terminal", etc. — "E did not seat you").
  Not investigated; flagging so it is not read as new breakage from this
  item.

## Derivation

Both `TOUCH_MARGIN` and the tier logic are read from the source, not
retyped from memory — the fix reuses the existing `near`/`looked` booleans
already computed in the loop, adding only the two-bucket bookkeeping.
