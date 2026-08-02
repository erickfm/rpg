# w39 — item 82: unstick-walk reads turned colliders in their own frame

**Root cause in one line:** `scripts/unstick-walk.mjs` predates `AABB.rot` and
compared raw world x/z against a collider's **own-frame** extents, so it measured
the bodega chamfer — a box turned 45° — as an axis-aligned 2.83 × 1.41 rectangle
it does not occupy, and called a player `unstick` had correctly ejected "still
inside a wall".

**Port 4180** (dev server) and **port 4181** (`vite preview`, the built bundle).
Both proved `000` before use; both shut down at the end.

## The premise is TRUE, and the desk's file and line were both right

This is the rare item where the row was exactly correct, which is worth saying
given BUILDER-BRIEF §6a. `w38-chamfer-trap.mjs` reproduces it in one run:

```
the collider centred on 8.5,-94.5: half-extents 1.414 x 0.707  rot 0.7854
   unstick-walk (no inFrame): 1 collider(s) say INSIDE
   fp.ts blocked() (inFrame): 0 collider(s) say INSIDE
```

`fp.ts:287` maps the world point into the box's frame (`inFrame`, `fp.ts:55`)
before comparing; this file never did. Same point, same colliders, opposite
verdicts — and the instrument's is the wrong one.

## THE BUG WAS HIDING INSIDE A GREEN SUITE, AND THAT IS THE PART TO CARRY FORWARD

**`unstick-walk.mjs` exited 0 before my change.** I ran it first and it reported
`all 531 traps release the player`. If I had trusted that I would have closed the
item as already-satisfied, and been wrong.

The phantom is a **race inside `fp.ts`'s own unstick**, and the losing side is
the side that reports the bug:

- `unstick` pushes at 3 m/s and needs **1.067 m** to clear the chamfer
  (`0.707 + RADIUS`, the minimum translation out of its short axis) — about
  **0.36 s of dt**.
- `unstick`'s **PATIENCE is 0.45 s** of dt, after which it gives up and teleports
  the player to `lastGood`, hundreds of metres away, where every predicate agrees
  he is free.

At 60 fps the push wins: the player comes to rest at **(7.745, −95.255)**,
genuinely free, and the rotation-blind predicate calls him buried — **the phantom
fires**. Under load, `dt` clamps at 0.05 s (`src/main.ts`), PATIENCE wins first,
the player is flung to `lastGood`, and the same predicate scores it *"freed
itself"*. **A 531-trap back-to-back run is exactly the loaded case.** The suite
was green because it was slow.

So the acceptance run is not "unstick-walk exits 0" — it is green both before and
after and proves nothing either way. `scripts/probes/w39-phantom-repro.mjs` asks
the one question directly, N times, **both predicates against the same frames**:

```
   1  rotation-blind: FAIL (stalled @ 7.745,-95.255)   frame-aware: ok (free @ 7.745,-95.255)
   … 8 rounds, identical …
  rotation-blind (before item 82): 8/8 report a trap
  frame-aware    (after  item 82): 0/8 report a trap
```

Same world, same rest position, 8/8 red → 0/8. That is the red *and* the green
(GOTCHAS 72), in one run.

## The three DONE WHEN conditions, measured

**1. The probe reads turned boxes in their own frame.** All four rotation-blind
predicates are gone: `isBlocked` (the line the row names), `blockedAt` inside
`probeTrap`, `anyWayOut` (which calls it), and the trap-list generation.

**2. The (8.50, −94.50) phantom is gone.** 8/8 → 0/8 above, on the dev server and
again on the **built bundle** at 4181.

**3. A REAL trap beside the turned collider is still caught.** A crate on
walkable ground at the chamfer's south-west face, plus three walls leaving a
patch of legal floor too small to stand on — planted in `ct/bodega-corner.ts`,
byte-verified (`git diff --numstat` → `11 0`), and reverted after:

```
FAIL  gap 0.80m @ 7.00,-96.40 — came free but every direction is still blocked (at 6.64,-96.40)
1/537 traps are still traps                       (exit 1)
```

