# w38 — item 81: separating the things that walk from the things that don't

**Root cause in one line:** citizens and vehicles are registered into the same
`colliders()` array as the masonry, so `gap.ts`'s corridor maths — which only
means something about geometry — scores corridors against things that walk away.

**Port 4196** (dev server; `gap.ts` must be served as source to import
`trapAgainst`). Proved free first, shut down at the end.

## What was already there, and what was actually missing

`actorBoxes` (a `Set`, by object identity) and `__ct.actorColliders()` already
existed from item 65, and `ct/debug-collision.ts:160` already filters with them:

```ts
const statics = actors && actors.size ? colliders.filter((c) => !actors.has(c)) : colliders;
```

**That is the right answer in the wrong place.** It fixed the overlay at one call
site, and **three of the four defects in the item's bill were written after it
landed** — because every other consumer still reads the mixed array. So the fix
here is not new logic, it is *publishing the distinction once*:

```ts
staticColliders: () => colliders.filter((c) => !actorBoxes.has(c)),
```

By **identity**, never by shape: a citizen's box is 0.5 × 0.5 and so is plenty of
real furniture, so any size test would have excused the furniture too. It returns
a **copy**, unlike `colliders()`, which deliberately returns the live array by
reference because `interiors-walk --selftest` mutates it — a derived view must
not be pushed onto.

## The three DONE WHEN conditions, measured

```
colliders 520   actors 12   statics 508      statics + actors == colliders: yes

── 20 samples, 400 ms apart, while the crowd walks ──
  A. red from staticColliders():  160..160   CONSTANT
  B. red from colliders() (all):  167..173   VARIES — this is the bug
     160 160 160 160 160 160 160 160 160 160 160 160 160 160 160 160 160 160 160 160
     171 171 171 172 171 169 169 171 171 172 172 171 173 171 169 168 167 167 167 167
```

1. **A static-only list exists and the trap maths reads it** — `trapAgainst` run
   over `staticColliders()`.
2. **Citizens walking through the measured gaps change nothing** — the static
   verdict is **160 on all 20 samples** while 12 actors walk the block. The
   unfiltered count swinging **167–173** in the same run is the defect itself,
   demonstrated live rather than argued: those 7–13 extra "traps" are pedestrians.
3. **A real static trap beside them is still caught** — planting one static box
   in a gap (`ct/bodega-corner.ts`, the citizen's own footprint made immovable,
   byte-verified and reverted) moves statics 508 → 509 and the static red count
   **160 → 162**, still constant. It did not simply stop looking.

`scripts/probes/w38-static-colliders.mjs` is the acceptance run.

## Found and NOT fixed — this is the part the desk needs

**The accessor is published and proven; the consumers are NOT all migrated.**
That is the remaining half of the item's "then have `gap.ts`/`trapAgainst` and
every walking check use it", and I stopped short of it deliberately:

1. **`gap.ts` itself cannot choose.** `trapAgainst(box, others)` is a pure
   function over whatever array it is handed — it has no access to the world, so
   there is nothing to change *in* `gap.ts`. **The choice lives entirely at call
   sites**, which is worth recording because the item names `ct/gap.ts` as a file
   to edit and there is no correct edit to make there.
2. **In-world call sites are already correct.** `debug-collision.ts` is the only
   one, and it filters locally. It could now read the accessor instead of
   re-deriving the set, which would be tidier but changes no behaviour; I left it
   rather than churn a working overlay.
3. **The instruments are the real remaining work, and they are all in
   `scripts/`** — not named by this item (BUILDER-BRIEF §9). Each currently calls
   `__ct.colliders()` and should call `__ct.staticColliders()`:
   `w24-chamfer-walk.mjs` §3 (which hand-rolls a two-snapshot "static filter"
   that this accessor replaces outright), `unstick-walk.mjs`, and the red-dump
   probes. **`w24-chamfer-walk.mjs`'s snapshot filter is worth deleting
   specifically**: it keeps a collider if its footprint is byte-identical one
   second apart, which scores a citizen who merely *stood still* as geometry —
   the accessor has no such failure mode.
4. **`unstick-walk.mjs`'s separate rotation bug is still open** (item 79): its
   `isBlocked` omits `inFrame`. Migrating it to `staticColliders()` will not fix
   that and the two should not be conflated.

## Derived or copied?

**Derived.** The actor set is the world's own, built at the two registration
hooks; nothing about actor size or type is restated here. The acceptance probe
imports `trapAgainst` from `gap.ts` rather than reimplementing the corridor
maths — the mistake item 75 existed to remove.
