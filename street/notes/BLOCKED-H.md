# Blocked — builder H

Work I have hit that I cannot do from the files I own. Nothing here is blocking
my queue: I flagged each one and moved on to the next item. Both are in builder
B's modules.

---

## 1. The side street has no lamps, and is unlit after dark

**Wanted by:** the side-street item (*"the lamps … east along it until the fog
takes them"*). Everything else in that item landed — trees in dirt pits and
parked cars, thinning eastward.

**Why I stopped:** the bishop-crook lamp is built inline in `ct/props.ts`, and
more to the point the lamplight registry it feeds — `lampHeads` — is **private to
that module**. `props.lit(obj)` only registers a thing as *lit by* existing
lamps; there is no way to add a lamp HEAD from outside. A lamp built in
`ct/sidestreet.ts` would be a dark post that lights nothing, which reads worse
than no lamp at all.

**What would unblock it:** `ct/props.ts` exposing a lamp factory on its `Props`
interface — something like `lamp(x, z, yaw)` that builds the pole and registers
its head — and then I place them down the side street with the same falloff the
trees and cars use. That is a desk operation on B's file, not a drive-by.

**Visible consequence today:** walk east down the side street after dark and it
is black, while the main street glows. The trees and parked cars I added out
there do go dark correctly (they are registered with `props.lit` and swept into
`dimWorld`), so the moment lamps exist they will pool light on them for free.

## 2. No catch basins down the side street

**Wanted by:** the same item (*"the catch basins … east along it"*).

**Why I stopped:** `ct/tex-ground.ts` places exactly two, at the junction low
points where the gutter pan actually drains to (`basin(ROAD_HALF, -92.5, 1)` and
`basin(-ROAD_HALF, -105, -1)`). Adding more means deciding where the side
street's pan falls, which is that module's business — the grate has to sit at a
low point or it is decoration in the wrong place. The kerb, gutter pan and
sidewalk already run the full length of the side street, so this is the only part
of "carry the ground detail east" that is outstanding.

**What would unblock it:** builder B deciding the side street's drainage and
adding the basins, or telling me the low points and exporting `basin()`.

## 3. One vehicle-adjacent gap I could not close, and why it matters more than it looks

**State:** `ct/gap.ts` now constrains both parked draws (main street in
crosstown.ts, side street in ct/sidestreet.ts). Every corridor that involved a
parked car or one of my side-street trees is gone. **One remains** and
`scripts/gaps.mjs` fails on it:

```
0.80 m slot on x at (-5.35, -28.56)   boxes 0.50x0.50 vs 2.10x5.20
```

That is a 0.5 m kerb prop of builder B's against the parked pickup. Measured off
`__ct.colliders()` the two boxes are:

```
prop   x -6.25 … -5.75   z -28.39 … -27.89
truck  x -4.95 … -2.85   z -33.72 … -28.52
```

which by my reading **overlap on neither axis** — the truck's `maxZ` is -28.52
and the prop's `minZ` is -28.39, so they are 0.13 m apart in z and 0.80 m apart
in x, i.e. DIAGONAL. `ct/gap.ts` deliberately does not treat a diagonal gap as a
trap, because you can always leave one the way you came in. The probe flags it
anyway.

**So the two disagree, and that is the actual defect.** The rule exists twice:
once in `ct/gap.ts` (TypeScript, used at build time) and once inside
`scripts/gaps.mjs` (JavaScript, run in the page against the built world). Two
copies of a geometric predicate will drift, and here they already have — I cannot
tell from the outside which one is right without stepping through both.

**What would fix it properly:** expose the rule from the page — `__ct.gapRule` or
similar returning `corridor(a, b)` straight out of `ct/gap.ts` — and have the
probe call that instead of reimplementing it. Then the check and the constraint
are the same code by construction, the way the traffic probe reads
`__ct.traffic()` rather than recomputing what a car is doing. That needs one line
in crosstown.ts, which is desk-owned, so I have left it.

Until then, treat the single reported corridor as unconfirmed rather than as a
known trap: it is either a real diagonal (harmless, probe wrong) or my overlap
test is off by an epsilon (rule wrong). Both are cheap to settle with the shared
predicate in place, and expensive to argue about without it.

---

## Not blocked, for the record

- **Lamp-lit trees and cars on the side street** — done, they just have nothing
  to be lit by yet.
- **Traffic density** — `maxActive = 1` in `ct/traffic.ts` is a deliberate
  earlier decision, not a blocker. The junction is safe for two; it is one
  number when the user wants a busier street. See the U-turn caveat in
  `notes/feat-traffic.md`.
