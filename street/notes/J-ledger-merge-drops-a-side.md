# `scripts/ledger-merge.py` silently kept one side and discarded the other — twice

**Not my file, so this is a report and not a patch.** Two observations, same
shape, an hour apart. I am filing it because the script's own header names this
exact outcome as the thing it exists to prevent:

> *"the failure mode is silently dropping the other side's cell, which is
> somebody's whole afternoon, and nobody would notice until they looked."*

## What happened, both times

Rebasing my verifier commits onto `add-stick-and-city98`, conflicting on
`notes/LEDGER.md` because another verifier had appended their evidence to the
**same row** while I was appending mine.

| | row | kept | dropped |
|---|---|---|---|
| 1 | G — *guy sitting in casino is clipping through his seat* | C's verdict | mine |
| 2 | D — *selection options are a bit too wide* | the other verifier's | mine |

Both times it printed `resolved 1 region(s); 0 marker(s) left` and exited 0.
Nothing warned. The rebase continued. In both cases the row afterwards read as
a single clean verdict, which is exactly what a correct merge looks like from
the outside — there is no residue to notice.

I only caught it because I had hand-merged two of these earlier the same
session and knew what a two-verdict row should look like. **The second time I
only caught it because I had been burned the first time and grepped for my own
text on purpose.**

## Why it matters more than one lost paragraph

Ten writers, one file, and the rows that collide are *precisely* the rows two
people are both working on — a row under active verification is the most likely
row to conflict and the most expensive one to lose half of. The content lost is
never a stale duplicate; it is the second, independent measurement, which is
the whole reason two verifiers are worth more than one.

In case 1 the discarded side carried a finding neither the row nor the other
verifier had: that the probe the cell offers as its predicate
(`G-seated-check.mjs`) hard-codes port 4186 and cannot be aimed. That would
have gone with it.

## What I can and cannot say

**Can:** given a conflict where both sides appended *different* text to the
*same* row, the output contained one side's text and not the other's, twice.

**Cannot:** whether this is a bug or a documented tie-break I walked into. I
have not read the script. One person's reading of somebody else's file is not a
diagnosis, and `scripts/ledger-merge-selftest.sh` sits next to it and presumably
encodes the intended behaviour — that is the place to start, not my guess.

If it IS intended, then the intent needs to be loud at the call site: a line
saying *"kept HEAD's cell for row N, discarded 412 characters from the other
side"* costs nothing and turns a silent loss into a decision.

## Until then, the one-line habit

After running it, grep the row you were writing to and confirm your own text is
still there. That is what I now do, and it is what recovered both of these:

```sh
python3 scripts/ledger-merge.py
grep -c "<a distinctive phrase from your own verdict>" notes/LEDGER.md
```

Recovering the text itself is easy once you know it is gone — the dropped side
is still in your own commit:

```sh
git show <your-commit>:street/notes/LEDGER.md | grep -E "^\| \w+ \| X \| <row>" 
```

— J, 2026-07-26

## A third instance, 2026-07-26

Same shape again, on the re-evidencing pass: I had written re-evidence onto
**three** of my rows in one commit; after `ledger-merge.py` resolved the rebase
conflict, **two** survived. The dropped one was the partition row
(`22-05-35`) — 1,220 characters, gone, with `resolved 1 region(s); 0 marker(s)
left` and exit 0.

Three for three now, and the only reason none of them stayed lost is the habit
at the bottom of this note. I am no longer treating that as belt-and-braces; it
is the only thing standing between a verification pass and a silently halved
ledger.

**The pattern across all three:** every loss was a row where the other side had
ALSO appended in the same window. That is not the rare case — during a
verification sweep it is the normal case, because the rows being worked are
exactly the rows that collide.

## A fourth instance, 2026-07-26 — and now it is a rate, not a run of bad luck

F's keeper-orientation row, verifying it. Same shape, same silent success
message, 2,430 characters gone. Restored from my own commit.

**Four conflicts, four drops.** That is not "sometimes"; across every LEDGER.md
conflict I have hit while verifying, the resolver has kept one side and
discarded the other, every single time. If the intended behaviour is to keep
both, it is not doing it. If the intended behaviour is to prefer one side, then
during a verification sweep — when the rows that conflict are by definition the
rows two people are working — that policy silently deletes half of every
contested verdict.

I still have not read the script and still am not diagnosing it. But four for
four is past the point where anyone should be relying on it unchecked, and the
grep habit below is now the only reason four verdicts still exist.
