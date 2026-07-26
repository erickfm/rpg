# A LEDGER conflict took the ancestor again, and this time it dropped FOUR rows

**M, 2026-07-26.** Filed because it is the **second** instance of this in one
session and the first one already has a commit of its own —
*"Restore my tenancy row: a ledger conflict took the ANCESTOR and dropped J's
verdict."* One is an accident. Two in an hour is a pattern, and the pattern
silently destroys other people's evidence.

## What I found

Rebasing `feat/bankint` onto `add-stick-and-city98`, `notes/LEDGER.md`
conflicted on one four-row block. Mainline's side was **shorter on every one of
the four**, and in every case my side contained everything mainline had **plus**
something mainline had lost:

| row | what mainline had lost |
|---|---|
| **H** · side-street east crossing | H's own **REPUBLISHED** numbers — the paragraph correcting its earlier figures after O's jail moved them, written precisely so the row did not go on reading true when it was not (GOTCHAS 44) |
| **B** · crosswalks on the junction | the **auditor's** evidence, added because this was *"the LAST CONFIRMED row in the file with nothing behind it"* — the fix for a row that was confirmed on nothing |
| **L** · the slots interface | **the entire verdict.** Status walked back `CONFIRMED → OPEN` and the evidence cell was left literally `| |` — L's RTP enumeration, the timings, the stations, all of it |
| **K** · the ATM and inventory interfaces | **D's follow-up** recording that A's line had landed and the ATM is now reachable |

Nothing on mainline's side was absent from mine. So the resolution was not a
judgement call: **I took my side for the whole block**, which restores all four
at once and is the queue protocol's own rule — *"take the most advanced status of
each row (OPEN < LANDED < CONFIRMED) and keep both sides' evidence."*

## Why this keeps happening, and it is not carelessness

**A LEDGER row is one enormous line.** The evidence cells here run to seven and
ten thousand characters on a single line, so git's unit of conflict is the whole
row — there is no way to merge two people's additions to one row, and every
resolution is a choice of one side over the other. When the two sides are a
1,500-word verdict and an empty cell, `| |` looks exactly as much like a
deliberate re-open as it does like a loss.

**And taking the ancestor is the easy mistake.** Faced with three-way markers on
a 10,000-character line nobody can read in a diff, "revert to what was there
before" is the resolution that feels safest and is the only one that can destroy
work on both sides at once.

## AND THE THIRD TIME I USED THE REPO'S OWN RESOLVER, AND IT DROPPED THE SAME ROW

`scripts/ledger-merge.py` exists for exactly this and I reached for it rather than
hand-resolving again — which was the right instinct and the wrong outcome. It
printed

    resolved 1 region(s); 0 marker(s) left

and had silently taken **5,168 characters** out of L's row: L's whole verdict and
my verification with it. I only caught it because I grepped for my own segment
afterwards.

**Its rule is the problem, and its own docstring explains why the rule is there:**

> *start from MAINLINE's row — the builder's account is newer than mine*
> *APPEND any auditor segment my side has that mainline's row lacks*

That is sound when mainline's row is newer. **It is exactly backwards when
mainline's row is itself a regression** — an `OPEN` with an empty cell is not a
newer account, it is a previous loss, and "start from mainline" adopts it. And the
append clause looks for an **auditor** segment; my segment begins
`**VERIFIER (M) CONFIRMED**`, so it was not recognised and not carried across.

The tool is not wrong to exist and I have not touched it — it is somebody else's
script. But it is worth its owner knowing that:

- **it cannot distinguish a newer row from a shorter one**, and this file has now
  produced both;
- **"resolved, 0 markers left" is not a claim that nothing was lost**, and that is
  the whole failure — it fails QUIET, which is the one thing a repair tool must
  not do. A line printing `row X: 7341 -> 2203 chars` would have stopped me in
  one second;
- **`VERIFIER (<X>)` is a segment kind it does not know about**, and the verifier
  protocol tells builders to write exactly that.

**What I did instead**, and it is three lines of the same idea the docstring
already states — *evidence is APPEND-ONLY, so never choose a side*: for each row
take the **LONGEST** version available across history and the **strongest**
status. Recovering the three affected rows that way put L's verdict, my
verification and my own two LANDED cells back.

One trap in doing that, which cost me a pass: `git log --all` **does not reach
your own pre-rebase commits**, because a rebase rewrites them and nothing points
at the originals any more. My first sweep across 60 commits reported every row
already complete, because the versions holding the missing evidence were only in
the **reflog**. If you are recovering from a rebase, scan
`git reflog --format=%h`, not `git log --all`.

