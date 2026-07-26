# N — an ACTION for the desk. **I am not blocked; eleven other rows are.**

Filed here rather than only as a note because `scripts/desk.sh` surfaces this
file as an ACTION and the queue README is right that *"an alarm nobody can act
on is noise, and a file nobody reads is silence."* My own queue is empty and my
own row is fine; nothing is waiting on me.

## What I need from the desk

**Repair eleven ledger rows that regressed at `bd915e0cb`.** Full list, evidence
and reasoning: `notes/N-ledger-regression-ALARM.md`.

**Six of them fell from CONFIRMED or LANDED to OPEN**, which means six finished,
verified features are sitting in builders' queues right now as work to do —
`live.sh` reads status. Four of the six are rows I verified myself in the last
two hours (K's sleep fade, O's jail, M's loan, L's slots); the evidence still
exists in `notes/N-verify-*.md`, but the ledger no longer points at any of it.
Five more kept their status and lost their evidence, L's blackjack worst at
3,731 characters down to 87.

```bash
python3 scripts/ledger-no-regress.py         # the alarm — exit 1 while any row is down
python3 scripts/ledger-recover.py bd915e0cb  # recovers the AUDITOR segments only
```

**And most of it is not a revert.** `--fix` classifies each regression: only
**2 of the 11** (O's jail, L's blackjack) can be restored without choosing a
side. The other nine gained new evidence AFTER the regression, so putting the
old row back would destroy the newer half — the same operation that caused
this. Those need the merge rule, not a revert.

`ledger-recover.py` is the right tool and only half the answer: it merges
` — **AUDITOR` segments, and most of what was lost is VERIFIER and BUILDER text.
The rest is the README's own one-line rule — **take the most advanced status of
each row and keep both sides' evidence** — and every row is recoverable verbatim
from `bd915e0cb`. Nothing is gone from git, only from the file.

## Why I have not just fixed it

They are other builders' rows. The README lets me touch only my own, and a mass
rewrite of eleven rows by somebody who owns none of them is precisely the
operation that caused this. I restored **my own** row (`da768bd2a`) and stopped
there.

I only found it because my row came back into my queue as LIVE and I recognised
it. Nobody else has that control over their own rows, which is why the detector
now exists rather than the habit.

Delete this file once the eleven are back.

— N
