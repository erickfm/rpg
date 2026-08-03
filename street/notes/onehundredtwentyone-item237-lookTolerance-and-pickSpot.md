# Item 237 — `lookTolerance` and `pickSpot` published on `__ct`

Worker onehundredtwentyone, 2026-08-03. Commit `56d1f8022`. Port **4188** (dev)
and **4189** (`vite preview`, the built bundle) — 4188 was the probes' own
default and `ss -ltn` showed it free.

## The item's framing was wrong in one way that matters

The row says a probe importing `fp.ts` at runtime "is silently running on a
fallback". **For these three it is not silent and there is no fallback.** None
of them wraps the import, so against `vite preview` each throws an uncaught

```
page.evaluate: TypeError: Failed to fetch dynamically imported module:
  http://localhost:4189/src/proto/fp.ts
```

at its **first pose** and the process dies with a stack trace. Measured on the
bundle built from `b85494d0f`, before any change:

| harness | on `vite dev` | on `vite preview` (before) |
|---|---|---|
| `w40-227-frame` | full 16-pose table | **threw at pose 1**, 0 rows printed |
| `w40-301-who` | full 8-cell table | **threw at cell 1**, 0 rows printed |
| `w40-resolver-map` | 54,336 poses | **threw at station 1**, no JSON written |

So the answer to "what was each computing before" is: **on the dev server, the
right thing; on the bundle, nothing at all.** That is a better outcome than the
row feared — a crash cannot be mistaken for a reading — but it is why the
blast-radius differ for the project's highest-risk file had never once been
pointed at the world the user ships.

## What was published

Both in the `painted()` / `citAvoid()` style: *expose what a probe needs to
reason, not the live machinery.*

- **`lookTolerance(r, d)`** — numbers in, a number out. Nothing about the world
  is reachable through it, so it is read-only by construction rather than by a
  defensive copy. It is published as a FUNCTION and not as its two constants
  because the answer is not a number you can write down once: for r 1.05 it is
  25.0° at 2 m and 11.3° at 6 m. Two workers hand-copied this and **both read
  `raw = atan2(r, d)`, the value before the clamp** — `ninetytwo-item98-the-
  plateau-is-the-clamp.md` §2 — which inverted item 98's premise.
- **`pickSpot(view, opts)`** — the world's own `pickSpot` over the world's own
  live `SPOTS`, at the same default reach of 6 and with the same `opts.seated`
  shape the frame loop uses. It returns the winner's **index into `spots()`**
  (the join a caller needs, and the identity a live object cannot carry across
  `page.evaluate`), its evaluated label, its geometry, and the three tier
  numbers — **never the live `Spot`**, whose `label` and `ok` are thunks closing
  over world state.

**No predicate in `fp.ts` was touched.** The diff to `crosstown.ts` is 70 added
lines inside the `__ct` object literal plus one import line lengthened; zero
world code.

### Line of sight is deliberately NOT offered, and that is a limit

`update()`'s `visible` callback raycasts from the **player's eye**, so it can
only answer for the pose the player is actually standing in — and the entire
purpose of the hook is to ask about poses he is not in. Supplying it for an
arbitrary `view` would answer a different question while looking like the same
one. `w40-resolver-map` already omitted it on purpose. Live-prompt truth, sight
included, is read off `#ct-prompt` by `w40-bed-vs-door.mjs`.

## Proof

**The strongest one:** `w40-resolver-map` re-measured, 283 stations × 3 offsets
× 8 positions × 8 headings = **54,336 poses**, and the map taken **on the built
bundle through `__ct.pickSpot`** is byte-identical to the map taken **on the dev
server through `import('/src/proto/fp.ts')`**:

```
54336 poses; 0 changed (0.0%)
  0 change the PROMPT TEXT   0 poses lost their offer; 0 gained one
spots winnable from at least one pose: 255 before, 255 after
  none became unreachable
```

- `w40-301-who` — output **byte-identical** on dev, before vs after.
- `w40-227-frame` — the tier table is **byte-identical**; one `[E]` prompt line
  of 16 differs. **That line is a pre-existing flake in the probe, not this
  change:** two runs of the *same* code differ on a *different* pose (yaw 315
  vs yaw 45). It reads `#ct-prompt` off the DOM 200 ms after a warp, and the
  live prompt applies the raycast `visible` filter the table does not —
  GOTCHAS 30, a fixed sleep against something the render loop drives.
- All three now exit 0 against `vite preview`, and each aborts **exit 3** with a
  named missing hook rather than scoring, per GOTCHAS 32.
- `node scripts/health.mjs` → `WORLD OK`; `node scripts/bugsweep.mjs` → 96
  shots, **0 STATION MISS, 0 COVERAGE**, no new console errors.
- `npx tsc --noEmit` clean.

## NOT DONE — the row's "no harness imports fp.ts anywhere" is NOT met

The row says three remain. **Five do**, and I converted the three it named. The
other two are left on purpose:

1. **`scripts/probes/w80-touchmargin-reachable.mjs`** — leave it forever. Its
   whole job is to run *both* paths side by side and report which world serves
   which. Converting it deletes the only instrument that measures the problem.
2. **`scripts/probes/w92-item98-the-plateau-is-the-clamp.mjs:42`** — not named
   by this item (BUILDER-BRIEF §9), and **it has a worse bug than the import.**
   Inside its `page.evaluate` it hand-types the clamp as
   `ceilDeg: deg(0.26), floorDeg: deg(0.20)`, and **`LOOK_CEILING` is `0.4363`
   (25°) since the user chose that number on 2026-08-03.** So it prints a
   14.90° ceiling for a world that clamps at 25.00°, and its baked `VERDICT`
   strings name 14.90° too. Converting only the import would leave it confidently
   wrong. **Queue it as its own item**: the fix is to derive both bounds from the
   published function — `lookTolerance(1e6, 0)` returns the ceiling and
   `lookTolerance(0, 1e6)` the floor — and to re-word the verdict. I did not do
   it because rewriting the conclusion of a settled historical argument is not
   this item.

## Derived vs copied

Everything derived. `lookTolerance` and `pickSpot` are **imported** into
`crosstown.ts` from `./fp`, not restated; the three harnesses read
`__ct.touchMargin()` and `__ct.lookTolerance()` rather than any literal. No
number was retyped anywhere in this change.
