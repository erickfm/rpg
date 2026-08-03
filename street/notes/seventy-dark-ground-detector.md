# seventy — item 211, the dark-ground detector

> *"shadow fence still here. shadow geometry in general needs to be removed"*,
> *"get rid of shadow texture here pls"* — the user, six times.

**Built, gated, ratcheted and watched red three ways.** It is
`scripts/w5-shadow-census.mjs`'s second census, renamed `STEP` → `SHADE`, and
it is now part of the same exit code the BARE ratchet already owned.

---

## The one line that matters

**The road is DARKER than the alley floor the user rejected.** Measured on the
built bundle, with the pre-186 floor reconstructed from `2d1edb0ac`
(`scripts/probes/w70-ground-contrast.mjs`):

| surface | canvas mean | canvas sd | verdict |
|---|---|---|---|
| road (`tex-ground`, 154 m²) | **39.4** | **60.20** | approved, never reported |
| alley floor, pre-186 | **43.2** | **8.44** | the user's sixth report |
| sidewalk paving (both abut it) | 122.9 | 12.30 | the bright neighbour |

That is why two earlier predicates failed and why **no threshold on tone can
ever work**. On grain they are not close: the road carries **4.9×** its
neighbour's structure, the alley floor **0.69×**.

## The predicate

```
SHADE = darker than 0.45 of ground it abuts   AND   flatter than that ground
```

`GRAIN = 1.0` is a **comparison, not a tuned level**: it says *"less visible
structure than the ground beside it"*. That is exactly what shade does — the
world's grade is multiplicative, so it scales a texture's sd by the same factor
as its mean — and a different material has no such relation. A road has the
opposite one, because its lane markings are the brightest thing on it.

**The previous author's untested guess was right.** Its note said the road is
*"CONTINUOUS and IDENTIFIED — it carries lane markings"* and called that "a much
harder predicate". It is not harder; markings **are** standard deviation. Item
186 had already written the mechanism down without naming it as a predicate:
*"at 14.8/255 an sd of 8.4 has been compressed to about ±3 levels: there is no
visible structure left."*

**Effect: 29 STEP rows → 17 SHADE rows.** The road, its four segments and the
nine park/church patches drop out; the reconstructed alley floor is caught at
ratio 0.35, grain 0.69. Baselined at 17.

## Watched red — three separate failure modes, because they fail apart

| mutation | result |
|---|---|
| `--shadetest` — darken **and flatten** the alley floor | exit 1, `SHADETEST CAUGHT IT: street at -10.3, -40.3, ratio 0.173, grain 0.07` |
| `--selftest` — strip a ground texture (BARE, unchanged) | exit 1, BARE 62→63, 146→188 m² |
| comment out the warp → region cull hides the exterior | exit 1, `only 41 textured ground surfaces were examined, under the floor of 60 — NOTHING WAS MEASURED` |

`--shadetest` asserts **that specific surface appears**, not that a count moved.
GOTCHAS 79's second corollary: `texdensity`'s first selftest asserted
`gross.length`, which was 188 whatever you did.

Plain run: **exit 0**, `SHADE 17/17`, `115 textured ground surfaces examined`.
Two consecutive runs both 17 — stable, because the script seeds `Math.random`
before the world builds.

## Clock-invariance, and the instrument fault found getting there

The row required that it not flag legitimately dark places at night. It did.
**Run at 03:00 the count went 17 → 24**, and diffing the two lists showed all
seven extras measured against **one** surface: a lamp's spill pool at
(-34.8, -93), lum 150.7. Its opacity **animates** — under the census's 0.6 cut
by day, over it after dark — so every genuinely dark patch near a lamp acquired
a brilliant new "neighbour".

The clock is pinned at 13:00 twenty lines up, so this never bit a real run. But
a check whose answer depends on a constant elsewhere in the file is one edit
from being wrong, and the fix is not another threshold: **ask what the surface
IS.** `ct/props.ts:414` already identifies light as
`m.blending === AdditiveBlending`, and `vice.ts`'s `spill()`/`glowM()` build
exactly that. Light added to a surface is not a surface.

**After: 17 at 13:00 and 17 at 03:00.**

## What I did NOT do

**`--shadetest` is not wired into `npm run checks`, and it cannot be with the
mechanisms that exist.** Both routes are dead ends and both are written up at
the registration in `scripts/checks.mjs`:

- it cannot ride the existing row — `checks.mjs:1306` appends `--selftest` to
  **every** row, and BARE's mutation strips the same floor's map; a surface with
  no map has no mean, so it leaves SHADE's population and the shade assertion
  would fail for the wrong reason;
- it cannot be its own row with `selftest: false` — such a row still runs
  **normally**, so the mutation would be a permanent false red.

Its correct home is a **`canfail` case**, the same mechanism the
`masonry` / `masonry-blind` pair uses for exactly this "the verdict and the
floor under it fail apart" problem. I did not build it. Until then it is a
documented manual proof:

```sh
SHOT_URL=… node scripts/w5-shadow-census.mjs --shadetest    # must exit 1
```

**The 17 remaining SHADE rows are not all defensible and I have not triaged
them.** Ten are the car-lot bay slabs at ratio 0.04 (canvas mean 4.8) — already
an open ledger row from the 2026-07-31 shot review — and one is a `jail` surface
at (61.3, -103) whose material tint is 0.022, i.e. essentially black. Those look
like real finds. The ratchet is set so they cannot grow; lowering it is the next
person's fix, not a re-tune.
