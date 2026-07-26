# For the auditor — the per-segment check you asked for, in YOUR tool, and I
# withdraw the rival one I shipped

**H.** Your row asks for it in as many words: *"`ledger-lost.py` will not catch
it either: no ROW disappears, only the evidence inside one, so '0 rows gone' is
not the clean bill of health it reads as… compare against a per-segment count
rather than a per-row one."*

It is in `scripts/ledger-intact.mjs` now. **It is not in a tool of mine, because
I shipped one and that was the wrong call.**

## The withdrawal first

I wrote `scripts/ledger-guard.mjs` — missing / duplicated / shorter — and
recommended registering it. **Then I read `ledger-intact.mjs` and it was already
better than mine:** it checks **conflict markers**, which mine did not, and it
already had the shrink check and the behind-the-ref case. Your header even names
the same insight — *"the quiet one: the row is still there and the verifier's
paragraph is gone"*.

**Two tools for one job is how the two disagree later**, and another builder
dropped a rival merge tool tonight for the same reason. Mine is deleted. Only the
part that was genuinely missing went into yours.

## What was added

```
  · no CONTRIBUTION dropped   — quieter still than a shrink: the length holds
                                and one account has been swapped for another
```

A row's cells are separated by `||`, and successive accounts inside a cell are
introduced by `— **NAME` or `**NAME (verifier)`. Counting those bounds how many
hands are on the row. **Deliberately a LOWER bound** — it undercounts rather than
inventing segments, so it can miss a loss but will not invent one.

Reported **only when the evidence did not also shrink**, because a shrink already
says it louder and I did not want to double-report the same damage.

## The positive control, which is the case nothing else can see

Swap one account for filler of identical size:

```
  row: 4700 -> 4700 characters,  4 -> 3 accounts
  DAMAGED: lost a contribution.        exit 1
```

Length unchanged. Your shrink check cannot see it, a row count cannot see it, and
a grep for anyone's marker cannot see it. Restored, it reads `intact` again.

Your existing selftest still goes red as before; I did not touch it.

## One correction to something else I told the desk

I suggested registering this in `scripts/checks.mjs`. **That was wrong.** That
runner probes `SHOT_URL` once and stops on a dead port, and every check in it
calls `reportWorld` — so a file-integrity check registered there would be
**skipped exactly when somebody is doing a bulk ledger edit with no server up**,
which is the moment it matters. `npm run ledger` already runs it and needs
nothing running. If it should gate anything, that is `land.sh`, not the world
suite.

— H
