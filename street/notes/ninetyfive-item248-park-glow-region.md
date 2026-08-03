# Item 248 — the park is the third glow region, and the flake was the control leaving the park

Worker ninetyfive. `scripts/glow.mjs`, two commits: `27ddf0817` (the region) and
`23d61f164` (the control containment, which is the part I did not expect to
need). Measured on the **built bundle**, port 4510, `npx vite preview
--strictPort`.

---

## The item was right, and I verified it before changing anything

`scripts/probes/w95-park-region-coverage.mjs` applies glow.mjs's own stamp and
its own two region predicates and prints where each lamp lands:

```
tally: {"main":8,"NONE":10,"side":3}
park site: {"minX":-39,"maxX":-7,"minZ":-98,"maxZ":-68,"y":0.14}
```

Exactly as filed: **10 of 21 stamped lamps fell in no region.** Not a false
green — an absence. The file printed four green OKs and never mentioned that a
third of the world's lamps existed.

---

## What I changed

**1. A park region, derived from the site.** `__ct.sites()` is an OBJECT keyed by
name (`crosstown.ts:1598`, `Object.fromEntries(SITES)`) — checked rather than
assumed, because `roomDims()` being an array is a documented trap here.
`ct/props.ts:2135` already places the ten lanterns from `site('park')`, so the
region that measures them now reads the same publication.

**Exclusive by construction, and the margin is live.** The park site's east edge
is `maxX -7`, which reaches 2 m *into* main's `|x| <= 9` window — that overlap is
real geometry, not hypothetical. The nearest lantern stands at x -9.55, **0.55 m
outside it**. So `park` is `INPARK && !MAIN && !SIDE` rather than a bare bounds
test.

**2. The coverage assertion, which is the actual fix.** Adding a region measures
the park *today*. This makes the failure that hid it unrepeatable: every stamped
lamp must fall in **exactly one** region, and both directions fail by coordinate.
Unclaimed is item 248's hole; double-claimed is its mirror and matters because
one lamp would otherwise credit two per-region floors.

**3. Per-region bars replacing the flat `REGION_FLOOR = 2`.** A flat 2 is not a
floor on a region of ten — six lanterns could stop being measurable and it would
still pass. Two bars per region, because they catch different failures:

| | `stamped` | `usable` |
|---|---|---|
| catches | lamps REMOVED / stamp lost | lamps present, nothing can measure them |
| main | 6 | 4 |
| side | 2 | 2 |
| park | 8 | 4 |

A `stamped` bar is needed because a usable-bar alone cannot see deletion: delete
lanterns and the stamped population falls with them, so any bar derived from that
population falls too. **My own negative case proved this** — see below. A region
with no declared bar now fails rather than passing unguarded.

---

## The five runs caught me, which is the point of five runs

First cut, five runs: park usable came back **6, 7, 4, 5, 6 — spread 3 — and one
run went RED** on the "warmed twice" ceiling (1.21 against 1.11). The streets did
not move at all (main 8/8 ×5, side 3/3 ×5, ratios repeating to ±0.02).

**It was not the shader.** Park lantern `(-9.55,-86.33)` had chosen its control at
**x = -1.8 — out on the main street**, 7.06 m east of a lamp standing on grass.
Asphalt is not a control for grass. In that run the lamp's own night/day reading
came back **1.207 against 0.758** in the four clean runs, and that is what
breached the ceiling.

This is **item 241's finding wearing a third hat.** 241 caught the control
walking *across* the side street instead of along it; here it walks clean out of
the region entirely. The daylight control was meant to catch this, but it is a
luminance test and a transient in frame can walk a bad spot through a 0.8–1.25
window. **Geometry is the stronger guard** — the park's ground is bounded and
published, so a control outside it is now rejected by construction.

**Not applied to the streets, deliberately.** Their region windows classify
LAMPS, not ground: main's window stops at `z >= -96` while two of its lamps
legitimately control against `z = -100` past the end of the block.

| | main | side | park |
|---|---|---|---|
| before | 8/8 ×5 | 3/3 ×5 | 6, 7, 4, 5, 6 — spread 3, one run RED |
| after | 8/8 ×5 | 3/3 ×5 | 6, 5, 5, 5, 6 — **spread 1, five green** |
| ceiling | | | before 0.93–0.96 + one 1.21 breach; after 0.77–0.96, none |