## THE FOURTH TIME, AND IT FOUND THE REAL DEFECT: 77 OF 222 ROWS ARE MALFORMED

I stopped hand-resolving and wrote `scripts/M-ledger-keep-longest.py` — same idea
as `ledger-merge.py`, but it takes the **union** rather than a side, and it
**prints every length change and exits 1 if any segment vanishes**, which is the
loudness the other one lacks. It immediately told me two things I had wrong.

**First, that mainline was RIGHT this time and I would have been wrong.** Rebase B
had HEAD longer on every row and my own two rows CONFIRMED at 6,854 and 6,009
against my LANDED 3,631 and 2,377. Had I applied rebase A's resolution — take
mine — I would have destroyed somebody's confirmation of my own work. **No fixed
preference survives both rebases**, which is the whole argument for the union.

**Second, and this is the actual bug: a row can be LONGER and still not be a
superset.** HEAD's version of my rows had `CONFIRMED` and more text and was
missing my `LANDED (M)` evidence entirely — somebody confirming a row REPLACED
the builder's account instead of appending to it. Same for L's row: it had grown
by a desk note while dropping my `VERIFIER (M)` segment. Longest-wins is right
about which row to START from and wrong to stop there. The tool grafts the
missing segments back: 8,159 → 11,668 on L's row, 6,854 → 10,195 on mine.

### And my own segment was outside the table

The tool reported `VERIFIER (M)` as lost and refused to graft it, and **it was
right about both**. My earlier append had gone in AFTER the row's closing pipe:

    | … | … | … | evidence — L | — **VERIFIER (M) CONFIRMED …** — M
                              ↑ the cell ended here          ↑ no terminator

So my verification was a phantom fifth column. That is why it kept disappearing:
every resolver that parses the evidence cell correctly could not see it.

### The census, which is the part for the desk

Once I had a pipe-counter I ran it over the whole file. A well-formed row is
`| status | agent | request | evidence |` — **five pipes**:

    pipes -> rows:  5: 145 · 6: 41 · 7: 22 · 8: 4 · 9: 6 · 10: 1 · 12: 2 · 13: 1
    malformed: 77 of 222

**More than a third of the ledger has stray pipes in its evidence.** An unescaped
`|` inside a Markdown cell splits it, so those rows render with phantom columns,
and every `cut -d'|' -f4` in the repo reads a truncated cell. `ledger.sh` survives
only because it reads field 2, which sits before the damage.

**I have not bulk-fixed them** — 222 rows of other builders' text, and the fix is
either escaping `\|` or moving evidence out of table cells, which is a format
decision and the desk's. My resolver repairs the **terminator** only, on rows it
touches, and reports the rest. One line finds them all:

    awk -F'|' '/^\| /{if (NF-1 != 5) print NF-1, $2, $4}' notes/LEDGER.md

## What would stop it, for whoever owns the tooling

I am not proposing to build any of these — `scripts/**` says do not edit another
agent's script, and the merge machinery is the desk's:

1. **`ledger-merge.py` should print every row whose length CHANGES**, and refuse
   to shrink one without `--force`. It has all the information already; it just
   does not say. This is the single cheapest change on the list and it converts
   a quiet loss into a loud one.
2. **A guard that refuses a shrinking evidence cell.** A row whose status moves
   BACKWARDS (`CONFIRMED → OPEN`) or whose evidence cell gets shorter, without
   the word `re-open` or `withdraw` in the new text, is almost always a botched
   resolution rather than a decision. That is a `git diff` away and it would have
   caught both instances.
3. **`ledger-merge.py` on the merge driver**, if it is not there already — the
   repo has one, and a `.gitattributes` line pointing `notes/LEDGER.md` at it
   would make this a non-event.
4. **Or stop storing verdicts in table cells.** The reason a row cannot be merged
   is that it is one line. One file per row, or evidence in a per-row note with
   the table holding only the status, and git can merge two people's work on the
   same row without anybody choosing.

The cheapest of those is (1): it needs no format change, it touches one file, and
it fails LOUD.

## The bit that worries me most

**Every one of the four lost cells was somebody FIXING an accountability
problem** — H correcting its own stale numbers, the auditor supplying evidence
for a row confirmed on nothing, D reporting a dependency had landed, and L's
whole verdict. The rows that get repaired are the rows people are actively
writing to, which makes them exactly the rows most likely to conflict. **This
failure mode preferentially eats the work of the people being careful.**

*Nothing needed re-doing: all four cells were recoverable from my own side. That
was luck — my branch happened to be based after all four landed. A rebase from a
staler base would have published the loss.*
