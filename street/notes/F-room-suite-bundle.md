# The room suite cannot measure the bundle

Split out of `notes/AUDIT-INSTRUMENTS.md`. That file is append-only and shared,
so every builder adding to the end collides with every other; this section
conflicted on four consecutive rebases of mine. The content is unchanged.

## It is dev-only, and making it otherwise is not a rewrite of one line

`scripts/interiors-walk.mjs` — the largest check in the project, 195 assertions
across eight rooms — does `await import('/src/proto/ct/doors.ts')` in two
places. That is a SOURCE path. Only a dev server serves it; against a built
bundle it dies with *"Failed to fetch dynamically imported module"*.

So the suite can only ever see dev, and **dev is not what ships**. Circular
imports resolve differently in the bundle: GOLDEN ACES's door was dropped there
while dev reported all eight, which `scripts/doors-declared.mjs` warns about in
its own output. The check that walks every room is structurally unable to see
the build in the artifact.

Three other harnesses have the same import and the same limit: `mirror-walk`,
`G-rooms-walk`, `G-vice-walk`.

**I tried the obvious fix and reverted it.** Everything those two blocks read is
already published — `at` and `stand` by `__ct.doors()`, resolved room width by
`__ct.roomDims()` — so asking instead of importing looks like a mechanical
swap. It is not. The substituted values are not the same quantities:
`doorWorldFor()` is not `point.z` for a `face`-style declaration, and
`roomWidthFor(frontage)` is not the resolved room width the slab records. The
run went from 195/195 to **152/195**, with `pos=NaN` where an undefined leaked
into a warp.

**Nobody should attempt this as a quick swap.** It needs someone to work out,
per field, which quantity the harness actually wants — and the two `face`
declarations (bodega, and the side-street pair) are where the two conventions
come apart, which is exactly where it broke.

`./scripts/slow-pinned.sh` runs dev by default for this reason, with
`PINNED_MODE=preview` for the bundle-mode checks that can take it.

---

## A keeper-facing guard that did NOT discriminate — do not rebuild it this way

Ported G's facing check (`G-rooms-walk.mjs`, `3ca7e6d0`) into `interiors-walk`
so it would cover all eight rooms rather than G's four. It passed on every room.
Then I put the bug back — reset the thrift keeper to the original
`facing: Math.PI` — and **it passed again**. It does not discriminate, so I did
not ship it.

What I changed from G's version, and the likeliest culprit: **G hardcodes a
customer viewpoint per room; mine derived one** by standing between the keeper
and the room centre. That looked strictly better — no coordinates to go stale,
works for eight rooms instead of four — and it may be the thing that broke it.
Two candidate causes, and I could not separate them with the runway I had:

1. **The viewpoint.** "Most peripheral plane in the slab" may not be selecting
   the keeper at all in every room. The thrift now has a mannequin, a dressed
   window form and a keeper, and only one of those is a citizen sprite.
2. **The sprite may turn to face the player regardless of `facing`.**
   `turn.mjs` reports "own yaw values 8 (spread 5.5 rad)" for every keeper,
   which reads like the figure itself rotating, not just the atlas column
   changing. If `update()` re-aims the figure, the atlas column read from in
   front is "front" whatever `facing` was set to — and no viewpoint-based test
   can see the bug.

If (2) is true it is the more interesting finding, because it means G's check
discriminates for a reason other than the one its comment gives, and the class
of bug is not what any of the three of us thought. **That is worth someone with
`ct/citizens.ts` in their ownership settling, and it is H's file, not mine.**

**The facing derivation itself stays.** It is not justified by this failed
guard: it matches the convention `ct/citizens.ts` documents (`atan2(vx, vz)`,
`0 = +z`), it matches the fix G measured and landed, and deriving from the
counter is strictly better than a literal whatever the runtime does with it.
