# w28 — item 52: claim.sh now checks that the item's files are really there

**Root cause, one line:** the queue's `file(s)` column was never checked against
anything, so a stale path cost a builder a whole claim to discover — nothing
about a wrong path looks wrong until you go looking for the file.

I hit this twice today before drawing the item, which is why the wording below
is specific rather than general.

## What it does

Straight after the row is marked `DOING`, `claim.sh` resolves every path the
`file(s)` column names against the tree the builder is actually standing in, and
prints one of four things per token:

```
  ok        ct/cars.ts  ->  src/proto/ct/cars.ts

  MISSING   scripts/L-games-in-artifact.mjs
            The item's PATH is stale. A file of that name is at:
              scripts/probes/L-games-in-artifact.mjs

  MISSING   ct/bodega.ts
            No file of that NAME exists. Did the item mean one of:
              src/proto/ct/bodega-corner.ts
              src/proto/ct/int-bodega.ts

  MISSING   ct/whatever.ts
            It IS in the main tree but not in yours — your worktree is BEHIND.
            Fix: git reset --hard add-stick-and-city98 && (cd street && npm install)
```

Four verdicts and not one, because **the fix is different in each case** — and
the last is the specific failure the item names: *"the desk ranking against
mainline while the builder held a snapshot"*, 2 of the 3 wasted claims.

**It is advisory and never fails the claim.** By the time it runs the row is
already `DOING`; exiting non-zero would strand it with nobody told to pick it
up. The closing text says so, and points at BUILDER-BRIEF §6a: handing an
impossible item back is a success.

## The hard part was NOT firing on good rows

A warning that fires every time is one nobody reads, and this project has a
documented family of guards that slept for exactly that reason (GOTCHAS §58).
Two properties of the column make a naive check useless:

**It is prose, not a path list.** Real rows:
`crosstown.ts:1125 (canSee) + groundPick`,
`ct/cars.ts + crosstown.ts + fp.ts (read-only)`,
`crosstown.ts (__ct) + the script that hand-types it`.
So parentheticals are dropped, `+` and `,` separate, a trailing `:1125` is
stripped, and prose without a file extension is ignored.

**It uses short names.** `ct/cars.ts` is really `src/proto/ct/cars.ts`;
`crosstown.ts` is `src/proto/crosstown.ts`; `fp.ts` is `src/proto/fp.ts`.
Demanding exact paths would warn on nearly every row. So a token resolves if any
real path **ends with** it, anchored at a `/` so `cars.ts` cannot match
`supercars.ts`. That accepts every short name the queue uses today and still
rejects `scripts/L-games-in-artifact.mjs`, because no path ends with that.

One rule earned its place the hard way: **a known extension, not merely "has a
dot".** `\.[A-Za-z0-9]+$` matched the prose `process.exit` and `r.status` and
they were two of the three warnings on the first full sweep.

## Proof

**Swept over all 21 rows the live queue has ever held**
(`scripts/probes/w28-queue-paths.mjs`, read-only): **2 warned, 19 silent, and
both warnings are true positives.**

| row | state | names | verdict |
|---|---|---|---|
| 51 | DONE | `scripts/L-games-in-artifact.mjs` | the file is in `scripts/probes/` — I proved this today |
| 36 | **DOING** | `ct/bodega.ts` | **no such file**; there is `bodega-corner.ts` and `int-bodega.ts` |

Zero false positives, including on the 15 DONE rows builders actually completed
— which is the right control group, because a warning against a row somebody
finished is the check being wrong.

**Item 36 is a live catch.** A builder is holding it right now against a file
that does not exist. That is the item's own premise happening while it was being
fixed.

`scripts/probes/w28-claim-selftest.sh` — **11/11**. It runs a real claim, lock
and all, against a scratch queue with four deliberately-broken rows, via the new
`CLAIM_QUEUE` test hook, so the live queue three other builders are claiming
from is never touched (and one of the eleven checks asserts exactly that).

**Mutation-tested twice, and the second one paid for itself:**

1. Disable the call site → **7 FAIL**, exit 1. Bytes 19,635 → 19,645.
2. Make the resolver match on **basename** instead of the anchored suffix → **3
   FAIL**, exit 1. Bytes 19,635 → 19,641. This is the subtle one: it would
   silently "resolve" item 51's stale path and the check would sleep on the
   exact defect it exists for.

Mutation 2 initially produced only 2 FAIL, because one of my assertions grepped
for the resolved path anywhere in the output — and under that mutation the path
appears in an `ok … -> …` line. **The assertion was being satisfied by the check
sleeping.** It now requires the path to appear *within* the `PATH is stale`
block, and catches it.

## Derived or copied?

Derived. The lock path is now `$(dirname "$Q")/.queue.lock` so it moves with
`CLAIM_QUEUE` — with the hook unset it resolves to `$SHARED/.queue.lock`, byte
for byte what it was, which is what `done.sh:28` independently computes. A test
run cannot take the real queue's lock and stall the fleet.

## Found and NOT fixed

1. **Item 36 (DOING) names `ct/bodega.ts`, which does not exist.** Whoever holds
   it should be told now rather than at the end of their claim. Best guesses
   from the name: `src/proto/ct/bodega-corner.ts` or `src/proto/ct/int-bodega.ts`.
2. **Item 39's `file(s)` column is not a file column at all** — the row's text
   contains a literal `|` inside a shell snippet, which shifts every field after
   it. The extension whitelist makes this harmless (it produces no tokens), but
   the queue's own format is being broken by unescaped pipes and `--stale`,
   `--release` and the reaper all parse with the same assumption.
3. **`scripts/checks.mjs:857` still prints the wrong path for
   `L-games-in-artifact.mjs`** — third report (w25 twice, me once). It is the
   source the queue copied item 51's wrong path from, so fixing the comment
   would stop this recurring. One line, in a file no item names.
4. **The check reads the tree, not the item's intent.** Item 47 named
   `ct/cars.ts`, which exists — and every line of that work was in
   `crosstown.ts`. This check says nothing about that and should not be trusted
   to. It only proves the work can begin.
