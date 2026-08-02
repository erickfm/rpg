# Verify the LANDED rows — one found, walked, confirmed

Queue item, no named file (auditor-shaped work). Build at commit `a22ea6006`.

## What I did

Scanned the ledger's status column: `grep -oE '^\| [A-Z]+' notes/LEDGER.md
| sort | uniq -c` gave 230 CONFIRMED, **1 LANDED**, 15 OPEN, 2 VOID (plus the
header). Exactly one LANDED row existed — line 298, *"pillars of the
church seem not fully thought out. they block the windows i thin[k]"*,
E's own row, matching `SESSION-STATE.md`'s note that this was "LANDED,
awaiting a check."

## Root cause of the original complaint, one line

Buttresses were real 3D boxes placed in metres; the stained-glass lancets
were painted in texel space; nothing reconciled the two, so the piers
clipped the windows. E's fix (already landed, before this item) made the
piers and the window openings both derive from one set of bay-division
numbers, so they can't disagree.

## How I verified — walking, not reading

Wrote `scripts/w3-verify-church-pillars.mjs` and warped to the row's own
named station — the far pavement at (−5.4, −79.5), facing east, pitched
up — at three pitches (0.25 / 0.4 / 0.55 rad) plus a closer station.
`shots/w3-church-front-pitch0.4.png` and `-close.png` (gitignored, local):
the rose window sits centred over the door, one lancet reads clearly in
each side bay with daylight around it, four piers step down between the
bays, and the door sits in the widest (centre) bay. **No pier crosses or
clips a window from any station tried.** The user's complaint does not
reproduce.

Then, separately, re-ran E's own predicate (`node
scripts/E-church-front.mjs`) rather than trusting the row's prose: **4 of
4 PASS**, both against dev and against a freshly built bundle (`npx vite
build` + `vite preview`) — 4 piers, bays 1.92 / 5.96 / 1.92 m, each 1.30 m
lancet clearing its bay by 0.31 m on both sides, doorway in the centre
bay. `node scripts/bugsweep.mjs` on the built bundle: 93 shots, zero
STATION MISS, no new console errors.

**Not re-run:** the row's own positive control (`E_NUDGE=1`), which
requires rebuilding from a source-level env var to exercise deliberately-
broken geometry. Not needed to confirm what stands today; the predicate's
own account of catching a LOCAL-vs-world coordinate bug in its own control
reads as credible on its face and isn't something a walk can re-check
without deliberately breaking the room.

## What changed in the ledger

- Row 298: **LANDED → CONFIRMED**, with my station, screenshots and
  predicate re-run appended, signed W3.
- **Incidental fix:** the row was a malformed table cell — it was missing
  its closing ` |`, the only row in the file with that defect (`grep -c
  '^|' notes/LEDGER.md` stayed at 254 rows throughout; this was a
  same-row formatting bug, not a missing row). Fixed while appending to
  it, since I could not add a well-formed continuation to a malformed row
  without also closing it.

## What I did NOT find

No other LANDED rows exist to check — the ledger currently has zero. If
the desk wants broader ledger verification (re-confirming existing
CONFIRMED rows, not just LANDED ones), that is a much larger task than
"the LANDED rows" as scoped, and this item's own wording ("Verify the
LANDED rows, and the ledger generally") is ambiguous about how far
"generally" reaches — I read it as LANDED-first, general ledger health as
a lower-priority secondary lens, and spent my time on the concrete,
checkable half. Item 10 (SHA repairs) and my own item 9 pass (stale
interior coordinates) both touched "the ledger generally" already this
session, from a different angle each.

## Verified

- `npx tsc --noEmit`, `npx vite build`: clean.
- `node scripts/E-church-front.mjs`: 4/4 PASS, dev and built bundle.
- `node scripts/bugsweep.mjs` on the built bundle: zero STATION MISS, no
  new console errors.
- `grep -c '^|' notes/LEDGER.md`: 254 before and after — no row added,
  removed or split.
