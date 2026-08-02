# Builder I — the lot's missing collider, fixed at the path

## The defect, as reported

The user turned on the new V collision overlay and screenshotted the used car
lot: every car had a green wireframe box except the foreground one, which had
none — walkable straight through. The desk measured it on build `337e15aa5`:
14 car groups, 11 car-sized colliders, with **nothing registered at
x = 11.6, z = −3.4** — bay 1, the hood-up car, `ct/lot.ts`'s own "S, first bay
you pass".

## Why it happened — named precisely

`ct/lot.ts`'s stock-placement loop (around line 1930) built every car, then
ran a `switch (it.treat)` to put a windscreen price on it, then set the car's
final position and called `scene.add` + `solid(...)` — the one line that
registers the car's `AABB` in the world's collider list. The hood-up car's
branch was written as an **early exit** that positioned the group, added it
to the scene, and `continue`d, one statement before that shared tail:

```ts
const state = NOT_PARKED.get(b);
if (state?.hood) { g0.position.set(x, Y, z); g0.rotation.y = yaw; scene.add(g0); continue; }
switch (it.treat) { /* ... */ }
g0.position.set(x, Y, z);
g0.rotation.y = yaw;
scene.add(g0);
solid({ minX: x - 1.4, maxX: x + 1.4, minZ: z - 2.0, maxZ: z + 2.0 });   // <- never reached by the hood car
```

An open hood has no windscreen to put a price sticker on (the comment above
the switch says so explicitly — the price card and the raised bonnet want the
same volume), so the branch had a real reason to skip the switch. It did not
have a reason to skip `solid()`, but `solid()` lived *after* the switch rather
than before it, so skipping one skipped both. The plain stock — every car that
had ever been walked into before the overlay existed — never took this branch,
so the gap was invisible until the overlay drew it.

## Checked beyond bay 1, as asked

The brief named two other dressed paths at risk: `jack: 'fr'` (the car up on
a jack with a wheel off, north back corner) and `blocks: true` (the donor on
blocks, south back corner). Neither takes an early `continue` — the `jacked`
block only *adds* a leaning-tyre prop to `g0` and falls through to the same
switch and shared tail as ordinary stock; `blocks` is handled entirely inside
`cars.ts`'s `makeCar` (it doesn't touch `NOT_PARKED` in `lot.ts` at all). Both
already reached `solid()` before this fix. Confirmed by measurement, not just
by reading the branch: before the fix, 26 in-lot colliders and only the hood
gap; after, 27, with the added box exactly where the hood car stands and no
new gap anywhere else in the lot (see "traps" below).

## The fix — at the shared path, not per-car

`solid(...)` now runs **once, unconditionally, immediately after `x, z, yaw`
are read for the bay** — before the group is even constructed, and before any
per-bay branch (`hood`, `jack`, or a fourth kind nobody has written yet) can
run. The hood branch's early `continue` is gone; it's now `if (!state?.hood)`
wrapping just the switch, with the position/rotation/`scene.add` tail shared
by every car regardless of dressing. There is no longer a path through this
loop that can add a car to the scene without also registering its collider —
which is the point: the next dressed bay cannot repeat this bug by
construction, rather than by someone remembering to call `solid()` in the
right place again.

Changed: `src/proto/ct/lot.ts`, the `placeLot` stock loop (~line 1930–2020).
Committed on top of `40ee8400a`.

## Car count vs collider count

Measured live (`window.__ct.scene()` / `window.__ct.colliders()`, filtering
car-sized boxes as 2.8 m × 4.0 m — the exact footprint `solid()` writes):

| | before | after |
|---|---|---|
| car groups placed | 11 | 11 |
| car-sized colliders | 10 | **11** |
| collider present at (11.6, −3.4)? | no | **yes** |

(The desk's "14 groups" figure was from a different build; this checkout's
`STOCK`/`BAY` geometry places 11 cars — one bay, index 2, is deliberately
empty. The gap itself — exactly one missing collider, exactly at bay 1 — is
identical.)

## Trap check

`ct/gap.ts`'s `trapAgainst` against the newly-added bay-1 collider returns no
trap against any neighbour. A full pairwise scan of the lot's colliders finds
**3 sub-0.95 m corridors**, all three present identically before and after
this change (verified by stashing the fix and re-measuring) — they are
pre-existing, near the frontage fence posts/step and near the tyre stacks at
the back, and none involve the bay-1 collider. Adding the missing box did not
create a new red gap.

## Walk evidence

Simulated with `window.__ct.warp` + synthetic `keydown('w')`, holding forward
for 4 s toward each car from a verified-clear starting point (`scripts/I-lot-walk-verify.mjs`):

| car | before fix | after fix |
|---|---|---|
| hood-up (bay 1, 11.6, −3.4) | walked **8.58 m** through it and out the other side | stopped after **0.99 m**, at the collider edge |
| jacked (N back corner, 26.65, 7.3) | stopped after 0.88 m (already fine) | stopped after 0.89 m |
| blocks/donor (S back corner, 26.65, −2.1) | stopped after 0.85 m (already fine) | stopped after 0.84 m |

The "before" column was captured by `git stash`-ing the fix against the same
running dev server, to prove the walk test actually detects the original bug
rather than passing by construction.

## Verify

- `npx tsc --noEmit -p .` — clean.
- `SHOT_URL=http://localhost:4198/ node scripts/bugsweep.mjs` — zero STATION
  MISS, no new console errors (only the pre-existing THREE.Clock deprecation
  and Canvas2D `willReadFrequently` warnings, unrelated to this change).
- `scripts/I-lot-collider-count.mjs` and `scripts/I-lot-walk-verify.mjs` are
  new ad-hoc verification scripts, left in the tree for the next person who
  touches this lot.
