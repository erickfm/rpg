# w38 — item 75: the wall-pooling check that agreed with itself

**Root cause in one line:** `props.ts` computed the pooling weight and stored it
only on `litList`, a module internal, so `wallpool.mjs` could verify the taper
only by **retyping the smoothstep** — it compared the world against its own
restatement of the world and could not go red on any change to `props.ts`.

Port used: **4190** (dev) and **4191** (`vite preview`, built bundle). Both
proved free with `curl` first (`000`). Both shut down at the end.

## The item's premise was true — reproduced before changing anything

Unusually for this queue, the desk's diagnosis was exactly right. Re-ran w35's
own probe, `scripts/probes/w35-sizew-reachable.mjs`, against my world:

```
objects traversed:       8324
carrying userData.sizeW: 0
'sizeW' appears as a userData key anywhere: false
```

Matching w35's "0 of 8,324" to the object. So I did not have to work backwards.

**One thing the item did not say, and it matters more than the retyping:**
`wallpool.mjs` **had no assertion and no exit code at all**. It printed and
exited 0 whatever it found. So "its green means nothing" was true twice over —
it compared against its own copy of the rule, *and* it had no way to say a
comparison had failed. Same family as w36's item 73 ("two walking-tier checks
could not fail at all").

## What changed

**`src/proto/ct/props.ts:786`** — publish the taper on the slot mesh:

```ts
o.userData.sizeW = sizeW;
o.userData.poolSpan = span;
```

Both numbers, not just the weight. `sizeW` alone is unfalsifiable — any value
looks right with nothing to relate it to. The span is the taper's *input*, so
the pair turns the rule into a query.

On the **mesh** (`o`), not the material: span comes from this mesh's bounding
box, while one material may dress several meshes. A mesh whose material an
earlier mesh already registered is skipped by the existing `litSeen` guard and
correctly carries nothing — it is not in the pooling registry either. That is
why 794 objects carry the pair and not all 8,324.

**`scripts/wallpool.mjs`** — deleted its copy of `SPAN_FULL`/`SPAN_NONE` and of
`tw*tw*(3-2*tw)`; it now reads the published pairs and asserts six **properties**
rather than the curve. Restating the formula would have rebuilt the exact fault
the item exists to remove, so nothing in the check reproduces it:

| property | what a break looks like |
|---|---|
| a function of span | equal spans carrying different weights |
| monotone | a wider surface pooling harder |
| saturates at both ends | no full-weight or no excluded slots |
| tapers rather than steps | zero slots at partial weight |
| no cliff (bounded slope) | the user's "stops dead at a straight vertical line" |
| flattens at both knees | a straight ramp instead of a smoothstep |

The two knee positions are the one thing the data cannot supply, so the check
**parses them out of `props.ts`** rather than typing them — one home for the
number, and if someone moves the knees the check re-reads them and demands the
world moved with them. (BUILDER-BRIEF §8: derive, never retype.)

## Green, and the numbers agree with theory

```
ok  a function of span      worst spread among equal spans 8.3e-16
ok  monotone                326 distinct spans, never rises
ok  saturates at both ends  561 at full weight, 149 excluded
ok  tapers rather than steps 84 slots at partial weight
ok  no cliff                steepest 0.2495/m, average 0.1667/m, bound 0.5000/m
ok  flattens at both knees  leaving full 0.098x, leaving zero 0.154x, bound 0.5x
```

The steepest observed slope, **0.2495/m**, is the smoothstep's exact analytic
maximum (`1.5/WIDTH` = 0.25) — the world and the maths meet independently, which
is the sort of agreement the old check could never have produced.

## Mutation-tested twice — and both mutations changed bytes

Confirmed with `git diff --numstat` (`1 1` each time), not just by eye.

**A — the old hard cutoff** (`span < SPAN_FULL ? 1 : 0`): **RED, exit 1**, three
properties fail.

