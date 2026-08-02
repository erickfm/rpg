# w12 — item 9e: point crosstown.ts at JUNCTION_CROSSINGS instead of copying it

**Root cause:** `crosstown.ts` carried a hand-typed copy of the crossing gap
coordinates (`XA_Z`/`XA_HW`/`XB_X`/`XB_HW`), copied from `tex-ground.ts` back
when item 9b was still in flight and that file's constants were local to
`buildGround()`'s closure — not because the values were ever wrong, but
because the module doing the copying had no way to import them yet. w4 landed
the fix for that half (item 9b: hoisted `JUNCTION_CROSSINGS` as a real
`export const` in `ct/tex-ground.ts`) and correctly left `crosstown.ts`'s
copy in place, since that item's grant did not include this file. This item
closes the loop.

**Fix:** `crosstown.ts` now imports `JUNCTION_CROSSINGS` from `./ct/tex-ground`
and destructures `XA_Z`/`XA_HW` from `.main`, `XB_X`/`XB_HW` from `.side`,
deleting the hand-typed literals and the stale comment explaining why they
were copied. Same two files (`crosstown.ts`, `ct/tex-ground.ts`) named by the
item; nothing else touched.

**Verification, my own:**
- `npx tsc --noEmit` and `npm run build` both clean.
- Pure-refactor proof via `scripts/scenedump.mjs` + `scripts/fpdiff.mjs`
  (SHOT_URL=http://localhost:4193/): captured "after" (fix applied), then
  `git stash` to get "before" (pre-fix code) against the same running dev
  server, `git stash pop` to restore. `textures` and `structure` hashes are
  **byte-identical** (1450 vs 1450, 8351 vs 8351 objects, same hash both
  runs). `tints` differ by 3 meshes — the documented casino/hotel colour-chase
  animation, not a structural change. `places` differ by 1 mesh, drifted
  <5 cm — a single pigeon, under the project's noise floor (4-6 documented as
  normal). No trace of the crossing lines themselves moving.
- `node scripts/health.mjs` — WORLD OK, `__ct` initialised, zero console
  errors, on the built dev server.

**Not fixed / found:** nothing new. This was a pure hoist-and-point, exactly
as scoped.

**Derived, not copied:** the fix's entire point was to stop copying — the
values now come from the single export in `ct/tex-ground.ts:1336`.
