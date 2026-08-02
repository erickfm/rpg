# w28 — item 47: the climb route cannot be built in `ct/cars.ts`, and `crosstown.ts` is held

**Handed back, with the design measured so the next builder implements rather
than re-measures.** One thing item 47 depends on *was* wrong and is fixed:
the tyre's top.

## The blocker, in one line

Item 47 names **`ct/cars.ts`**. Every car collider in this project is built in
**`crosstown.ts`** — and `crosstown.ts` is currently held by **w26 under item 49
(DOING, 02:02)**. BUILDER-BRIEF §9: *"Another builder holds an item naming the
same file → skip it, take the next."*

This is not a technicality. `cars.ts` draws meshes and exports constants; it
registers no colliders at all. A player stands on a surface only if
`crosstown.ts` pushes a box with a `maxY` onto `colliders`:

- `crosstown.ts:488` — every parked car's box is
  `{minX, maxX, minZ, maxZ}` with **no `maxY` at all**, i.e. a full-height wall
  you can never stand on at any height.
- `crosstown.ts:745–835` — the pickup's four standable tiers
  (`pickup-hood`, `pickup-cab-roof`, `pickup-bed-floor`, the two rails). This
  block is guarded by `parkedFleet.find(p => p.kind === 'pickup')` and is the
  entire reason the pickup is climbable.

So the whole of "make one car climbable" is that second block. Adding the
furniture to `cars.ts` alone would draw a step nobody can stand on — the mirror
image of the "collider nobody can meet" item 47 forbids, and a half-converted
world, which BUILDER-BRIEF prefers I not ship.

Item 29's own LEDGER row lists its files as **`ct/cars.ts + crosstown.ts +
fp.ts (read-only)`**. Item 47 is its follow-up and lists only `ct/cars.ts`.
That looks like a dispatch slip rather than a decision.

**Re-file item 47 as `crosstown.ts` + `ct/cars.ts`, after item 49 lands.**

## What I did land, inside my file

`ct/cars.ts` said in four places that the tyre's top is **0.68**. w21 measured
**0.66** and flagged the disagreement without a cause. Item 47's own text is
argued from that number ("the tyre at 0.66 m, clearing the kerb by 28 mm"), so
it is worth being exact.

**It is 0.6634, and the cause is that the wheel is a decagon.**
`cars.ts:1141` is `CylinderGeometry(0.34, 0.34, 0.24, 10)` — ten radial
segments, so a ten-sided prism, not a cylinder. Laid on its side as a wheel it
stands on one of its **flats**, so the highest point is the apothem above the
hub, not the radius:

```
0.34 + 0.34·cos(π/10) = 0.6634          predicted
                        0.6634          measured, all four kinds
```

`scripts/probes/w28-tyre-top.mjs` prints both side by side and they agree to
four decimal places. Across the car's axis you *do* get the full `2r = 0.68`,
because two vertices land on that diameter — which is why "a tyre 0.68 m
**across**" elsewhere in the file is right and "the tyre's **top** is at 0.68"
was wrong. Both survive, correctly, in the corrected comments.

It costs half the margin: **28 mm of clearance over the pavement, not 45 mm.**

## The route to build, measured

`scripts/probes/w21-fleet-tops.mjs` against the built bundle on 4180. Pavement
is **0.14**. One hop gains **0.551 m guaranteed** — apex 0.471 at `main.ts:107`'s
dt clamp plus `TOP_EPS` 0.08, so a margin against it is a floor, not an average.

```
sedan   0.6634 tyre   0.84 belt   0.93   0.94 hood/boot   1.46 roof
hatch   0.6634 tyre   0.84 belt          0.94 hood/boot   1.44 roof
van     0.6634 tyre   0.84 belt          0.94 hood/boot   1.78 roof
pickup  0.50 bed   0.6634 tyre   0.84   0.94 hood   0.97 rail   1.50 roof
```

**The van is out and the desk is right about it**: 0.94 → 1.78 is 0.84 m, half
a metre past a single hop, and there is nothing in between.

### Recommended: the HATCH, climbed up its back

Two pieces of furniture, both period-correct on a 1997 hatchback, both real
objects rather than found ledges — which is the item's own standard:

| surface | height | rise | margin |
|---|---|---|---|
| pavement | 0.14 | — | — |
| **rear step bumper** (new) | **0.60** | 0.46 | **+0.091** |
| **rear spoiler over the tailgate** (new) | **1.05** | 0.45 | **+0.101** |
| roof | 1.44 | 0.39 | **+0.161** |

**Worst margin 91 mm — 4.3× the pickup's 21 mm**, so it clears the DONE WHEN
with room rather than by a hair. It also reads as a climb: you go up the back
of the car, bumper → spoiler → roof, the way a person actually would.

Both new surfaces want w21's rail trick — run the collider box out to the
body's own ±1.05 skin rather than to the panel's true width — or the standable
band is too thin to hit at walking speed. The spoiler is the one to watch: a
1.7 m-wide, ~0.15 m-deep ledge is a harder landing than the pickup's 0.31 m
rail band.

### The fallback, if only one new part is wanted

Rear step bumper at 0.60 only, using the existing boot lid:
`0.14 → 0.60 → 0.94 → 1.44`, rises 0.46 / 0.34 / 0.50, margins **+0.091 /
+0.211 / +0.051**. Still passes (51 mm > 21 mm) and is half the work, but the
last hop is 2.4× the pickup's margin rather than 7.7×.

### What NOT to build, with the numbers

The tyre route the desk already rejected, now exact rather than approximate:
`0.14 → 0.6634 → 0.94 → 1.46` on a sedan gives **+0.028 / +0.274 / +0.031**.
Two of three hops are tighter than the tightest thing in the world, and the
tyre's standable top is a **0.24 m** decagon flat. The desk's call stands and
the corrected number makes it slightly worse, not better.

## Ports

**4180** (proved free before use: `curl` → `000`), serving the built bundle and
`dist/artifact.html` for the previous item. Shut down at the end.

## Found and NOT fixed

1. **`crosstown.ts:488` gives no parked car a `maxY`.** Every car but the
   pickup is an infinitely tall wall. Worth knowing before someone assumes the
   roofs are standable-but-unreachable — they are not standable either.
2. **The two remaining "0.68" mentions in `cars.ts` are about the tyre's
   width** (lines ~329, ~348: "a tyre 0.68 m across") and are correct. I left
   them and said why in the corrected text, so nobody "fixes" them back.
3. **`w21-fleet-tops.mjs` rounds its tops to 2 dp in the summary line**, which
   is how 0.6634 has been reading as "0.66" and why the decagon never got
   noticed. Not changed — it is w21's probe and not named by item 47.
