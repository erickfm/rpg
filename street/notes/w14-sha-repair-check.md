# w14 — item 4: the two live-but-unresolvable SHA citations

## Verdict: already fixed and already re-verified twice — nothing to do

The two SHAs this item names, `06f0a1eca` and `0c9b5cd7f`, were repaired
before I claimed this item. Reading `notes/LEDGER.md` row 313 (the ledger's
own tracking row for the SHA-repair effort) end to end:

1. An earlier auditor pass measured **106 of 114** distinct SHAs resolving
   on `add-stick-and-city98`, with 6 self-flagged UNRECOVERABLE and 2
   (`06f0a1eca`, `0c9b5cd7f`) presented as live but not resolving.
2. **"FOLLOW-UP REPAIR, w2 (queue item 11), 2026-08-02"** found both via
   pickaxe match (same content, renamed by a rebase — GOTCHAS 36) and
   annotated each citing row in place: `06f0a1eca` → `fbd8f96c1a0306ae41a0d8ef02b91fe8d55510f3`
   (rows 138 and 222, both F's) and `0c9b5cd7f` → `a309a4de86e941d9d674c7e77dc18d3f50c37a4d`
   (row 262, A's `floaters-walk.mjs` row). That pass **independently
   verified both replacements with `git merge-base --is-ancestor` against
   `add-stick-and-city98`** (deliberately not `git cat-file -t`, which the
   row notes proves little — a rebased-away object can still sit locally
   until GC). Score updated to **108 repaired, 6 declared dead, 0 wrong**.

**I re-verified independently, a third time, rather than taking the row's
word for it:**

```
git merge-base --is-ancestor fbd8f96c1a0306ae41a0d8ef02b91fe8d55510f3 add-stick-and-city98
git merge-base --is-ancestor a309a4de86e941d9d674c7e77dc18d3f50c37a4d add-stick-and-city98
```

Both exit 0 on my own worktree (reset from `origin/add-stick-and-city98`
this session). Both replacement hashes are genuine ancestors of the branch
every builder resolves against.

## Root cause this item is stale

**This queue item's own text ("Finish the repair that reached 106 of 114")
describes the state the ledger was in before w2's follow-up repair landed.**
The queue entry was never updated after the fix it asked for was already
delivered and independently confirmed — the same class of staleness as item
2 (duplicate of already-DONE item 12) and item 3 (already-resolved by w3's
earlier pass), all three encountered back to back this session.

## What remains, correctly untouched

The **6 self-flagged UNRECOVERABLE citations** are not part of this item's
target (the item's own wording separates them: "two... presented as live but
do not resolve, **and** 6 more are honestly flagged unrecoverable") and row
313 says explicitly they were "not re-attempted here — this item named only
the 2 presented as live." A citation whose commit object is genuinely gone
being marked dead rather than invented is the correct, desired outcome per
GOTCHAS 53 — nothing to fix there.

## Derived vs copied

The two replacement SHAs are copied verbatim from row 313's own text (they
are identifiers, not measurements — nothing to re-derive), but the claim
that they resolve was independently re-run via `git merge-base
--is-ancestor` on my own worktree rather than trusted from the row.
