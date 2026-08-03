# Item 241 — the row's diagnosis was a year stale; the real hole was next door

Worker ninety, 2026-08-03. Port **4460**, built bundle, `vite preview --strictPort`.

## The row is wrong, and here is the measurement

The row says seven of the side street's eight lamp samples are **self-lit neon
reading 1.0000 at noon and midnight**, and asks me to exclude self-lit materials
from the sample set.

**No sample in this clause has come from a material since item 234.** Worker
eightysix did not fix the main street and leave the side street alone — it
replaced the whole clause with a pixel measurement covering **both** regions
(`REGION.main` and `REGION.side`, glow.mjs:201-204). `grep -n '\.color' glow.mjs`
returns **four hits, all inside comments**. There is nothing left to exclude.

Measured on the built bundle **before I changed anything**, from ground pixels:

```
side lamp (20,-98.9) vs mid-block (20,-105.9) — night/day 0.716 vs 0.138 = 5.18x
side lamp (45,-98.9) vs mid-block (45,-105.9) — night/day 0.718 vs 0.138 = 5.18x
skip  side lamp (34,-107.1) — at 13:00 the pair reads 0.3962 vs 0.5780 (0.69x)
```

Honest numbers off ground, not 11.7x off neon. **The "exclude self-lit surfaces"
leg of DONE WHEN was already satisfied and needed no code.**

## The real hole, which the row half-saw: THE FLOOR WAS GLOBAL

`FLOOR = 4` counted `usable` across **all** regions, and the main street alone
contributes **8**. So every side-street sample could vanish — the lens stamp
stops matching, lamps move, the pavement changes under them — and this file
prints four green `OK`s having measured **nothing** on that street. The only
per-region thing in the file was a `console.log` (old line 393) that asserted
nothing.

> **An aggregate floor over a population made of subgroups is not a floor on any
> subgroup. The biggest subgroup pays for all of them.**

Same shape as the two empty-set failures glow.mjs already names in its own
comments — the halo stamps ("ZERO PAIRED OF ZERO IS NOT A PASS") and
footprint.mjs's tree pits. **This is the CLASS, not the instance.**

### Watched failing in both directions

Mutation: `REGION.side` changed to `x > 9999`, deleting the side street from the
measurement entirely.

| | exit | what it said |
|---|---|---|
| **old glow.mjs** (HEAD~1) | **0** | all four verdicts green; the `side:` line just silently vanishes |
| **new glow.mjs** | **1** | `FAIL the side street contributed only 0 usable pair(s) of 0 stamped` |

The four verdicts stay **green in both**. The per-region floor is the only thing
that catches it. That is the whole finding.

The loop iterates `Object.keys(REGION)`, **not** the results — iterating results
would let a region that produced nothing pass by being absent from the loop,
which is the very hole being closed.

## Why the third side lamp was skipped: midBlock only ever walked Z

`midBlock` held `x` and walked `z`. That is "along the pavement" for the **main**
street purely because the main street runs along z (x = ±4.1, z from -9 to -93).
**The side street runs along X** — (20,-98.9), (34,-107.1), (45,-98.9) — so the
identical walk went *across* it and out onto whatever lay north or south.

`scripts/probes/w90-sidestreet-midblock-axis.mjs`, daytime luminance of every
candidate:

```
lamp (34,-107.1)  day at the lamp 0.3939
  z- (34,-114.1)  0.5772  0.68x  rejected
  z+ (34,-100.1)  0.2417  1.63x  rejected
  x- (27,-107.1)  0.2120  1.86x  rejected
  x+ (41,-107.1)  0.4075  0.97x  COMPARABLE
```

The lamp was never un-measurable; **the instrument was offered one direction and
it was the wrong one for that street.** `midBlockCandidates` now returns a
nearest-first list across both axes and the daylight control *selects* from it
rather than merely vetoing one pre-chosen spot.

