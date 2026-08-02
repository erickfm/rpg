# ~15 CONFIRMED rows citing stale interior coordinates — audited, 6 repaired

Queue item, file `notes/LEDGER.md`. Build at commit `9ca6add09`.

## Root cause, one line

The interior belt moved TWICE, not once: a bank inserted at 440 (`856d62122`)
shifted ten rooms +80 m, and a jail inserted later — between hotel and
library in build order — shifted five more rooms +80 m again. So library
went 840→920→1000→1080. A citation "corrected" for the first shift alone
(a common pattern already in this ledger) is stale again after the second.
Verified against the live world, not against any commit message:
`window.__ct.roomDims()` on port 4182 gives `bank 440, bodega 520, burger
600, casino 680, church 760, diner 840, hotel 920, jail 1000, library 1080,
pawn 1160, tax 1240, thrift 1320`.

## What I found

This ledger already has an established, working self-repair pattern:
almost every row I checked (bank, casino, church, hotel, library ×6+, most
of the seat-exit and door-leaf rows) already carries an appended
`AUDITOR ADDRESS CORRECTION` or `A, RE-POINTED (row 308)` note giving a
**current** coordinate, and I verified several of those against
`roomDims()` — they were right. Row 309 (this exact defect, filed OPEN by
a previous auditor pass) itself lists a triage, but its "row N"
cross-references no longer match current file line numbers — rows have
been added/edited since — and by the time I checked, all three of its
flagged "REAL" items (its 206/209/280) already carried a correction
elsewhere in the ledger, added after that triage was written.

So I did not trust either the row-309 list or the commit-message mapping;
I grepped the whole ledger for interior-belt-range coordinates (~30
distinct candidate rows), read each one's *current* text by eye, and
checked its citation against live `roomDims()`, not against a formula.

**Six rows were still stale**, all missed by every prior pass:

1. **Line 125 (thrift density/measurement row)** — "STAND IN THE THRIFT AT
   x 1240" had already been corrected once (from 1160), but 1240 is now the
   TAX office; thrift is at cx 1320. Fixed.
2. **Line 185 (library stair, "buildRoom accept a floor function")** — "the
   flight occupying x 927…929.5" was never corrected at all. Fixed by
   pointing at row 217, which independently re-walked and address-corrected
   the same stair (today ~x 1087–1089.5).
3. **Line 193 ("I WANT TO BE ABLE TO WALK UP THOSE STAIRS")** — same stair,
   same stale x 927.5–929.5, filed separately by a different pass. Same fix.
4. **Line 222 (clocks row)** — the diner/library clock addresses were
   already correctly converted, but the `> ROUTE G` line naming the
   unconverted TAX clock still said "(1080, 2.18, −4.2)" — 1080 is the
   LIBRARY today, not tax (cx 1240). Fixed, so G's routing actually reaches
   the tax office.
5. **Line 240 (bodega door-facing arrival)** — "came to rest at x 441.24"
   was never corrected; 441 is inside the BANK today. Bodega is cx 520, so
   corrected to ~521.24.
6. **Line 279 (casino/library seat-height row)** — J explicitly flagged the
   church sitter's address as needing conversion but declined to do it
   without walking the room ("whoever picks it up should convert it from
   its own room, not from mine"). I did the arithmetic only — (676.63,
   −5.65) → ~(760.63, −5.65) — and said so; **not walked, offset only**,
   same caveat J gave.

**Also updated row 309** (the ledger's own tracking row for this defect)
with what this sweep found and fixed, since its existing list had gone
stale in the way described above. Left it OPEN — closing it is the desk's
call, not mine.

## What I deliberately did NOT touch

- Every row already carrying a correct, current-format correction —
  confirmed against `roomDims()` rather than assumed. That's the majority
  of what I checked: bank/casino/church/hotel/library rows 138, 147, 149,
  204, 207, 210, 217, 222 (its main body), 251, 256–258, 268–269, 279 (its
  library half), 281, 289, 300, 309 (its own body).
- Rows whose stale coordinate is incidental to a withdrawn/retracted claim
  (line 91: a warning about a past false-positive, not live evidence; line
  250: E's own x-840 measurement, explicitly released — "That measurement
  does not test this row and I am not filing it as one").
- Rows whose stale coordinate doesn't affect the verdict (line 175: "13 of
  the other 15 are shop keepers on the interior belt, x 442–1077" — a
  population range supporting "none are near the junction," not a
  navigation instruction; line 272: an incidental "E put me at x 600" in a
  door-rename verification, recording what happened on a specific past
  build, not a live station).
- `notes/LEDGER.md`'s two SHA-repair items (item 10 in the queue) — out of
  scope for this item, different defect class.

## Verified

- Recomputed all five corrected coordinates against
  `SHOT_URL=http://localhost:4182/ node -e "...roomDims()..."` (script
  written, used, and deleted — not committed) immediately before writing
  each correction: bodega 520, church 760, library 1080, tax 1240, thrift
  1320 — all confirmed.
- `grep -c '^|' notes/LEDGER.md` before and after: **254, unchanged** — no
  row added, removed, or split.
- `wc -l notes/LEDGER.md`: **330, unchanged** — every edit landed inside
  its existing single-line row, none broke the one-row-per-line format.
- No row's CONFIRMED/OPEN/LANDED status was changed by me, per the queue's
  own rule that a builder doesn't move ledger rows.

## Derivation

Every corrected number comes from `window.__ct.roomDims()` on the running
world (port 4182), read live, not from the `856d62122` commit message's
mapping — that mapping is only correct up to the bank insertion and
silently wrong past the jail insertion (library, pawn, tax, thrift all
shifted a second time). Citing the commit message instead of the live
world is exactly the mistake this whole item exists to fix.
