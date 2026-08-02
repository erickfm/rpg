# Interior people: the adoption row was already done — two real bugs found and fixed instead

The ledger row (`OPEN | F+G | interior people, THE ADOPTION HALF`) reads "0 of 10
`int-*.ts` files call `citizenSprite`". That count is a grep artefact, and it was
already reported stale twice before I picked this up
(`notes/archive/M-interior-people-adoption.md`, and commits `88e790882`,
`b5ebb9a60`, `788e73773`). **All 12 `int-*.ts` files call the atlas** — 11 of them
through `room.person()` (`ct/interior.ts`'s wrapper, which calls `citizenSprite`
unconditionally), and the casino also calls `citizenSprite` directly for its
dealer, lounge sitter and four slot players. Nobody in this world is a
hand-painted plane any more; `grep -ln PlaneGeometry src/proto/ct/int-*.ts` and
filtering for ones with no atlas call returns nothing.

So I did not spend this session hand-converting flat people — there weren't any
left to convert. I spent it **verifying that claim against the live world**
(GOTCHAS 49: published is not adopted, and a row can read CONFIRMED and be
untrue), and that surfaced two real bugs that adoption-by-grep cannot see:

1. **The casino's dealer, lounge sitter and four slot players (5 of 6 figures in
   the room) were invisible to every people-sweep in the codebase** — correctly
   drawn, correctly facing, but built through `citizenSprite` directly rather
   than `room.person()`, which skipped the `userData.citizen`/`.seated` tag the
   kit sets. `ct/interior.ts`'s own comment says that tag is the only thing that
   tells a person from the thrift's mannequin. Fixed in `int-casino.ts`'s
   `sitter()` helper — one place, all five callers get it at once.
2. **The thrift's keeper was invisible to a PLAYER, not just to a sweep** — she
   stood 5 cm inside the back wall's own collider volume (a copy-paste offset,
   `KEEP_AT = TILL_Z - 0.55`, that overshot the 0.5 m gap between the till and
   the wall), and a full-width "folded goods" shelf added later ran straight
   through the till's footprint on top of that, so even moving her forward
   still put her inside the shelf's goods plane. No camera position anywhere in
   the room had line of sight to her. Fixed both: the offset (`-0.4`, now
   documented against the actual gap) and the shelf (split into two runs with a
   gap at the till, same total shelving, none of it through the counter).

Both were found the same way: a scene traversal for `userData.citizen` meshes
plus a line-of-sight camera search, not a screenshot from one angle — see
"How I verified" below, and `scripts/interior-people-close.mjs`, which is now a
reusable check for this.

## Rooms verified — all 12, this is not a partial pass

| room | keeper/figures | facing | seated/standing | verdict |
|---|---|---|---|---|
| bank | 3 tellers + loan officer | derived from the window/desk | standing + seated | correct |
| bodega | 1 keeper | derived, `atan2(CTR_X-KEEP_AT,0)` | standing | correct |
| burger | 1 crew member | derived from counter | standing | correct — this is the room the user's "always facing away" complaint named; confirmed now facing the customer floor |
| casino | dealer + lounge sitter + 4 slot players | derived per-figure (table/machine) | standing + seated | correct visually; **tag bug fixed** (see above) |
| church | 1 pew sitter | — | seated | correct, occluded by the pew back as expected from behind |
| diner | waitress + 2 booth sitters | derived from counter | standing + seated | correct — this is the room the fix pattern started from |
| hotel | 1 clerk | derived, `atan2(dx, 0)` from the desk | standing | correct |
| jail | desk clerk + property clerk + 1 inmate | derived | standing + seated at cell table | correct, no clipping through the table |
| library | 4 (desk clerk + 3 seated readers) | derived, this took 3 passes historically (`int-library.ts` comments) | standing + seated | correct — this is the room the "librarian orientation" complaint named; already fixed by J |
| pawn | 1 broker | derived from counter | standing | correct |
| tax | 1 preparer | derived | seated at desk, client-facing | correct |
| thrift | 1 keeper | derived, `atan2(0, TILL_Z-KEEP_AT)` | standing | **was invisible — fixed, see above** |