```
FAIL  tapers rather than steps  0 slots at partial weight — this is the CLIFF the taper replaced
FAIL  no cliff: bounded slope   steepest 29.4118/m at 5.966..6 m, bound 0.5000/m
FAIL  flattens at both knees    not enough partial-weight slots to tell
```

That 29.4/m at 5.966→6 m **is** the user's report — *"a warm light pool on the
brick that stops dead at a straight vertical line with nothing there to stop
it"* — caught numerically.

**B — a straight ramp** (`sizeW = tw`): **RED, exit 1**, and only the knee
property fails:

```
ok    no cliff: bounded slope  steepest 0.1669/m
FAIL  flattens at both knees   leaving full 1.000x, leaving zero 1.000x, bound 0.5x
```

Run B is the one that matters, because it proves the knee assertion is
**load-bearing rather than redundant**: a change that keeps the taper continuous
and monotone — one every other property waves through — is still caught. The
bound of 0.5x sits between a measured 0.098x and a ramp's exact 1.0x.

Restored, green again, on both dev and the built bundle with identical numbers.

## The world did not move

`npm run fp before` → change → `npm run fp after` → `npm run fpdiff`:

- **textures 1461 vs 1461 — IDENTICAL**
- **structure 8324 vs 8324 — IDENTICAL**
- tints: 3 differ, all the known casino/hotel chase recolour
- places: 3 differ, every one with a partner within 5 cm — pigeons

Expected: the change publishes metadata and alters no geometry, material or
render path.

`node scripts/bugsweep.mjs` on the built bundle: **0 STATION MISS, 0 COVERAGE**,
exit 0. Console output is the pre-existing `THREE.Clock` deprecation and
Canvas2D/WebGL perf warnings only — no new errors. `tsc --noEmit` clean (checked
unpiped; `$?` after a pipeline is the pipeline's last command).

## Found and NOT fixed — for the desk to queue

1. **`wallpool.mjs` is still not registered in `scripts/checks.mjs`.** There is a
   `CHECKS` registry at `checks.mjs:143` and wallpool is absent from it, so this
   guard runs only when someone runs it by hand. The registry's third field
   already carries mutation cases (`['health-dead']`, `['density']`), which is
   exactly the shape the two mutations above would slot into. **I did not do
   this: the item names `scripts/wallpool.mjs + ct/props.ts` and not
   `checks.mjs`** (BUILDER-BRIEF §9). It is a small, well-defined follow-up.
2. **Moving the knees stays green, by design.** If someone changes `SPAN_FULL`/
   `SPAN_NONE` to 6→20, the check re-reads them and the world still satisfies
   every property, so it passes. It verifies the taper's *shape* and that the
   world agrees with the source, not that the knees sit at any particular
   policy value. I think that is right — the knee positions are a tuning
   decision, not an invariant — but it is a deliberate limit and worth stating.
3. **The alley-door brightness disagreement is untouched.** wallpool's original
   subject — the auditor's "2 of 28 bins raised, no falloff either side" — still
   reproduces at **4 of 28 bins** (baseline 18.6, peak 41.4) and that half of the
   script still only prints. It is a separate question from the taper and was
   not in this item.
4. `scripts/probes/w38-taper-pairs.mjs` is the one-shot I wrote to see what the
   data could support **before** deciding what to assert. Kept, in `probes/` per
   §7a.

## Derived or copied?

**Derived.** The weight and span come from the world; the knee positions are
parsed from `props.ts` at run time. The only bare numbers in the check are the
two structural bounds (3x average slope for "no cliff", 0.5x for "flattens"),
both chosen with the measured value and the failure value on opposite sides and
both documented with those figures inline. Neither was tuned to make anything
pass — A and B were written to fail and did.

## L260

I am **not** re-confirming it — a builder does not confirm its own work. What
was missing is now present: the taper is a query, the instrument reads the world,
and it goes red on a deliberate change. The evidence above is what the row needs.