Reverted → `all 531 traps release the player`, exit 0, and **582/531/51 identical
to the pre-change baseline** — the fix took no coverage with it.

That trap is the user's own *"im literally stuck here"* shape: `unstick` ejects
you 0.66 m out of the crate onto floor that is legal, and every way off it is
masonry. It is caught by the **`!canMove`** verdict.

## Found and NOT fixed — the part the desk needs

1. **`unstick-walk` has almost no failing path left, and that is not my doing.**
   Working out how to make it go red took most of this item. `unstick`'s PATIENCE
   teleport rescues the player from essentially any warp-in, and the probe scores
   a teleport as *"freed itself"* — correctly, since being moved is not being
   stuck. **Both trap kinds are near-unfailable by construction:** a gap midpoint
   is by definition the *freest* point between two boxes, so either the slot is
   under 0.72 m and the midpoint is blocked with the escape forces perfectly
   symmetric (→ teleport → pass), or it is over 0.72 m and the midpoint is free
   (→ skipped as `alreadyOut`). The only reliable red is `!canMove`, which needs
   a pocket of legal floor smaller than 0.5 m across. **The phantom was, in
   practice, the check's only red — and it was false.** Worth an item: this
   instrument now proves less than its name suggests.
2. **`fp.ts`'s `blocked()` takes an `atY` this probe cannot pass**, so a collider
   with `maxY` that the rig legitimately stands on top of still reads as a wall
   here. It does not fire today (every probe warps to ground level), but it is the
   same class of instrument/world disagreement as the one just fixed, and it will
   bite the first check that warps onto a car roof.
3. **`scripts/lib/collide.mjs` should not exist, and says so in its own header.**
   It is a faithful copy of `fp.ts`'s geometry and nothing can notice if `fp.ts`
   changes. The real fix is for the world to publish its own predicate —
   `__ct.blocked(x, z)` beside `__ct.colliders()` — at which point this file gets
   deleted rather than maintained. That needs `crosstown.ts`, which item 82 does
   not name (BUILDER-BRIEF §9).
4. **I did NOT migrate this file to `staticColliders()`.** That is item 83's
   whole subject and `notes/w38-static-colliders.md` §4 is explicit that the two
   must not be conflated. The rotation fix does not touch which array is read.
5. **`w38-chamfer-trap.mjs` still carries its own hand copy of `inFrame`.** I
   left it: it is the probe that *documents* the disagreement, so it needs both
   predicates spelled out side by side, and pointing half of it at the shared lib
   would make it argue with itself.

## Derived or copied?

**Copied once, deliberately, and cited.** `inFrame` and the padded min/max test
in `scripts/lib/collide.mjs` are copies of `src/proto/fp.ts:55-61` and
`fp.ts:279-293`, by line number — a browser probe cannot import TypeScript, and
against a built bundle `fp.ts` is not separately reachable at all. The point of
the file is that this is now the **only** copy: Playwright serializes each
`page.evaluate` callback separately, so a helper used by three callbacks would
otherwise be three textual copies. `installCollide()` ships one `toString()` into
the page as `window.__probeCollide` and **verifies itself on arrival** — a CSP
that forbade `eval`, or an install that ran too late, would make every probe
report no traps at all, which reads exactly like a pass (GOTCHAS 71).

`worldAabb` is new, not a copy, and is used **only to find candidates**, never for
a verdict: it widens the chamfer's search footprint from its own-frame 2.83 × 1.41
to the 3.00 × 3.00 it really covers, and is the identity on every unrotated
collider — which is all 519 of the other 520.

## Verified

- `node scripts/bugsweep.mjs` on the built bundle: **0 STATION MISS, 0 COVERAGE**,
  96 shots, no new console errors.
- `unstick-walk.mjs` green on dev (4180) and on the built bundle (4181), with
  trap counts identical to baseline.
- No world file changed, so no `npm run fp` comparison is owed — `git status` is
  clean of `src/` in the shipped commit.
