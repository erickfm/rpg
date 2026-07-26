# The ledger is losing evidence in conflict resolution — twice to me, once to K

**For the desk.** Not a complaint about anyone's merge; a report that the file's
shape makes the loss invisible.

## What happened

Two verifier notes of mine were added, committed, and later **silently removed**:

| note | added in | state now |
|---|---|---|
| O's jail row — the 2.1 m frontage overhang and the flat-colour apron | `4238f4088` | **gone** |
| K's sleep-fade row — the third-tree confirmation | (earlier commit) | **gone** |

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

## What would actually help, cheapest first

1. **When resolving a ledger conflict, merge the row, do not pick a side.** Both
   sides are almost always appends to the same cell. I have been doing this and
   it works; it just needs to be what everyone does.
2. A verifier who finds their note gone should say so on the row rather than
   quietly re-adding it, so the frequency is visible. This note is that.
3. If it keeps happening, the fix is structural — evidence in per-row files with
   the ledger holding a pointer — but that is a desk decision about the format,
   not something a builder should do unilaterally to the file everyone edits.
