# w14 — item 3: ~15 CONFIRMED rows citing stale interior coordinates (round 2)

## Verdict: already satisfied — no LEDGER.md edit needed

**Measured against the live world, not against a formula.** `roomDims()` on my
own server (port 4193, `SHOT_URL=http://localhost:4193/`):

```
bank@440 bodega@520 burger@600 casino@680 church@760 diner@840 hotel@920
jail@1000 library@1080 pawn@1160 tax@1240 thrift@1320
```

**Identical to the mapping w3 measured** in `notes/w3-stale-ledger-coords.md`
(commit `9ca6add09`) when it repaired the 6 rows this item's own text
references ("Partially done — an earlier pass repaired 6"). **The belt has
not shifted a third time.** So every citation w3 fixed or left alone on the
strength of that mapping is still correct today.

## What I checked

1. **Whether any new stale citation was introduced since w3's pass.** Only 5
   commits have touched `notes/LEDGER.md` since `9ca6add09`
   (`8aaed4102`, `b84fee120`, `b076769a2`, `3ff727fbf`, `45f0f4092`), all
   small in-place edits to existing rows (append-only evidence-cell growth,
   matching row count before/after). Re-ran the same interior-belt x-coordinate
   grep w3 used (`x[= ][0-9]{3,4}`, filtered to 400–1400): **same 30 line
   numbers w3 already examined exhaustively** (91, 125, 138, 139, 147, 149,
   175, 185, 193, 204, 207, 210, 217, 222, 240, 248, 250, 251, 256–258,
   268–269, 272, 279, 281, 289, 300, 308, 309). No new candidate rows exist.
2. **Whether the 6 previously-repaired rows are still correct.** Spot-checked
   lines 125 (thrift → 1320), 185/193 (library stair → ~1087–1089.5, cites
   row 217's independent walk), 222 (`> ROUTE G` tax clock → 1240), 240
   (bodega door-facing → ~521.24), 279 (church sitter → ~760.63) — all still
   carry their `W3, ADDRESS CORRECTION (2026-08-01)` note and all match live
   `roomDims()`.
3. **Ran the calibrated instrument** (`python3 scripts/stale-coords.py` — the
   station this item's own tracking row, L309, names): it reports **3**
   CONFIRMED rows outstanding, beyond the 23 it already recognizes as
   corrected: **204, 262, 300.** Investigated each by hand rather than
   trusting the count, per §7 of the brief:

   - **Row 204** (church interior, G/E/A): already carries a fix —
     `**A, RE-POINTED (row 308):** the station... x 680 is the casino
     today... nave station (680, −6.5) is now (760, −6.5)`. **760 matches
     live `roomDims()` exactly.** The script's skip-check only recognizes
     the literal phrase "ADDRESS CORRECTION"; this row's fix is phrased
     "RE-POINTED" and slips past it. **False positive — content is correct,
     detector wording is narrow.**
   - **Row 262** (`floaters-walk.mjs`, A/D/AUDITOR): the flagged text is
     `` `scope: room "diner" — 10.8 x 7 m centred (760, 0)` `` — a **verbatim
     quote of a script's own printed output**, not a live station. This is
     the exact case a previous auditor pass already ruled NOT a fault
     (recorded in row 309's own history as "row 261... is quoting a TOOL'S
     OWN OUTPUT... rewriting it would falsify the evidence it exists to
     show"). Same text, row renumbered by intervening edits. **Not a fault,
     already adjudicated.**
   - **Row 300** (stuck-in-TV-seat, C/multiple verifiers): the flagged
     sentence is H's diagnostic aside explaining the ORIGINAL misattribution:
     *"x 598-601 is BURGER; the casino moved to cx 680 when the bank and
     jail were inserted."* Both numbers in that sentence are **already
     correct for the current mapping** (burger cx 600, casino cx 680) — it
     is a row correcting someone else's stale claim, not itself stale. The
     detector's proximity heuristic (room word within N characters of an x
     value) matched across a clause boundary. **False positive.**

## Conclusion

**No CONFIRMED row currently sends a reader (human or script) to the wrong
room.** Item 3's target set, after excluding the already-repaired 6 and the
3 newly-checked false positives, is empty. Per the brief's rule 6 ("check
whether the work is already done... that is a success, not a failure"), I am
marking this done without touching `notes/LEDGER.md` — there is nothing to
repair or demote, and my own task instructions say not to edit that file
regardless.

## Found but not fixed — for the desk

`scripts/stale-coords.py`'s completion-marker regex recognizes the phrase
"ADDRESS CORRECTION" but not equivalent phrasing like "RE-POINTED" (row 204),
so it will keep re-flagging that row as a false positive on every future run.
A one-line widening of the skip pattern would silence it. Not fixed here —
`scripts/` is not a file this item names, and it is a one-line, low-risk
change someone who owns that file (or the next stale-coords item) can take.

## Derived vs copied

`roomDims()` values above are freshly re-derived this session from the live
world (port 4193), same method as w3. The three individual row texts were
read in full from `notes/LEDGER.md` at HEAD, not summarized from memory or
a commit message.
