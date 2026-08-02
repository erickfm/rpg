# w14 — item 2: verify the LANDED rows and the ledger generally

## Verdict: already satisfied — nothing to demote or confirm

**Measured, not assumed.** `notes/LEDGER.md` currently has:

- `bash scripts/ledger.sh --stats` → `CONFIRMED 238 · LANDED 0 · OPEN 8`
- Independent parse (Python, split every table row on `|`, tally column 1):
  `CONFIRMED 238, OPEN 8, VOID 2` (plus the header row). **Zero rows carry
  `STATUS = LANDED`.**
- `node scripts/ledger-intact.mjs` → `253 rows -> 253 — intact — nothing
  lost, nothing shrank, no contribution dropped, no markers, no duplicates`.

(The handful of `| 6 |`, `| 24 |`, `| 48 |` lines around L176-179 that a naive
`grep "^| LANDED"` might worry about are a nested markdown sub-table *inside*
one CONFIRMED row's evidence cell — a crowd-density measurement table, not
separate ledger rows. Confirmed by reading the surrounding lines.)

## Root cause / why this item is already done

**This queue item is a near-verbatim duplicate of item 12**, which reads
identically ("Verify the LANDED rows, and the ledger generally. Confirm or
demote by walking or looking, never by reading code.") and is logged `DONE
w3`: it found the ledger's *only* LANDED row (church pillars/windows), walked
E's station, re-ran E's predicate on dev and built bundle (4/4 PASS),
promoted it to CONFIRMED, and stated **"no other LANDED rows exist."**

I re-measured rather than trusting that note, per the brief's "check whether
the work is already done" rule — and it still holds. Nothing has regressed a
row back to LANDED since w3's pass. The set this item asks me to verify
("the LANDED rows") is empty, so there is nothing to walk, confirm, or
demote.

## Found but not fixed — for the desk

Three **OPEN** rows, owner `AUDIT`, sit in the ledger with empty evidence
cells and are themselves now stale:

```
| OPEN | AUDIT | verify the ledger | |
| OPEN | AUDIT | verify the eight LANDED rows | |
| OPEN | AUDIT | confirm the remaining LANDED rows | |
```

"The eight LANDED rows" and "the remaining LANDED rows" both describe a
world that no longer exists — there are zero LANDED rows to verify or
confirm today (see measurement above). These rows are AUDIT-owned, not
`w14`'s per the ledger's "one row, one writer" rule, and my item explicitly
said not to edit `LEDGER.md`, so I left them untouched. Flagging for the
desk/AUDIT: these three rows can likely be closed out with a one-line note
that the LANDED backlog they describe is empty (measured 2026-08-01,
`ledger.sh --stats` + `ledger-intact.mjs`), rather than requiring any actual
walking/confirming work.

## Derived vs copied

All numbers above are freshly derived this session from the live
`notes/LEDGER.md` via `scripts/ledger.sh` and `scripts/ledger-intact.mjs`
(both pre-existing, calibrated instruments — not a fresh probe) plus an
independent Python tally as a cross-check. Nothing hand-copied.