Park pool ratios, median run: **3.68x – 5.14x**, every one over the 3x median bar
and the 2.6x per-lamp bar.

### I set the park bar wrong the first time

`usable: 4` sat **exactly on** the pre-fix worst run — the bar-on-the-measurement
mistake the item 241 note in this same file warns against, and I had already
committed it. It is defensible only because the control fix moved the minimum to
5. Recorded in the file so the next person sees the reasoning, not just the number.

---

## Which axis does the park walk? Both — and the reason is spacing, not shape

The loop has legs on each axis (eight lanterns on the two z-legs at x -9.55 and
-34.85, two on the x-legs at z -95.35 and -70.65). But the deciding fact is that
**the lanterns are 6.64 m apart, tighter than `LAMP_R` (7.0)** — so no spot
*along* a leg is ever outside a pool, and every along-leg candidate is dropped by
the `minLampD` filter. The park's control therefore always walks
**perpendicular** to its leg, into the field.

## The four skips are honest, and they now say which kind they are

The four **corner** lanterns (z -92.97 and -73.03 on both legs) report **zero
candidates**: the perpendicular lands within 6.13 m of an end lantern, and the
other three directions leave the park. They are boxed in by their own neighbours.

`"tried 0: none available"` claimed a 13:00 test that never happened — the probe
lying about its own work. An empty candidate list is a **geometry** result and no
luminance was read; a non-empty list that all failed is a **ground** result. They
point at different fixes and now print differently.

I did **not** widen the 0.8–1.25 daylight window to recover them. That would be
loosening a check until it agrees with me (BUILDER-BRIEF §7), and that window is
shared with both street regions.

---

## Both signs, on the final code

- **park region removed from glow.mjs** → **exit 1**, all 10 lanterns named by
  coordinate. This is the original hole; the two-region file exits 0 on it.
- **park emptied in the world** (`props.ts` `parkSite` forced null, rebuilt) →
  **exit 1**, both park bars fire. **The coverage assertion still PASSED here** —
  there were no lamps left to be unclaimed — which is precisely why the
  `stamped` bar had to exist. I would not have known that without running the
  negative case.

`props.ts` restored byte-for-byte both times (`git diff --stat` empty).

## Green

`tsc --noEmit` 0 · `health.mjs` WORLD OK · `npm run sweep` 0 STATION MISS, 0
COVERAGE · `canfail glow-blind glow-pool glow-buried` **3/3 CAUGHT** with a green
pre-pass, so the existing mutation suite is intact.

I **looked at** `shots/gl-pool-park-near-23.png` (warm pool on grass, bench in
frame) and `gl-pool-park-far-23.png` (same grass, unlit). A legitimate pair.

---

## Found and NOT fixed — for the desk to queue

**`glow-park-dark` deserves a permanent mutation case, and I did not add it.**
`scripts/canfail.mjs` and `scripts/checks.mjs` are not named by item 248, so per
BUILDER-BRIEF §9 I stopped rather than edit them. My negative case is currently
reproducible only by hand. The case is a one-liner, already proven to go red:

```js
  // ITEM 248. Until this item glow.mjs held two regions and matched none of the
  // park's, so this mutation would have changed NOTHING it printed — the park
  // was already unmeasured. The per-region `stamped` bar is what turns it red.
  ['glow-park-dark', PROPS,
    "  const parkSite = site('park');",
    "  const parkSite = null as any;",
    'glow.mjs', ['probe'], 'the park losing all ten of its lanterns'],
```

and `'glow'` in `scripts/checks.mjs:601` gains `'glow-park-dark'` in its case list.

**Two park lanterns sit on ground the mound has changed under them.**
`(-9.55,-79.67)` reads its whole candidate run at 0.76–0.78x against the 0.80
bar — every one of eight, monotonic with distance, so it is the terrain and not
noise. `ct/props.ts:2020` records that the park field was crowned 0.10 m with a
mound reaching 0.37. This is a *measurement* limitation, not a lighting defect,
and it is why the park tops out at 6 of 10 rather than 8. Worth a row only if
someone wants full park coverage.
