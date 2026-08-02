# Collision debug view — press V

*"can we implement a debug mode where i press a toggle to view collision?"*

New file, builder-owned: `src/proto/ct/debug-collision.ts` (`ColliderDebug`).
Bounded desk exception used, exactly as scoped — two lines in `src/proto/fp.ts`
(one `export` keyword) and the toggle's wiring + one draw call in
`src/proto/crosstown.ts`. Nothing else in either file touched: no movement, no
collision resolution, no `unstick()`, no `pickSpot`.

## The key: V

Checked what `src/main.ts`, `fp.ts` and `crosstown.ts` already bind before
picking one: `w a s d shift c space e` (movement), arrow keys + escape
(look/exit), `rmb` (wallet), `x z [ ]` + digits 0–9 (proto switcher, in
`main.ts`), `i` (inventory) and `g` (drop last item, in `ct/inventory.ts`). `v`
was free. Mnemonic: **v**iew collision.

It is read the same way `rmb` and `e` already are — an edge-triggered check on
`input.keys` inside `crosstown.ts`'s own `update()` — so no new global
listener was added anywhere, including `main.ts`.

`window.__ct.debugCollision(on)` / `debugCollisionOn()` also exist, same shape
as the pre-existing `debugSpots`, so a script can drive it without simulating
a keypress.

## What it draws

Exactly what `window.__ct.colliders()` already returns — the live array
`FPRig.blocked()` in `fp.ts` is actually blocked by — as wireframe boxes, one
per collider, plus one for the player's own footprint:

- **green** — an ordinary collider
- **red** — flagged by `ct/gap.ts`'s own `trapAgainst()`, the SAME function
  that constrains the parked-car draw at build time. A collider forming a
  corridor under 0.95 m against a neighbour reads red. This is deliberately
  the existing rule, not a second number invented for the viewer: the overlay
  cannot disagree with what the world already enforces.
- **blue** — the player's own collision footprint. `blocked()` expands every
  collider by `RADIUS` independently on X and Z — a **square** Minkowski sum,
  not a circle — so it is drawn as a cube of side `2*RADIUS`, not a cylinder,
  because that is the actual shape the movement code tests against.

Box height is a fixed 2.4 m for every collider, anchored at the player's
*current* floor (`apt.gy()`, read-only — never `setGy`). This is not a
measurement of anything: colliders carry no Y at all, and `blocked()` never
tests one — a collider is solid at every height a player can stand at. 2.4 m
is just tall enough to read as a wall rather than a kerb. Anchoring at the
player's own floor is what makes upper-storey interiors (the jail cells,
below) show their walls correctly instead of drawing 3 m underground.

Wireframe, not solid fill, because the brief is explicit and correct: **the
point is to compare the collider to the thing it claims to represent**, and a
filled box hides the geometry you're trying to see through it.

## Two things this file does NOT do, and why

- **It does not try to flag "collider much bigger than its object" or
  "collider with no object inside it" automatically.** The AABB list carries
  no reference back to the mesh it wraps, so there's no cheap generic test for
  either. The wireframe-and-see-through choice already covers both: standing
  in the overlay and looking, a human sees a hydrant collider that's twice the
  hydrant, or an empty box with nothing in it, immediately. Automating that
  would need colliders to start carrying an object reference, which is a
  storage change outside this file's mandate — reporting it here rather than
  making it, per the brief.
- **It does not call into the floor picker (`groundPick`/`apt.setGy`) at all.**
  `apt.gy()` (read) is safe and already read elsewhere in `crosstown.ts`'s
  frame loop; `setGy` is the one writer of the floor hysteresis (GOTCHAS §7)
  and calling it from a debug overlay for 500+ colliders a frame would
  repeatedly stomp that state right before the next frame's own movement code
  reads it. Anchoring every box at the player's own current floor sidesteps
  needing per-collider ground height at all.

## Cost when off — measured, not asserted

