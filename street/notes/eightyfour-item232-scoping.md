# Item 232 — scoping only, NOT started

**Worker eightyfour, 2026-08-03.** I claimed 232, verified its central claim
against the source, ran out of room, and **released it back to TODO with
`claim.sh --release 232`** rather than half-do it or call `done.sh` on work I
had not done. Nothing in the tree was changed for this item. Here is what I
established, so the next builder does not repeat it.

## The row's central claim is TRUE at the source

`src/proto/fp.ts`:

```
771  export const REACH_MARGIN = 0.6;
778  export const TOUCH_MARGIN = 0.15;
991    const touching = d < s.r + TOUCH_MARGIN;          ← the aim-free predicate
1006     && (!seated || d < s.r + REACH_MARGIN);         ← REACH only when SEATED
1124   ring(spot.r + REACH_MARGIN, …)                    ← the debug ring
```

So for a **standing** player `REACH_MARGIN` really is used nowhere in
`pickSpot` — only the seated clause and the debug ring. The row is right, and
`fp.ts:800-812`'s own comments still describe the pre-change design
(`near = d < r + REACH_MARGIN`), which is probably how the nine sites got there.

## The population — 16 files, not 6

`grep -rln REACH_MARGIN scripts/` gives **16 files**, of which **2 are
registered checks** (the ones that matter):

- `scripts/O-jail-walk.mjs` — reads `__ct.reachMargin()` at :105, passes it into
  the page at :118, and the verdict uses `const reach = r + REACH_MARGIN` at
  :212. **This is the false-green one.**
- `scripts/A-eye-height-holds.mjs:162` — named by the row; I did **not** open it.

The other 14 are probes and one-offs (`scripts/probes/*`, `w9-reach-repro.mjs`,
`D-look-selects.mjs`, `A-verify-select-through.mjs`, `casinodoor.mjs`,
`D-confirmed-prompts.mjs`). **Several are already correct or already migrated** —
`casinodoor.mjs` reads `__ct.touchMargin()` and its comments at :224-252 are the
best existing write-up of this exact confusion; `probes/w80-touchmargin-reachable.mjs`
and `probes/w54-doorway-yaw.mjs` read BOTH constants deliberately. **Do not
blanket-replace** — the row says so and the file list confirms it.

Two that are plainly stale and worth checking first:

- `scripts/A-verify-select-through.mjs:58` — `const REACH = 0.6;` is a **hand-typed
  copy**, and its own comment cites `fp.ts:486`, which is not where the constant
  lives any more (it is `fp.ts:771`). That is BUILDER-BRIEF §8's "derive, never
  retype" and a dead citation in one line.
- `scripts/probes/D-sightline-pairs.mjs:82` — radii chosen to be "inside
  `r + REACH_MARGIN` for every spot", i.e. the 0.6 assumption baked into data.

## What I did NOT do

Everything the row asks: no site was changed, no check was shown flipping
red-where-green. **The DONE WHEN is untouched.**

One caution for whoever takes it, from the row itself and worth repeating: **do
not derive the constant by importing `fp.ts` in a harness.** Seven harnesses do
`import('/src/proto/fp.ts')`, which **404s on `vite preview`**, so on the built
bundle they silently fell back. Read `__ct.touchMargin()` / `__ct.reachMargin()`.
