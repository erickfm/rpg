# w12 — item 5j: four leftover trap corridors near the library

**Root cause (one line):** four objects in the library were placed close
enough to their nearest neighbour that the walkable gap between their
colliders fell inside `gap.ts`'s trap band (0.40-0.95 m — wide enough to
step into, too narrow to turn round in), all four originally measured and
named (with exact world coordinates) by w4 while fixing item 5g but out of
that item's scope. Re-measured on this checkout first (BUILDER-BRIEF §6/§7)
using the same live `__ct.colliders()` + `corridor()` probe w4 used, filtered
to the library's own room bounds (`cx=1080, cz=0`) with a 20 m margin — all
four were still exactly where w4 reported them, unchanged since.

## The four, and the fix for each — spread, not subtracted

Nothing was removed; every fix widens the gap by moving or resizing the
object slightly, keeping it in place and functional.

1. **OPAC bench vs. the dot-matrix printer stand**, 0.44 m clear
   (`ct/int-library.ts`, "the dot-matrix printer" block). The stand sat at a
   hand-typed `BZ1 + 0.85` behind the bench. Now derived from the bench's own
   collider back face (`BZC + (BL + 0.1) / 2`) plus `PASSABLE` plus a 0.10 m
   margin plus the stand's own half-depth (0.36) — moves the stand back
   ~0.6 m.
2. **Returns trolley vs. the issue desk's U-collider**, 0.64 m clear
   ("THE THINGS THAT SAY THE ROOM IS USED" block). `TR_X` was a hand-typed
   `-0.9`. Now derived from the desk's own east face
   (`DESK_X + (DESK_W + 0.1) / 2`) plus `PASSABLE` plus 0.10 m plus the
   trolley's own half-width (0.31) — moves it ~0.4 m further east, still "at
   the open east end of the desk" as the comment describes.
3 & 4. **Both on the gallery deck**, the elevated shelf-against-the-wall
   run: the wall-to-first-run gap (0.46 m) and the gap deliberately left
   "so the deck reads as having a middle" between the two runs (0.92 m).
   Both z0/z1 pairs were hand-typed (`deckZ0 + 0.5`, `-6.4`, `-5.4`, `-1.4`).
   Replaced with `shelfZ0`/`shelfMid0`/`shelfMid1` derived from `PASSABLE`
   plus a compensation term for `wallRun`'s own `solid()` padding (it grows
   each run's collider by 0.08 m total, 0.04 m past each end, which is why
   the *nominal* 0.5 m and 1.0 m gaps measured 0.46 m and 0.92 m *actual*
   clear — a fixed literal would have needed to guess that margin; deriving
   it means the fix is provably right, not just bigger). Each run trims by
   0.2-0.6 m at the end facing the gap; both runs stay, same seeds, same
   "the deck has a middle" break, just wide enough either side of it.

## Verification, my own

- Re-ran the exact w4-style probe (`__ct.colliders()` + `__ct.corridor()`,
  filtered to the library room, ENTERABLE/PASSABLE read from
  `__ct.gapRule()`) before and after: **4 trap-band corridors → 0**, same 33
  colliders in range both times (nothing added or removed, only repositioned
  / resized).
- **Checked for the failure a trap-band filter alone would miss: did any fix
  push two colliders into overlap?** Ran a separate overlap scan (any AABB
  pair overlapping on both axes) before (`git stash`) and after: **identical
  9 overlaps both times**, all pre-existing wall-corner/balustrade-post
  meetings unrelated to any of the four objects touched here. None of my new
  coordinates appear in either list.
- `npx tsc --noEmit` and `npm run build` both clean.
- `node scripts/interiors-walk.mjs library` — **25/25**, unchanged from
  before the fix (dev server on :4193).
- `node scripts/bugsweep.mjs` against the **built** preview (:4183) — zero
  STATION MISS, zero new console errors (only the pre-existing THREE.Clock
  deprecation / Canvas2D readback / WebGL-teardown warnings every sweep
  reports).
- Looked at the gallery deck and the returns-trolley corner from a few
  angles in the running world; both read as before — a shelf run with a
  gap in the middle, a trolley beside the desk — just no longer pinched.

## Not fixed / found

Nothing new. This closes exactly the four traps w4 named; no other trap-band
corridor turned up in the library-room scan (0 remaining in range).

## Derived, not copied

Every new coordinate is an expression in terms of `PASSABLE` (imported from
`ct/gap.ts`, already used elsewhere in this file) and the neighbouring
object's own already-declared position/size constants (`BZC`, `BL`,
`DESK_X`, `DESK_W`, `deckZ0`) — no literal was retyped, and the `wallRun`
padding term (`WALLRUN_PAD = 0.04`) is named and explained rather than
folded silently into a bigger magic number.
