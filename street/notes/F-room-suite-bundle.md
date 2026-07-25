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
