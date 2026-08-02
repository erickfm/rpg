# w5 — item 5d, pews at the altar

**Root cause, one line:** the first-pew position was sized against the
altar TABLE's 0.75 m footprint (`-hd + 3.2` gave "0.425 m clearance"), which
is stale math from before `ct/int-church.ts` grew a proper chancel platform
(`CHANCEL_Z = -4.60`, a 7.4 m raised sanctuary floor with its own altar
rail) — the ledger row's own diagnosis was correct about the symptom but
was measuring the wrong obstacle.

## What I found before fixing anything

Reading the file rather than trusting the ledger's arithmetic (BRIEF §6/§7):
the room declares `floor: (lx, lz) => lz > CHANCEL_Z ? null : CHANCEL_Y-ish`
(`int-church.ts:77-81`) — real floor-height logic, not decoration. Every
other object standing on the sanctuary (the dais at `hd - 2.2`... no, that
one's dead, see below; the rail; the tabernacle) manually adds `CHANCEL_Y`
to its own `y`. The pew loop's `put(seat, ..., PEW_TOP - PEW_T/2, pz)`
never did. Since the first four rows (`pz` = -8.8, -7.75, -6.7, -5.65) all
fall inside `-12..-4.6`, they were placed as if standing on a flat floor at
y=0 while the true local floor there is 0.18 m higher — **the pews were not
just close to the altar, their legs were sunk into the chancel step.**
Confirmed by screenshot (warped to `pz - 1.0` looking at the chancel:
before the fix the pews' backs are already inside the platform edge; after,
the whole 7.4 m sanctuary reads clear from the first row).

## The fix

`ct/int-church.ts`: added `PEW_FRONT_CLEAR = 1.0` and derived
`PEW_Z0 = CHANCEL_Z + PEW_FRONT_CLEAR` (line ~200), replacing the three
places that repeated the stale `-hd + 3.2` literal — `PEW_ROWS`'s own
formula, the per-row `pz`, and `PRAY_Z` (the kneeling figure, four rows
back, which would otherwise have silently gone back to sitting on the old
row 4). Nave re-flows to 9 rows in the current 24 m room; still reads full
in a straight-down-the-nave shot.

## An unrelated leftover I noticed but did NOT touch

There is a second, dead `dais` box at `int-church.ts:~331`
(`put(dais, 0, 0.09, hd - 2.2)`) — near the **door end**, not the altar end,
despite sitting under a `// ── the altar end ──` comment. The file's own
later comment block (`~500-521`, "the note that used to be here") narrates
building a chancel at the wrong end once and reverting it; I believe this
box is the un-removed remnant of that first attempt, now redundant with the
real chancel platform built later in the same function (`~448-498`, which
uses `CHANCEL_Z`/`CHANCEL_Y` correctly). I textured this box's top face in
an earlier item today (0a, the shadow-geometry census — it was a flat
unmapped quad) without noticing the placement question; having now read the
surrounding chancel code for *this* item, I think it may be orphaned
geometry that should be deleted rather than kept. **Not in scope for either
item as claimed** (0a named `ct/paint.ts` callers world-wide, not
"redesign a room"; 5d is specifically the pew/altar clearance) — flagging
precisely so the desk can queue a look at whether that box is meant to be
there at all.

## Verification

- `interiors-walk.mjs church`: 25/25 on dev (`4184`).
- `interiors-walk.mjs bank` on the built preview (`4195`) throws
  `Failed to fetch dynamically imported module .../doors.ts` — same crash on
  an unrelated room, so it is a pre-existing limitation of that script
  against a production build (it appears to dynamically import a raw `.ts`
  source path from the page, which only resolves under Vite dev), not
  something this change caused. Did not attempt to fix it — outside this
  item's claim (`ct/int-church.ts` only) and it may already be
  queue item 9's territory ("the full check suite kills its own preview
  server", currently DOING w1).
- `gaps.mjs --all`: no corridor trap reported near church (x=760).
- `bugsweep.mjs`: clean on dev and the built preview (`4195`), zero new
  console errors.
- `npm run build` (`tsc --noEmit && vite build`): clean.
- Screenshots (not committed, `/tmp/w5-church3/`): the nave from the door
  end still reads full; standing at the new first-row position and looking
  at the altar shows the entire 7.4 m sanctuary clear, no pew back visible
  in frame.

## Derived vs. copied

`PEW_FRONT_CLEAR = 1.0` is a new number, sized by analogy to `REAR_CLEAR`'s
own 1.2 m "stand and use it" clearance already in the same file (not
re-derived from a formula, since there isn't one to derive from — it's a
design choice, same as the file's other hand-picked clearances). `CHANCEL_Z`
itself is imported by reference (the existing `const`), not retyped.
