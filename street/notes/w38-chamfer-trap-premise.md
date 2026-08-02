# w38 — item 79: the "real trap" is an instrument artifact

**Root cause in one line:** `scripts/unstick-walk.mjs:35` decides "still inside a
collider" **without applying `inFrame`**, so it measures a collider turned 45°
as though it were axis-aligned — and calls a player who is genuinely free
trapped.

**Port 4194** (`vite preview`, the built bundle, as the row requires). Proved
free first; shut down at the end.

## The premise is false, and this is the headline

The row says *"A REAL TRAP THE PLAYER CAN WALK INTO — the only player-facing bug
this session found"*, and asks for it to be **walked**. So I walked it.

`(8.50, −94.50)` is the exact **centre of the bodega's chamfer collider** — a
solid box of half-extents 1.414 × 0.707 about that very point, turned 45°. It is
the middle of a wall.

**Walked at from 16 headings, 3 m out, on the built bundle:**

```
CLOSEST APPROACH OVER ALL 16 HEADINGS: 1.106 m
player radius: 0.36 m
```

Every heading is stopped roughly **three player-radii short**. **The player
cannot walk into it.** The row's central claim does not hold, and its DONE WHEN
("you have walked into that spot and out again") is not satisfiable as written —
there is nothing to walk into.

That is consistent with the corner's other evidence rather than a lone
contradiction: item 78's §2b/§4 walked this same face 26 times and `no walk ended
up inside the wall` every time, and §2a measures the surface flat to 0.0 mm.

## `unstick` also works. It is the check that is wrong

`unstick-walk` **warps** to its test points (`scripts/unstick-walk.mjs:85`) — it
teleports the rig into solid masonry, which is a fair test of *"a collider
appeared on top of you"* but is not walking. Warped in on purpose:

```
start 8.500,-94.500  ->  end 7.745,-95.255   moved 1.068 m
still inside a collider at the end:  NO — he got out
```

So `unstick` ejects him. The 1.06 m shove the row quotes as evidence of failure
is `escapeFrom` doing its job: the minimum translation out of that box is through
its short axis, `0.707 + RADIUS = 1.067 m`, which is exactly what was measured.

**Both predicates, at the same point, over the same colliders:**

| predicate | verdict |
|---|---|
| `unstick-walk.mjs:35` — raw world x/z vs `minX..maxX`, **no `inFrame`** | **1 collider says INSIDE** |
| `fp.ts:287` `blocked()` — `inFrame` first | **0 colliders say INSIDE** |

On a rotated collider `minX..maxX / minZ..maxZ` are extents **in the box's own
frame**. Comparing a world point against them without turning it into that frame
tests a different region entirely — here an axis-aligned 2.83 × 1.41 rectangle
standing in for one turned 45°. The player sits outside the true box and inside
the imaginary one, and the check reports a trap.

**1 of 531 traps is not still a trap. It is 0 of 531, and one instrument bug.**

## The row's own hint was half right — and pointed at the wrong file

It says to check *"a turned collider measured by its bounding box (`gap.ts` still
does this — item 59 landed the true-clearance maths but `trapAgainst` reads the
bounding box)"*. **The shape of the fault is exactly right; the file is not.**
Item 78's §3b measured `gap.ts` directly and it passes —
`gap.ts measures the turned box by its real world footprint` — because
`corridor()` routes rotated pairs through `orientedCorridor`. The file that still
reads a turned box as its bounding box is **`unstick-walk.mjs` itself**.

## What I did NOT do, and why — plus the exact fix

**I did not edit `scripts/unstick-walk.mjs`.** The item names
`ct/ (whatever owns the side street…) + ct/gap.ts`; the fault is in neither, and
BUILDER-BRIEF §9 is explicit that a file the item does not name is the boundary
and that reporting it is the success. It is a one-line change and the desk can
queue it with no investigation left to do:

```js
// scripts/unstick-walk.mjs:35 — apply the box's frame first, as fp.ts:287 does
const isBlocked = (x, z) => p.evaluate(([x, z, R]) => window.__ct.colliders().some((c) => {
  const q = inFrame(c, x, z);          // <-- missing today
  return q.x > c.minX - R && q.x < c.maxX + R && q.z > c.minZ - R && q.z < c.maxZ + R;
}), [x, z, RADIUS]);
```

`inFrame` is 6 lines in `fp.ts:55`. **It should be hoisted and shared rather than
copied a third time** — `w38-chamfer-trap.mjs` needed its own copy to write this
note, which is precisely the BUILDER-BRIEF §8 smell. A `scripts/lib/collide.mjs`
exporting `inFrame` and a `blocked()` that matches `fp.ts` would close it.

**Also worth queueing:** the trap list itself (`unstick-walk.mjs:47`) takes the
centre of every collider under 8 m as an "inside" case, using the same
rotation-blind extents. Fixing line 35 alone leaves the list generation
untouched; both should move to the shared predicate together.

**Not verified by me:** the row also asks that "the V overlay shows no red
there". I did not press `V` and look. `ct/debug-collision.ts` colours boxes with
`gap.ts`'s `trapAgainst`, and item 78 measured that same function green on this
chamfer across 56 samples — but that is an inference from a neighbouring check,
not the walked look the row asks for, and I am not going to report it as done.

## Derived or copied?

**Copied, and flagged.** `inFrame` in `w38-chamfer-trap.mjs` is a hand copy of
`fp.ts:55-61`, cited by line number, because `fp.ts` is TypeScript source a
browser probe cannot import from the built bundle. That copy is the third in the
repo and is exactly why the hoist above is worth doing.
