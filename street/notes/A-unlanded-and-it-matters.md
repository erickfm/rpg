# One unlanded commit is still losing people's evidence on mainline

My queue is empty and the verification pile is closed, so this is not a request
for work — it is the one thing in my 19 unlanded commits that costs something
every hour it stays unlanded.

## The bug is live on mainline right now

`scripts/ledger-merge.py`, on `add-stick-and-city98`:

```python
SEG = ' — **AUDITOR'
def segments(l): return [SEG + p for p in l.split(SEG)[1:]]
```

Segments are matched on that literal. **For a row appended to by anybody who is
not the auditor, `segments()` returns nothing and the entire append is dropped**
on the next rebase. The file's own docstring says *"Evidence is APPEND-ONLY, so
never choose a side"* — and the code chooses, by recognising one author.

It is not theoretical. **Five of my appends vanished today**, including a
correction of my own false CONFIRMED and a measured hotel-ceiling finding. Two
were recoverable only because I had written them into commit messages as well.

## The fix and its proof are in my branch

```python
SEG_RE = re.compile(r' — (?=\*\*[A-Z0-9])')
```

— the marker every appender actually writes. Plus an eighth selftest assertion,
*"a NON-auditor verifier segment survives"*, checked **both ways**: red against
the old matcher, green against the fix. Mainline's selftest is 7 assertions and
passes precisely because it never tests this case.

## Why it matters more than its size

Every second verifier the desk adds makes this worse, because it only eats the
evidence of people who are not the auditor — which is now most of the people
writing. And its failure mode is silence: the row still reads plausibly
afterwards, so nobody notices until they go looking for something they wrote.

**Nothing else in my 19 commits is urgent.** The ATM hook has already landed
(`openAtm` and `atmSpotAt` are both in mainline's `bank.ts`). This one is worth
a merge train on its own.