**Scene, at the object level:** `scripts/debug-collision-verify.mjs` presses
V, confirms the scene grows by exactly the collider count + 1 (527 colliders
+ player box, on this build), presses V again, and asserts the scene object
count returns to **exactly** the baseline — not "close to", equal:

```
baseline: debugCollisionOn=false, scene objects=8417
after V:  debugCollisionOn=true,  scene objects=8946 (+529)
after 2nd V: debugCollisionOn=false, scene objects=8417
ALL OK
```

**The shared Math.random draw stream, not just the scene:** the first version
of this file created its `EdgesGeometry`/`LineBasicMaterial`s as module-level
`const`s. Since `crosstown.ts` imports the module unconditionally, that meant
five THREE objects were constructed at **import time**, before a single tree
or texture is built — and three.js burns four `Math.random()` calls per
object in `generateUUID` (GOTCHAS §2, §31). That shifted the grain of every
texture painted afterwards even with the overlay never toggled:
`npm run fp before`/`after` disagreed on `textures`/`structure`/`places` with
**identical object counts** — the classic "moved the world without adding
anything to it" signature. Fixed by making the geometry and materials build
lazily, on the first real `on: true` call, ever (`shared()` in
`debug-collision.ts`). Re-measured after the fix, same server, same build,
overlay never touched:

```
textures   1441 vs 1441 — IDENTICAL
structure  8417 vs 8417 — IDENTICAL
tints      8417 vs 8417 — 3 differ  (casino/hotel chase lights — documented noise)
places     8417 vs 8417 — 3 differ  (pigeons, all within 5 cm — documented noise)
```

`textures` and `structure` — the two CLAUDE.md actually asks to match — are
bit-for-bit identical. The only differences are `fpdiff.mjs`'s own
already-documented noise floor.

## Verification

- Dev server: `npx vite --port 4194`, `SHOT_URL=http://localhost:4194/` on
  every check (GOTCHAS §48/§26 — 4177 is somebody else's server).
- `npx tsc --noEmit`: clean.
- `node scripts/debug-collision-verify.mjs`: toggle behaviour + exact
  scene-count round-trip, above. `ALL OK`.
- `npm run fp before` / (edit) / `npm run fp after` / `fpdiff`: `textures` and
  `structure` IDENTICAL, per above.
- `node scripts/bugsweep.mjs`: 93 shots, exit 0, zero STATION MISS, only
  pre-existing console warnings (THREE.Clock deprecation, Canvas2D
  `willReadFrequently`, a GPU-stall perf note) — no new errors.

Screenshots in `shots/debug-collision/` (gitignored, local only):

- `on-jail-exterior.png` — the motivating case. Standing in the side street
  looking straight down the jail's own door axis: its footprint reads as a
  green box dead ahead, LOANS and the casino flanking it, distinguishable from
  the buildings' painted facades.
- `on-jail-interior.png` / `off-jail-interior.png` — same spot, inside the
  jail's own cell block, overlay on vs off. On: the cell bars and walls trace
  in green, and one tight spot near a bunk reads red — a real corridor under
  0.95 m worth a look, found by the tool doing exactly its job. Off: nothing,
  pixel for pixel the ordinary room.
- `on-street-cars.png` — a stretch of the side street: a parked car's box
  hugging its body, a lamp post, tree-pit colliders, and a cluster of red
  boxes by a shopfront corner.
- `on-spawn.png` — the walk-up on load, overlay on, for a baseline look.

## If this needs to change

- Box height (`BOX_H`, 2.4 m) and the trap threshold (via `ct/gap.ts`'s
  `PASSABLE`, 0.95 m) are the two numbers most likely worth tuning later —
  both are named constants, not buried literals.
- If colliders ever start carrying an object reference (a desk-level storage
  change), the two flag types this file couldn't do cheaply — oversized and
  empty colliders — become straightforward additions to `update()`.
