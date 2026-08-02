# w4 — item 9b, export the crossing coordinates — FIXED

## Root cause (one line)
`ct/tex-ground.ts:1351-1352`'s `XA_Z`/`XA_HW`/`XB_X`/`XB_HW` (where the two
junction crossings land) were declared local to `buildGround()`'s own
closure and never exported, so item 5h — scoped read-only on this file —
had no way to reach them and copied the four numbers into `crosstown.ts`
with an explicit citation, flagging the export as a follow-up rather than
leaving a silent duplicate (GOTCHAS §56: a copied constant rots the moment
either side changes).

## What I did
Hoisted the four numbers to a new module-level export in `ct/tex-ground.ts`,
`JUNCTION_CROSSINGS = { main: { z, hw }, side: { x, hw } }`, placed
immediately before `buildGround`. `buildGround` itself now READS the same
two pairs by destructuring the export instead of declaring its own copy —
the `pedCut()` call ordering (the ordering comment already there explains
why it must run before `buildPath`) is untouched, only where the raw numbers
live changed.

**Did not touch `crosstown.ts`.** The item names only `ct/tex-ground.ts`;
per BUILDER-BRIEF §9 ("you discover you also need a file the item does not
name → stop, and report it"), replacing crosstown.ts's now-redundant copied
`const XA_Z = -90.2, XA_HW = 1.3;` / `const XB_X = 10.6, XB_HW = 1.3;` (and
its citation comment, which is now stale — the export exists) with
`import { JUNCTION_CROSSINGS } from './ct/tex-ground'` is a small, obvious
follow-up but `crosstown.ts` is desk-owned (`OWNERSHIP.md`'s SHARED list)
and not granted by this item. Flagging it here precisely so the desk can
either fold it into the next crosstown.ts-touching item or grant it
directly — it is a two-line change once granted.

## Verification
- **Structural fingerprint, before/after, per CLAUDE.md's rule for proving a
  pure refactor didn't move the world**: `npm run fp before` on the
  unmodified code, `npm run fp after` on the hoist, `node scripts/fpdiff.mjs
  shots/before.json shots/after.json` — **textures IDENTICAL (1451/1451),
  structure IDENTICAL (8352/8352, exact sorted-multiset match)**. `tints`
  differed on 3 (explained by the tool itself as the casino/hotel colour
  chase, frame-dependent, not a verdict) and `places` differed on 9, every
  one paired within 5 cm (pigeon drift — the documented noise floor,
  CLAUDE.md's own "4-6 pigeons drifting"). This is exactly what a pure hoist
  should produce: zero geometry change.
- tsc clean. `npm run build` clean (same two pre-existing, unrelated
  warnings). `bugsweep.mjs` against the built preview on :4183 — exit 0,
  zero STATION MISS, zero console errors.
- Did not re-run `scripts/crossings.mjs` as an assertion (it has no exit
  code — pure investigation script, GOTCHAS §24's other category) beyond
  confirming it still runs without throwing; its own reported "3 clusters,
  B says TWO" is pre-existing and unrelated (the fp diff already proves the
  crossing geometry did not change one bit).

## What I did NOT fix
`crosstown.ts`'s copied `XA_Z`/`XA_HW`/`XB_X`/`XB_HW` and the comment
explaining why they were copied — both now stale, since the export this
item builds makes the copy unnecessary. Precise location:
`src/proto/crosstown.ts` lines ~113-124 (the "THE GAPS ARE COPIED, WITH A
CITATION" block through the two `const` lines). The fix is
`import { JUNCTION_CROSSINGS } from './ct/tex-ground';` plus replacing the
two `const` lines with a destructure of it, deleting the now-inaccurate
"copied, not imported" comment. Queuing for whoever next holds
`crosstown.ts`.

## Derived vs. copied
The four numbers themselves are unchanged literals — moved, not retyped;
verified byte-identical by the fp diff rather than by eye.
