# w18 — item 30, rotated colliders: NOT IMPLEMENTED, and why

**I did not do this item.** I am handing it back with the acceptance test built
and the blocker named, because implementing it now would have collided head-on
with work that is finished but not yet in the tree.

## The blocker

Item 30 needs `AABB` to gain a rotation field and `blocked()` to honour it.
Item 1 — **DONE, by w13, but UNLANDED** — did this to the same two things:

```
3b3818ce6  Stage 1/4: AABB gains opt-in minY/maxY, zero behavior change
3a4acff02  Stage 2/4: the floor picker can stand you on a collider's top
```

Those live on `worktree-agent-ad0271eaabaa38440`. `git merge-base --is-ancestor`
says they are **not** in my history, and my `src/proto/fp.ts:9` still reads:

```ts
export type AABB = { minX: number; maxX: number; minZ: number; maxZ: number };
```

So adding `rot` here means a textual conflict on that exact line, plus a
**second independent rewrite of `blocked()`** — the function w13's item made
height-aware. Two builders rewriting one collision predicate in parallel is the
merge the brief calls "ten minutes plus a broken world", and it is the world's
movement code.

Item 30's own text says *"same staging discipline as item 1"*, which presumes
item 1 is in the tree. It is not. **Land item 1, then this is straightforward.**

## What I did instead: the acceptance test, failing

`scripts/probes/w18-chamfer-diagonal-walk.mjs`. The row's DONE WHEN was three
prose clauses; this makes two of them a script that is red right now and must go
green. Per CLAUDE.md, every item that landed without follow-up had a check that
could fail — so this is the part worth having in advance.

**Verified the desk's description first, and it is exactly right** (worth saying,
since it was wrong on 6 of 35 items): `CHF = WALK = 2.0`, `BAND = 0.25`, so
`bodega-corner.ts:166` emits precisely **8** bands. Read back off the live world:

```
x 9…18.4     z -96…-95.75     (minX+minZ = -87.00)
x 8.75…18.4  z -95.75…-95.5   (minX+minZ = -87.00)
…8 of them, every one on x + z = -87.00 exactly
```

The cut line is derived from those bands, not retyped.

**The defect, measured by walking:** stand 1.2 m off the face on its
perpendicular, walk straight in until you stop, repeat at 29 points along it.
The stop distance takes exactly **two** values:

```
0.375  0.458  0.375  0.458  0.375  0.458  …   SPREAD 0.083 m
```

That is the staircase — walking in diagonally always wedges the capsule into a
step's corner, and there are only two kinds of corner. One rotated collider must
give one value. Byte-identical across three runs.

## Two measurement traps, both of which read as PASS on a broken wall

Recording these because either would have produced a false green, and the second
one nearly did:

1. **"Hug the wall with W+D" does not hug anything.** With yaw at 45°, W is
   `(+0.707,−0.707)` and strafe-right is `(+0.707,+0.707)`: they cancel in z
   exactly, so the player presses into a single spot and never traverses. The
   profile came out perfectly flat — a clean PASS on the staircase.
2. **Time-sampling a moving player aliases against the 0.25 m band pitch.** Two
   runs of one walk gave a clean 6-tooth sawtooth and a near-flat line with one
   spike. I nearly shipped a "count the teeth" assertion off the first run; it is
   not reproducible and it is gone. The per-point walk-in replaced it.

I also had to tighten my own threshold after measuring: I set it at 0.09 from the
theoretical worst case (`BAND/√2 = 0.177`), but the real signature is 0.083, so
0.09 **passed the very wall the file exists to fail**. It is 0.04 now — above
float noise, less than half the defect. Theory picked the wrong number;
measurement caught it.

## For whoever takes this after item 1 lands

- The fix is a rotated box or a segment collider. **More, smaller bands will not
  pass this probe** — halving `BAND` keeps the two-corner wedging and only
  changes the pitch.
- Re-run `SHOT_URL=… node scripts/probes/w18-chamfer-diagonal-walk.mjs`. Both
  assertions must flip: `bands.length === 1`, and stop-distance spread < 0.04.
- The probe does **not** cover the V overlay clause of the DONE WHEN; that one
  still needs a human to press `V` and look.
- `bodega-corner.ts:170` also emits the full-width block north of the cut; only
  the loop at :166 is the staircase.

Ports: 4193 (dev), 4181 (preview). My assigned 4197 was already another
builder's world.
