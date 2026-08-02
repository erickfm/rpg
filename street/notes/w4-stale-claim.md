# w4 — item 9d, "a stale claim blocks an item forever" — FIXED

## Root cause (one line)
`claim.sh` stamped every `DOING` row with a holder and a time but never read
either back — it only ever asked "is there a TODO row", so a claim whose
holder had stopped (item 9's `DOING w1` after the desk stopped w1) was
permanently indistinguishable from active work: nothing could take the item
and nothing could even SAY it was stuck.

## What I did
Added two new modes to `scripts/claim.sh` (same file the item names),
alongside the existing `claim.sh <name>`:

- `claim.sh --stale [threshold-minutes]` — read-only. Lists every `DOING`
  row with its age in minutes (parsed from the existing `HH:MM` stamp),
  flagging anything at or past the threshold (default 90) as `STALE`. Never
  writes the queue, so running it cannot itself create the problem it
  reports on.
- `claim.sh --release <item-id> [your-name]` — force a specific item back to
  `TODO` regardless of who holds it. Deliberately a different shape from
  `done.sh` (which only releases the item its OWN caller holds, by name
  match) — this is explicitly for the case the holder cannot release it
  itself, so it addresses the item by id.

Both take the same `mkdir` lock the existing claim/release path uses, so
they cannot race a concurrent claim/done.

## A bug I found in my own first version, and how I caught it
My first cut computed "now" via `date '+%s'` (UTC epoch seconds) and
compared it against the stamp's LOCAL `date '+%H:%M'`. Sandbox-tested before
trusting it (a stale-vs-fresh pair, one stamped ~2h ago, one ~5 min ago): the
5-minute-old claim reported as **425 minutes** stale. Root cause: my local
timezone offset from UTC, applied once by mixing clocks. Fixed by reading
"now" the identical way the stamp itself was written (`date '+%H:%M'`,
local), which removes the timezone from the comparison entirely rather than
getting the offset right by hand. Re-tested after the fix: the same pair
read 121m (correctly flagged, threshold 90) and 6m (correctly not).

**A second, smaller bug in the same first cut**: `$((10#$hh * 60 + ...))`
— the `10#` radix-forcing prefix does not exist in POSIX arithmetic and
`dash` (this box's `/bin/sh`) hard-errors on it; separately, a bare
`$((08))` is ALSO an error in POSIX arithmetic (leading zero reads as
invalid octal). Both caught by actually running it in `dash`, not just
`bash` — `#!/bin/sh` on this box is `dash`, and `sh -c` reproduced the exact
same error, so this would have broken for every builder, not just me. Fixed
with plain POSIX parameter expansion, `${hh#0}`, which strips one leading
zero (a fully portable primitive with no arithmetic-mode surprises).

## Verification
- **Sandboxed, not against the live shared queue**, same discipline as the
  earlier lettered-rank fix: a scratch git repo with its own `QUEUE.md`
  (one stale `DOING` row, one fresh one, one `TODO`), so nothing here could
  touch a real builder's live claim while testing.
- `--stale` with the default and a lowered threshold: correctly flags only
  the row past the threshold, correctly ages the fresh one without flagging
  it, correctly reports "no DOING rows" against an empty population
  (GOTCHAS §34 — an absence check needs a floor, and this one has an
  explicit early-exit for zero rows rather than silently printing nothing).
- `--release`: releases the named item and only that one (the other `DOING`
  row, untouched, verified against the file after); rejects a non-existent
  item id and a `TODO`-not-`DOING` item without touching the file, exit 1
  both times; a freshly-released item is immediately claimable again by a
  new name; releasing an item that is CURRENTLY held (not just
  desk-stopped) also works, since the item's own repro is exactly "the
  holder cannot act, something else has to."
- Confirmed `done.sh` is untouched and still works normally on an unrelated
  row after `--release` ran.
- `sh -n` and `dash -n` both syntax-clean.
- Ran `--stale` (read-only) against the REAL live shared queue as a final
  sanity check once the sandbox testing passed: reported two currently-held
  items at 5m and 29m, neither past the 90m default — consistent with two
  builders actively working, not stale.

## What I did NOT do
Did not touch the SEPARATE staleness mechanism this file already has for
its own `mkdir` LOCK directory (a dead holder of `.queue.lock` itself, not a
dead holder of a queue ITEM) — that already has a 60-second timeout and
take-over, unrelated to what item 9d asks for. Did not add a stamp format
change (e.g. a full date, not just `HH:MM`) to remove the same-day
assumption entirely — noted as a real but small limitation in the script's
own comment; the failure mode is under-reporting age past 24h, never
over-reporting, so it was not worth the wider format change this item does
not ask for.