**Order is `z-, z+, x-, x+` at each radius, deliberately** — z first means every
main-street lamp keeps the exact control it already had, so eightysix's bars are
not perturbed. Verified: main-street ratios before 4.55/4.55/4.57/4.55/3.35/3.33/4.56/5.01,
after 4.57/4.55/4.55/4.54/3.36/3.33/4.56/5.00. x is reached only by a lamp whose
z candidates the daylight control has rejected — today exactly one.

Side street goes **2 usable → 3**, which resolves eightysix's open finding #3.

## The bar, and why it has headroom

`REGION_FLOOR = 2`. Measured: main **8/8** stamped, side **3/3**. Before the axis
fix the side street had exactly 2, so a floor of 2 would have sat right on the
measurement and cried wolf on the first innocent change. Two is also the smallest
number that means anything — one sample is an anecdote, and "I found a single
usable sample" passing is precisely how the old self-lit green cost nothing.

## Five runs, built bundle

```
median  4.56x  4.56x  4.56x  4.56x  4.56x     spread 0.00
dimmest 3.32x  3.34x  3.34x  3.33x  3.33x     spread 0.02
side    3/3 every run; recovered lamp 3.38-3.40x
all five exit 0
```

`canfail glow-pool` → **CAUGHT**, with `pre-pass: 1 of 1 green before any
mutation` — which is the thing the stale comment denied.

## The frames — my own verdict, having looked

`shots/gl-pool-side-near-23.png` vs `shots/gl-pool-side-far-23.png`, same watch
reading **23:06**, same framing: near the lamp the paving carries a warm sodium
wash with its texture visible; mid-block is cold near-black with almost no
detail. **The side street's lamplight is real and the user would see it.** The
crop (y 0.15–0.55) sits well clear of the wristwatch, which starts around y 0.69.

## `scripts/canfail.mjs` — the stale comment, corrected

Lines ~483-500 claimed `glow-pool` "CANNOT DISCRIMINATE TODAY" because glow.mjs
was red before mutation. False since item 234. Replaced with the history, the
measured pre-pass, and — kept deliberately — the `POOL_GAIN = 0` → **2.1x, not
1.0x** warning, because the additive pool decal is separate geometry that
constant never touches. That fact is what made eightysix's first bar sleep.

## Found and NOT fixed — for the desk

1. **`REGION` is two hand-written window functions** (glow.mjs:201-204). The park
   lanterns are stamped and found — 21 lamps carry a lens/lantern stamp — but
   only 11 fall in a region, so **10 stamped lamps are measured by nothing**. A
   third `park` region would extend the same floor to them. Out of scope here.
2. **`scripts/glow.mjs` was not the file the row named.** The row names
   `ct/props.ts`, which I only ever *read* (LAMP_R, WARM_*, parsed at run time,
   never retyped). The edits are `scripts/glow.mjs` and `scripts/canfail.mjs`.
   Flagged per BUILDER-BRIEF §9 — the desk should point the row at the checker,
   not the world.
3. **`which-world.mjs` prints `MEASURING THE WRONG WORLD` and still exits 0.**
   Hit it when a commit moved HEAD past `dist/`. It is loud, so it did not fool
   me, but it is the exact shape of the `health.mjs` bug fixed on 2026-08-02.

## Derived or copied

`LAMP_R` (7.0) and `WARM_R/G/B` parsed out of `src/proto/ct/props.ts` at run time
as before — unchanged, still never retyped. `REGION_FLOOR` and the candidate
search are new logic, and both bars come from the measurements above.

## Verification run

- typecheck **clean** · `node scripts/health.mjs` → `WORLD OK — __ct initialised`
- `npm run sweep` → **0 STATION MISS, 0 COVERAGE**. Inherited only: `[interior:hotel]
  NO BUILDING NAME`, `THREE.Clock` deprecation, Canvas2D `willReadFrequently`,
  GL ReadPixels stalls
- `canfail glow-pool` → **1/1 CAUGHT**, every mutated file restored byte-for-byte
- negative case run on both old and new glow.mjs (table above)