All 12 read as: not flat (full 8-angle atlas, turns as you walk around), not
floating (kit places standing figures at floor y and seated figures at the
seat's own top, per `ct/interior.ts`'s comment — no hand-typed y offsets found
anywhere in the 12 files), and — after the thrift fix — not clipping or hidden.
The user's specific complaint about the casino blackjack seat clipping was
already fixed before this session (`ct/interior.ts`'s comment: "the height the
stool actually is rather than the height it used to claim") and I re-confirmed
it holds: the dealer stands correctly at the felt, slot players sit at
`STOOL_TOP`, no clipping visible from any close-up angle.

**Facing is derived, not typed, everywhere I checked.** Every keeper's facing is
`Math.atan2(...)` against the counter/desk/table position, not a literal angle,
and every file that has one carries the same comment explaining the
`atan2(vx,vz)`-with-0-facing-+z convention and the "back wall" bug it used to
produce. I did not find a single hand-typed facing constant among the 12 rooms.

## How I verified (not from one screenshot angle)

1. `SHOT_URL=http://localhost:4187/ node scripts/bugsweep.mjs` — 93 shots, the
   generic entry/far/wide per room, **zero STATION MISS, zero new console
   errors**, both before and after my fixes.
2. `scripts/interior-people-close.mjs` (new — I wrote this) — traverses the live
   scene for every `userData.citizen` mesh, clusters them by room and by
   proximity within a room (so the jail's spread-out guard/inmate don't get
   averaged into one meaningless midpoint), and for each cluster searches for a
   standable point with an unobstructed 2D line of sight, the same technique
   `scripts/aim.mjs` uses for cars and benches. This is what actually found the
   thrift bug — the generic bugsweep stations never happened to look at her, and
   neither did I on the first three attempts, because the camera search kept
   finding degenerate near-the-wall angles until I widened the preferred
   distance. It reports a MISS rather than guessing (GOTCHAS 50).
3. Confirmed both fixes hold in the **built bundle**, not only dev
   (`npm run build && npx vite preview --port 4201`), per GOTCHAS 28/37 — dev and
   the bundle resolve module cycles differently and a fix that only works in dev
   is not shipped.
4. Ran the room's own existing check, `scripts/interiors-walk.mjs thrift`, after
   the fix: **30/30 passed**, including `"thrift: the keeper is looking at you,
   not away"`. That check already existed and already asserted this; it could
   not have passed against the pre-fix world.
5. `scripts/roomaisle.mjs` and `scripts/world-wired.mjs` both still clean after
   the thrift shelf split — the aisle numbers are unchanged (median 8.8 m, same
   as the pre-existing interior audit recorded) because the split shelving lives
   entirely in staff-only space behind the counter, never in the customer aisle.

## Rooms I did NOT touch, and why

- **`int-bank.ts` (M's), `int-jail.ts` (O's), `int-library.ts` (J's)** — verified
  only, no defects found, so nothing to report against another builder's file.
- **`int-church.ts`** — no owner listed in `OWNERSHIP.md`; verified only, same
  as above.
- Everything else I touched (`int-casino.ts`, `int-thrift.ts`) is G's and F's
  respectively, both named in this row's own owner field.

## Files changed

- `src/proto/ct/int-casino.ts` — tagged the `sitter()` helper's output
  (`userData.citizen`/`.seated`), fixing 5 of 6 casino figures being invisible
  to people-sweeps. No visual change.
- `src/proto/ct/int-thrift.ts` — moved the keeper 0.15 m forward, out of the
  back wall's own collider; split the "folded goods" shelf into two runs around
  the till instead of one run through it. Visual change: the keeper is now
  visible from the customer side of the counter, which she was not before.
- `scripts/interior-people-close.mjs` — new verification script (see above),
  kept for the next person who needs to check this rather than trust a grep.

## For the desk

The ledger row's stated fault (0 of 10/12 call the atlas) has been wrong since
at least `788e73773` (2026-07-26) and is fully closed now that the two real
gaps it was standing in for are fixed. Recommend closing it CONFIRMED against
this note plus the three prior measurements, not reopening it — a fourth
re-measurement of the same true claim is not what was missing here.
