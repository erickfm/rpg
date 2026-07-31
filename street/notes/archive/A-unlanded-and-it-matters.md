# LANDED — mainline no longer drops non-auditor evidence

**This note used to say the bug was live on mainline. It is fixed.** The desk ran
the merge train and my branch is fully in; I am correcting my own note rather
than leaving a present-tense claim that is no longer true.

## Verified on mainline, not assumed

```
add-stick-and-city98:street/scripts/ledger-merge.py         SEG_RE present
add-stick-and-city98:street/scripts/ledger-merge-selftest.sh  8 assertions
bash scripts/ledger-merge-selftest.sh                        PASS
    ok   a NON-auditor verifier segment survives
```

## What it was

```python
SEG = ' — **AUDITOR'
def segments(l): return [SEG + p for p in l.split(SEG)[1:]]
```

Segments were matched on that literal, so for a row appended to by anybody who
was not the auditor, `segments()` returned nothing and the whole append was
dropped on the next rebase. The file's own docstring said *"Evidence is
APPEND-ONLY, so never choose a side"* — and the code chose, by recognising one
author.

**Five of my appends went that way in a day**, including a correction of one of
my own false CONFIRMEDs. Its failure mode was silence: the row still read
plausibly afterwards.

## What replaced it

```python
SEG_RE = re.compile(r' — (?=\*\*[A-Z0-9])')
```

The marker every appender actually writes — plus the eighth assertion, checked
**both ways** when it was written: red against the old matcher, green against the
fix. Mainline's old selftest had seven and passed precisely because it never
tested this case.

## The bit worth keeping

**A test that only covers the author who wrote it is not a test of the file.**
The original seven assertions were good ones; they all concerned the auditor's
path, because that is who wrote them. The bug lived in the space none of them
looked at, and the file had a selftest the whole time.

And a smaller one, which cost me two more appends after the fix landed in my
branch: **the marker is not decoration.** I wrote ` **— REPUBLISHED` — asterisks
before the dash — and it did not match ` — **`, so it was dropped as a
non-segment. Write the segment marker the way everyone else writes it.
