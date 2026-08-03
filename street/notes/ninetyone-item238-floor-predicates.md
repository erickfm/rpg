# Item 238 — the three floor predicates, reconciled

**Worker ninetyone, 2026-08-03. Port 4470** (4180–4199 was not used; 4186 was
taken). Built bundle, `vite preview --strictPort`, verified with `ss -ltn`.

## The short version

There were never three predicates. There were **two**, and the third was a
copy-paste of the first. The two that were real disagree on **19,237 of 731,322
cells, in BOTH directions** — which contradicts the standing account of why
they differ. **Neither is clean.** The raycast wins anyway, and the reason is
not the one the item assumed.

| | |
|---|---|
| leg 1 | `scripts/lib/floors.mjs` `makeHasFloor` — **AABB** |
| leg 2 | `scripts/w75-site-contained.mjs` inline — **AABB, byte-identical to leg 1** |
| leg 3 | `scripts/world-contained.mjs` sweep — **RAYCAST** |

## What was measured

`scripts/probes/w91-floor-predicate-reconcile.mjs` — one page load, one point
set: **every cell of the 2802 × 261 = 731,322-cell world grid at 0.5 m**, both
predicates asked at the same (x, z) with the same `groundAt`-centred band. Both
pass their own two-sign controls first, and the run refuses to compare them if
either fails. The comparison asserts its own population.

```
both say FLOOR        35221
both say VOID        676864
AABB floor, ray VOID  11948
ray floor, AABB VOID   7289
agreement             97.37%
```

### eightyfive's stated reason for the difference is half wrong

`w85-item230-aabb-vs-raycast.mjs:6-8` says a bounding box *"can say 'floor'
where there is none and **can never say 'void' where there is floor**"*. My
assertion demanded exactly that (`rayOnly === 0`) — **and it went red.**

The cause is not the box, it is the **filter in front of it**. `makeHasFloor`
only ever sees meshes surviving `lib/floors.mjs:56-57` (thin in Y ≤ 0.6 m, ≥ 1 m
across). The raycast filters nothing. **7,513 of the scene's 7,870 meshes are
read by the raycast and never looked at by the AABB predicate.** No reasoning
about bounding-box containment can reach that, because those boxes were never
computed.

### …and my own first explanation of the under-claim was wrong too

I guessed it was all the park and asserted `>= 90%`. **It went red at 15.8%.**
Attributing every under-claimed cell to the mesh that floors it
(`w91-where-is-the-underclaim.mjs`):

```
totals by reason the mesh was excluded from the AABB predicate:
   7232  THICK          54  SMALL          3  THICK+SMALL

   1393  BoxGeometry 21.6x4.20x16.0 @ x-29…-7  z-37…-21
   1203  BoxGeometry 15.9x4.20x19.2 @ x-23…-7  z-5…14
   1162  BoxGeometry 23.5x4.20x12.0 @ x-31…-7  z-56…-44
   1118  PlaneGeometry 32.0x0.65x30.0 @ x-39…-7 z-98…-68    <- the park
```

Those 4.20 m boxes are **buildings**. The raycast is reading the **underside of
a solid building** as something to stand on. So the under-claim is mostly a
**raycast false positive**, not an AABB miss.

## Why the raycast is still the authority — measured, not argued

`scripts/probes/w91-can-anyone-stand-there.mjs` tests every disagreeing cell
against `__ct.colliders()` padded by the player's 0.36 m radius:

```
ray-only cells inside a padded collider   6738 / 7289    92.4%
box-only cells inside a padded collider   1388 / 11948   11.6%
```

**Their errors land in different places.** The raycast's are sealed inside
buildings where no body can be, so the containment fill never asks about them.
The boxes' errors are on **open ground the player walks over — 88.4% of them** —
which is exactly where a containment check has to be right. That asymmetry is
the authority argument, and it is a check that can fail if it ever stops holding.

## The park: real, and NOT the emergency I first wrote down

Item 172 gave the park topography **this morning**, relief 0.366 → 0.633 m
(`ct/park.ts:648`). Its ground plane's world box is **0.653 m**; the AABB
threshold is **0.600**. Over by **53 mm**, so the park's 32 × 30 m ground plane
and its 17.75 × 16.5 m field are invisible to the AABB predicate
(`w91-park-ground-thickness.mjs`).

### The park check WAS red, and it took an A/B run to prove it

I nearly shipped this wrong in **both** directions, so the sequence is worth
keeping:

1. I claimed "the park leg was about to go red." No evidence.
2. I built `w91-park-would-have-gone-red.mjs` to prove it. It refused — 0 of 4,
   then 0 of 14 in-park standing positions read void to the old predicate — so I
   **withdrew the claim** and wrote the withdrawal into the note.
3. Then I ran the **actual pre-change file** (`git show 9bff8791e:` …) against
   the same world, which is the only test that settles it:

| leg | OLD predicate (AABB) | NEW predicate (raycast) |
|---|---|---|
| lot | 0 escapes / 408 walks — **PASS** | 0 escapes / 336 walks — **PASS** |
| park | **60 escapes / 624 walks — FAIL** | 0 escapes / 544 walks — **PASS** |
| jail | — | 0 escapes / 136 walks — **PASS** |

