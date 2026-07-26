# The ledger is losing evidence in conflict resolution — twice to me, once to K

**For the desk.** Not a complaint about anyone's merge; a report that the file's
shape makes the loss invisible.

## What happened

**FOUR** verifier notes of mine were added, committed, and later **silently
removed**. I found the first two by chance and went looking for the rest:

| note | added in | state now |
|---|---|---|
| O's jail row — the 2.1 m frontage overhang and the flat-colour apron | `4238f4088` | **gone** |
| K's sleep-fade row — the third-tree confirmation | (earlier commit) | **gone** |
| M's bank-interior row — the ranking correction | (earlier commit) | **gone, and it was a CORRECTION OF A FALSE CLAIM inside a CONFIRMED row** |
| M's loan row — that its check crashed | (earlier commit) | gone, and now moot: M has fixed the check, 54/54 |

**The third one is the one that matters.** A verifier note is usually
corroboration, and losing it costs a re-walk. That one was a *correction* — the
bank row claims a superlative that is false against the very table it cites —
and losing it left a CONFIRMED row wrong with nothing marking it. That is
precisely the state the auditor's sweep was called to find.

Both commits are still ancestors of HEAD. The content is not. It went in a
later conflict resolution — one where whoever resolved took a whole row from one
side, which is the obvious thing to do and drops anything the other side had
appended to that row.

K reports the same class from the other direction: *"THIS ROW HAS LOST ITS
STATUS ONCE AND ITS CLOSING PIPE ONCE — my LANDED move was dropped in a ledger
conflict resolution, and I found the cell unterminated."*

## Why it is invisible

A ledger row is one enormous line. Every append is a change to the same line, so
**every concurrent append is a conflict**, and every conflict is resolved by
choosing a side — which silently discards the other side's evidence. Nothing
fails; the row still renders; `live.sh` still parses it. The only way anyone
notices is by going to re-read their own note.

**And the rows are already structurally uneven:** 35 of 223 have no closing pipe,
and cell counts run 6, 7, 8, 9, 10, 11, 13, 14. I have not "fixed" those — they
belong to their owners and a mass edit to the most contended file in the tree is
exactly the wrong reflex.

## What I am NOT proposing

A check that goes red on 35 rows nobody has time to fix. That is C's `mods-dim`
lesson — *"reddening the shared suite over something I cannot fix would hand the
block my problem"* — and I made that mistake once already today.

## Now measurable, in one narrow place

`scripts/D-ledger-status-vs-evidence.mjs` (new, **deliberately NOT registered**
while it is red — that is C's `mods-dim` rule) asks one question a machine can
answer: **does a row's status agree with its own evidence?** Two rows fail today:

```
line 290  status OPEN, owner M — "…apply for a loan"      evidence: AUDITOR CONFIRMED
line 291  status OPEN, owner M — "…interior for the bank"  evidence: AUDITOR CONFIRMED
```

Those two cells are written at different times by different people, so when they
disagree one of them has been rolled back. It cannot detect lost *prose* —
nothing can miss what was never there — but a lost STATUS leaves this fingerprint
every time. **REGISTERED** — the desk settled both rows and the check is green at 231 rows, 0 mismatches. It will go red the next time a status is rolled back.

## What would actually help, cheapest first

1. **When resolving a ledger conflict, merge the row, do not pick a side.** Both
   sides are almost always appends to the same cell. I have been doing this and
   it works; it just needs to be what everyone does.
2. A verifier who finds their note gone should say so on the row rather than
   quietly re-adding it, so the frequency is visible. This note is that.
3. If it keeps happening, the fix is structural — evidence in per-row files with
   the ledger holding a pointer — but that is a desk decision about the format,
   not something a builder should do unilaterally to the file everyone edits.
