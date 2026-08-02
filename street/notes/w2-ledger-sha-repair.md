# w2 — item 11: finish the "106-of-114" SHA repair

**Root cause, one line:** not a fresh bug — the AUDIT row (`54 of 176 build
SHAs...`, `notes/LEDGER.md`) had already been repaired to 106-of-114 by a
prior agent and its 2 still-bad citations (`06f0a1eca`, `0c9b5cd7f`) had
*separately* since been found and pickaxe-matched by a later "AUDITOR SHA
REPAIR" pass on the two individual rows that cited them — but nobody had
gone back and updated the AUDIT row's own summary, so it still read "2
wrong" and stayed OPEN quoting a count that was, by the time I looked, one
step out of date.

## What I found (measured, not read)

Two individual CONFIRMED rows carry an `AUDITOR SHA REPAIR (2026-08-01)`
annotation, each appended at the end of the row rather than replacing the
earlier `DESK 2026-08-01: this one still does not resolve` parenthetical —
consistent with the ledger's own append-only convention:

- F's "people orientation" row and F's "clocks throughout the world" row
  both cited `06f0a1eca` → repaired to `fbd8f96c1a0306ae41a0d8ef02b91fe8d55510f3`
- A's `floaters-walk.mjs` row cited `0c9b5cd7f` → repaired to
  `a309a4de86e941d9d674c7e77dc18d3f50c37a4d`

Both marked "matched by pickaxe; same content, a rebase renamed it."

## What I verified independently before trusting it

`git cat-file -t <sha>` proves an object exists in *my* worktree, which
`scripts/note-hashes.mjs`'s own header explicitly warns is nearly worthless
— a rebased-away commit can sit around un-GC'd. So I checked against the
bar that file actually uses:

```
git merge-base --is-ancestor fbd8f96c1a0306ae41a0d8ef02b91fe8d55510f3 add-stick-and-city98   # exit 0
git merge-base --is-ancestor a309a4de86e941d9d674c7e77dc18d3f50c37a4d add-stick-and-city98   # exit 0
```

Both are genuine ancestors of the branch every other builder resolves
against — not just present in one worktree. The two original short SHAs
resolve to nothing at all (`fatal: Not a valid object name`).

## What I changed

Appended (not rewrote — the ledger is append-only by its own stated
practice) a `FOLLOW-UP REPAIR` note to the AUDIT row at
`notes/LEDGER.md`, citing both repairs, my independent `merge-base`
verification, and updating the honest score from "106 repaired, 6 declared
dead, 2 wrong" to "108 repaired, 6 declared dead, 0 wrong." **Left the row
OPEN** — it was never open only for these 2 citations; its own text says it
stays open for "tasks 2 and 3" (the ~15 dead-coordinate rows and the LANDED
disposition check), which are separate queue items I did not touch. Closing
the row's status is the desk's call, not mine, per the ledger's own
convention that a builder does not confirm its own work.

## Verification

- `node scripts/ledger-intact.mjs`: 253 rows in, 253 rows out — the append
  did not create, drop or duplicate a row.
- `node scripts/note-hashes.mjs notes/LEDGER.md`: "239 commit citations …
  every cited commit is reachable from mainline" — clean, and the two dead
  short SHAs I quoted in prose (not as fresh citations) did not trip it.

## Not fixed / out of scope

- The 6 self-flagged UNRECOVERABLE citations in the same row were not
  re-attempted — the item named only the 2 presented as live, and the row's
  own text is explicit that those 6 are the correct outcome for a citation
  whose commit genuinely no longer exists anywhere (GOTCHAS 51).
- Tasks 2 and 3 named by the same row (~15 dead-coordinate CONFIRMED rows;
  verifying the LANDED dispositions) are queue items 9 and 10, not this one.
