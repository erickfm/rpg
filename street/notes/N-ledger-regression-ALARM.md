# ELEVEN ledger rows went backwards at one commit — six of them CONFIRMED

**For the desk. Not blocking me; it is blocking the accuracy of every queue.**

`scripts/ledger-no-regress.py` (new, mine) reports **6 rows whose status FELL
and 5 whose evidence SHRANK**, and every one of them regressed at the same
revision, `bd915e0cb`. One conflict resolution took the ancestor for eleven rows
at a stroke.

```
STATUS FELL   K     when the player goes to sleep…      now OPEN, was CONFIRMED
STATUS FELL   O     also we need a jail…                now OPEN, was CONFIRMED
STATUS FELL   M     …apply for a loan                   now OPEN, was CONFIRMED
STATUS FELL   M     create a whole interior for the bank now OPEN, was CONFIRMED
STATUS FELL   L     add a slots interface…              now OPEN, was LANDED
STATUS FELL   AUDIT 28 CONFIRMED rows rest on nothing   now OPEN, was LANDED

EVIDENCE LOST L     …a black jack interface             now    87 chars, was 3731
EVIDENCE LOST desk  PVBLIC vs PUBLIC on the library     now   464 chars, was 1151
EVIDENCE LOST G     casino + hotel blades read correctly now   91 chars, was  807
EVIDENCE LOST desk  world stops reloading under the player now 83 chars, was 742
EVIDENCE LOST F     library courtyard benches sittable  now    82 chars, was  574
```

My own row was a twelfth and I have already restored it (`da768bd2a`), which is
the only reason I went looking: it came back into my queue as LIVE this round,
and I recognised it. **Nobody else has that control over their own rows.**

## Why this is urgent rather than untidy

`scripts/live.sh` reads STATUS. Six features that were built, verified and
signed off are now sitting in builders' queues as **work to do**. The queue
README already names what that costs — *"builder B was given four items it had
finished hours earlier… the desk had told the user a builder was blocked when it
was not"* — and this is that, six times, with the CONFIRMED evidence gone so
nothing contradicts it.

**Four of the six are rows I verified myself in the last two hours** — K's sleep
fade, O's jail, M's loan, L's slots. The evidence is not lost, it is in
`notes/N-verify-*.md`, but the ledger no longer points at any of it.

## MOST OF IT CANNOT BE FIXED BY PUTTING THE OLD ROW BACK

This is the finding that changed after I built the repair path, and it is the
one that matters:

```
python3 scripts/ledger-no-regress.py --fix /tmp/proposed.md

  SAFE  O     also we need a jail…                 restorable, loses nothing
  SAFE  L     i would like a black jack interface  restorable, loses nothing
  MERGE K, AUDIT, L-slots, M x2, F, G, desk x2     both sides have text
```

**Only 2 of the 11 are safely restorable.** On the other nine the row gained
NEW evidence after the regression, so "just put the old one back" would destroy
the newer half — which is the same operation, in the same file, that caused
this in the first place. The README's rule is *keep both sides' evidence*, and
for those nine that means a real merge and not a revert.

`--fix` writes a proposed copy and touches nothing. The two SAFE rows come out
as a 4-line diff against the live file, with the row count unchanged at 222.

## What to run

`ledger-recover.py` is the right tool and it is **only half of the answer here**:
its `SEG = ' — **AUDITOR'` means it merges *auditor* segments back in, and most
of what was lost above is VERIFIER and BUILDER text.

```bash
python3 scripts/ledger-no-regress.py                    # the alarm; exit 1 while a row is down
python3 scripts/ledger-no-regress.py --fix /tmp/fix.md  # propose the SAFE rows, in place of nothing
diff notes/LEDGER.md /tmp/fix.md                        # 4 lines, 2 rows
python3 scripts/ledger-recover.py bd915e0cb             # the auditor segments, for the MERGE nine
```

The rest wants the README's own rule applied by hand, and it is one line:
**take the most advanced status of each row (OPEN < LANDED < CONFIRMED) and keep
both sides' evidence.** Every row above is recoverable verbatim from
`bd915e0cb` — nothing is gone from git, only from the file.

**I have not touched the eleven.** They are other builders' rows and the README
is explicit that I may edit only my own; a mass rewrite of eleven rows by
somebody who owns none of them is how this happened in the first place.

## The detector

`scripts/ledger-no-regress.py`, named for what it asserts (GOTCHAS §24), and
written only after reading its three neighbours to be sure it was not a rival:

| | catches |
|---|---|
| `ledger-lost.py` | a row that DISAPPEARED |
| `ledger-evidence.py` | a CONFIRMED row with nothing behind it |
| `ledger-recover.py` | REPAIRS one, once you already suspect it |
| **`ledger-no-regress.py`** | **a row that became YOUNGER — status fell, or evidence shrank** |

The case that happened is the one none of the first three sees: the row never
disappeared and never looked bare. `ledger-recover.py`'s own docstring describes
the mechanism precisely — *"a conflict resolver that picks ONE SIDE of a row
therefore always loses something, and it loses it silently, because the row
still looks fully populated"* — so this is the missing **alarm** for the fault
its **repair** tool was written for.

Watched both ways rather than trusted:

- **fires** on the real damage — 11 findings, exit 1, no synthetic mutation needed
- **stays quiet** on a healthy file — `ledger-no-regress.py 1`, which lets it see
  only the current commit, reports `0 fell · 0 shrank` and exits 0

It exits **3** when no history is readable, because an empty history is a broken
query and not a clean bill of health (GOTCHAS §32) — the same trap `ledger-lost.py`
documents having fallen into.

**A re-open by the desk is not a regression** and is deliberately not flagged: a
row the desk legitimately re-opens is *supposed* to shed its evidence, so the
shrink test only fires when the status held.

— N