```
FAIL  the player cannot walk out of the world at the park
      60 of 624 walks ended ON NO FLOOR — x -19.59…-7.73  z -96.26…-68.37
```

**So the claim was true, and my own probe was the liar.** It walked straight
west from 8 starts; the real check is a **flood fill that fans out in 8
directions from every cell it reaches**, so it gets onto open grass that a
straight line never touches. A probe that examines only the route its author
thought of reports green about everything they did not — GOTCHAS 79, committed
by me, inside the very item about predicates that lie.

The lot was **already green** with the old predicate, so the conversion did not
turn a correct red into a green. `floors.mjs`'s header calling w75 "correctly
red at the lot" is stale — that was true when item 226 was written and is not
true now.

### The latent half, on ground nothing currently walks

Measured on a 1.5 m lattice across the park interior (**warped, not walked** —
a statement about the predicates, not about reachability):

```
points sampled                     342
OLD (AABB) says NO FLOOR            57
NEW (raycast) says NO FLOOR          0
clear of every padded collider     298
clear of colliders AND old-void     43   <- a body fits here and the old
                                            predicate calls it the void
```

43 lattice points of open park a body can stand on that the AABB predicate calls
empty space — the same defect the flood fill found 60 real escapes in.

**All three converted legs are green:** jail 0/136, park 0/544, lot 0/336,
"all contained", 0 console errors, exit 0.

## What changed

1. **`scripts/lib/floors.mjs`** — the raycast sweep hoisted in from
   `world-contained.mjs` verbatim (`sweepFloorsRay`, `makeFloorAtRay`), plus a
   new **exact point query** (`installRayFloorQuery` / `selfTestRayQuery`).
   Both answers now live in one file, so nobody compares two vintages again.
2. **`scripts/world-contained.mjs`** — calls `sweepFloorsRay`; its 112-line
   inline copy is gone. **Pure move, proved:** output byte-identical to the
   pre-hoist baseline (20386 reachable cells, 0 over nothing), and `--selftest`
   still bites (2034 meshes dropped, road reads VOID).
3. **`scripts/w75-site-contained.mjs`** — decides floor by **raycast**; its
   inline AABB predicate is gone. Park leg re-run green.
4. **The phantom citation is deleted.** Its header claimed *"there is real
   pavement out to z 16.75 — I walked out there and photographed it
   (`shots/w75-escape-z17.png`)"*. **That PNG is in no tree and no commit** —
   `git log --all -- ...` returns nothing. The 16.75 figure was itself a
   bounding-box over-claim; the drawn floor stops at z 14.0. The conclusion it
   supported (a site rectangle is not the world's edge) survives; the number and
   the photograph do not.

The probe also asserts that **neither caller may re-grow its own predicate** —
paste an inline AABB pass back into either file and it goes red.

### Why the exact query and not the grid

`makeFloorAtRay` snaps to the nearest 0.5 m cell. A walk does not land on cells,
and **eightytwo's doubt was right in principle**: the party-wall gap is 0.30 m
wide (x 879.85…880.15) and the 0.5 m grid puts **exactly one sample column
inside it, by luck of phase** — a 0.30 m interval need not contain a multiple of
0.5 at all. So walk callers get arbitrary precision; the triangle index is built
once and left in the page, one round trip per query.

The doorway itself is **sound**: item 230 floored it, and both predicates agree,
**41/41 points across x 879.0…881.0 at 0.05 m, 0 disagreements**. The grid
finding is about what a coarse sweep *could* miss, not a live hole.

## The bug I nearly shipped

Converting w75 made `hasFloor` return a **Promise**, and the call site read
`if (!hasFloor(...))`. **`!somePromise` is always `false`** — the escape branch
becomes unreachable and the file becomes a check that cannot fail. Worth
recording because **the file's own two-sign selftest would not have caught it**:
the selftest calls `ray.query` directly and correctly, so it stays green while
the thing it certifies is dead. A predicate can be sound and its *call site*
still be a check that cannot fail.

## What I did not fix

- **`scripts/interiors-walk.mjs:35` still uses `makeHasFloor` (AABB).** Not
  named by item 238, so not mine (BUILDER-BRIEF §9). Interiors are flat, so the
  0.6 m thickness trap does not bite there — but the **11,948-cell over-claim
  does**, and that is the half that makes a containment check green over a hole.
  **Queue it:** point `interiors-walk.mjs` at `installRayFloorQuery`. Same for
  `probes/w82-classify-belt-endpoints.mjs` and
  `probes/w82-are-interior-floors-sampled.mjs`.
- **`makeHasFloor` is kept, not deleted** — three callers still use it, and
  deleting it was out of scope. Its two failure modes are now documented at its
  own definition.
- **The 0.6 m thickness threshold is a landmine for any future terrain.** Any
  module that gives its ground more than 0.6 m of relief silently vanishes from
  the AABB predicate with no error anywhere. The park crossed it by 53 mm on the
  day it was written. That is a class, not an instance.
- **The raycast counting building undersides as floor is not fixed.** It is
  harmless today because those cells are sealed (92.4% collider-blocked), but it
  is a real false positive and it would bite any check that stopped filtering by
  reachability.
