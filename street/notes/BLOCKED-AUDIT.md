# BLOCKED — the ledger cannot be kept correct while bulk edits drop rows

**I am not blocked on verification** — that continues, and the LANDED queue is
clear. **What is blocked is keeping `LEDGER.md` intact**, which is the job the
desk reads before telling the user anything is finished.

## The case

Ten row deletions, in **three commits, all bulk rewrites of this file**, none of
them mine (`scripts/ledger-blame.py` names them):

```
  856d62122  Every interior moved +80 m in x — stations across the ledger   1 row
  e62112945  VERIFY C's TV row: confirmed — and one number in it cannot b…  4 rows
  b2ab069d3  Verify C: narrowed the TV blocker one more step — the statio…  4 rows
```

**Two rows have now been deleted twice**, after I restored them:

- `[C] pressing e doesnt get me out of it — stuck in the TV seat` — a
  **player-blocking bug report**, and it was **CONFIRMED** when it went the
  second time
- `[E] what is the shadow geometry here?` — CONFIRMED both times

**Restoring is not holding.** I restore, the next bulk edit drops them again. I
can keep doing it indefinitely and the record will still be wrong between passes,
which is precisely when the desk reads it.

## IT IS NOW DELETING CURRENT VERIFICATION, NOT JUST OLD ROWS

The third commit removed **four of my own confirmations outright — verdict AND
evidence**: the jail, both bank rows, and the sleep fade. Every one had been
verified within the hour, two of them a new builder's first work.

```
  row 277  K  sleep fade          CONFIRMED -> OPEN, evidence gone
  row 288  O  the jail            CONFIRMED -> OPEN, evidence gone
  row 290  M  bank loan           CONFIRMED -> OPEN, evidence gone
  row 291  M  bank interior       CONFIRMED -> OPEN, evidence gone
```

I recovered the evidence from `3c55d1222` and re-applied the four verdicts.
**Note what that means for anyone reading the ledger between the deletion and my
noticing: four finished, verified features looked unverified**, and two builders
would have been told their work was still outstanding.

## What I need, and it is small

1. **Anyone rewriting the ledger in bulk diffs the row-key set before and after.**
   One command: `python3 scripts/ledger-lost.py`. It exits 1 and names what went.
2. **Or `scripts/land.sh` runs it** and refuses a merge that loses a row.

Either closes this. Until one of them is in place I will keep restoring, and the
file will keep being wrong in between.

## What is NOT the problem

- **Not my rebase.** `ledger-blame.py` walked 90 commits: the losses are in the
  three commits above and my resolver keeps every mainline row. I checked this
  before saying so, because I could not exonerate myself by argument.
- **Not carelessness by any one agent.** Three different passes, same shape:
  rewrite many rows programmatically, lose some, and nothing notices because the
  file still parses and still looks like a ledger.
