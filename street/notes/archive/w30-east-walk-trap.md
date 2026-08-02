# Item 57 — the "0.45 m trap" on the east walk is a PEDESTRIAN

**Root cause, one line: there is no prop. The "0.5 × 0.5 prop at x 5.75…6.25" is
a citizen standing on the east walk lane, and w24's red-dump read a moving box
out of `colliders()` and reported it as static geometry.**

No world file was changed. Five probes were added under `scripts/probes/`.
Port **4193** (dev), proved free with `curl` before use and shut down after.

---

## What the item said, and what is actually there

> *A real 0.45 m trap … between a prop at `x 5.75-6.25` and the block face at
> `x 6.7`.*

`ct/bodega-corner.ts` contains no `6.7` and registers no prop on the pavement.
Measured instead (`w30-trap57-locate.mjs`, static set only — a collider counts
only if its footprint is identical in two samples a second apart):

- **512 of 518** colliders are static. **Nothing** in the static set lies
  anywhere in `x 5.75…6.25`.
- The six movers are three east-walk and three west-walk boxes, each exactly
  `0.500 × 0.500`, sitting at `x[5.750, 6.250]`.

That is a citizen, and the numbers are all published:

| number | where it comes from |
|---|---|
| east walk lane `x = 6.00` | `ct/crowd-net.ts:87` `EAST_X = ROAD_HALF + IN`, with `ROAD_HALF = 5.0` (`ct/rng.ts:3`) and `IN = 1.0` (`crowd-net.ts:32`) |
| citizen half-width `0.25` | `ct/crowd.ts:167` `minX: lane - 0.25, maxX: lane + 0.25` |
| the face at `6.70` | `ct/bodega-corner.ts:220` `solid({ minX: BX0 - 0.3, … })` with `BX0 = FACE = 7.0` (`ct/rng.ts:5`) |

`6.70 − 6.25 = 0.45`. **Derived, not retyped** — every value above was read out
of the live module or the source line cited, per BUILDER-BRIEF §8.

`w30-trap57-045.mjs` closes it: a *synthetic* citizen box at lane 6.00 placed
anywhere inside `z −94…−86` makes `trapAgainst` return **exactly `0.450`**, and
that band is the z-span of the **only** east face at `minX 6.700` — every other
east face is at 6.88 or 7.00, which is why the same citizen reads 0.630 / 0.750
everywhere else on the street. So the number is reproducible and it is a
citizen's, not a prop's.

The band is not exotic, either: over 120 s the east walkers were inside
`z −94…−86` in **114 of 736** observations (`w30-trap57-045.mjs`).

## Walked, not measured from above — which is what the item asked for

`scripts/probes/w30-trap57-walk.mjs`. Only **W** is ever held; holding W+D at a
diagonal yaw sums to a cardinal direction and would measure a stall the test
caused itself (BUILDER-BRIEF §7). The 6.700 face's z-span is read off the live
collider set rather than typed, so a moved wall cannot leave the probe measuring
empty pavement.

- **A. Traversal — 8/8 crossed the band.** Four southbound, four northbound,
  along the lane, 6 s of held W each. Every run came out the far side.
- **B. The wedge — 6/6 left the player free.** The player was warped 1.6 m
  up-street of a citizen *actually standing inside the band* and walked into it
  for 2.6 s (past the 1.4 s ghost timer). "Stuck" is judged the way w22 argued
  it must be — **moving nowhere**, not "blocked in the direction I was holding" —
  so all four keys are tried afterwards. Worst case was 3 of 4 directions free;
  never 0. One wedge caught `ghost=true` in the act, and the player walked 4.43 m
  straight through.

This is `ct/crowd.ts:391-395` working as written — *"they never wall you in for
good"*: `:403` flips a citizen non-solid after 1.4 s pinned against you, `:404`
makes it solid again once you are 1.4 m clear. I did not take the comment's word
for it; the wedge run is the evidence.

## Mutation test — the instrument can see the defect the item describes

The honest risk with a "premise is false" verdict is an instrument too blunt to
find the thing. So I **built the item's own hypothesis** and confirmed the walk
goes red on it: one line added at `bodega-corner.ts:221`,

```ts
solid({ minX: 5.75, maxX: 6.25, minZ: -90.25, maxZ: -89.75 }); // MUTATION
```

— a genuinely static 0.5 × 0.5 prop exactly where the item says one is.

- **8/8 traversals FAILED**, against 8/8 passing on the real world.
- They stopped at `z −89.37` southbound and `−90.62` northbound — the prop's
  faces padded by the rig's `RADIUS = 0.36` (`fp.ts:87`) predict `−89.39` and
  `−90.61`. The instrument stops where the geometry says it should.
- **Bytes confirmed changed** both ways: `git diff --stat` showed `1 insertion`
  and the file's md5 moved `5f33fd0f…` → `d20b4818…` → back to `5f33fd0f…`.

So: if the item had been right, this walk would have caught it.

## Verdict on the DONE WHEN

1. *"the gap is passable"* — **yes**, 8/8 walked. The 0.45 exists only while a
   pedestrian is standing in it, and he walks on.
2. *"the V overlay shows no red there"* — **cannot be satisfied in the named
   file, and the clause rests on the false premise.** See below.
3. *"you have WALKED through it"* — **yes**, 8 traversals + 6 wedges.

## Found and NOT fixed — for the desk

1. **This is the item's real root cause, and it will manufacture more items:
   `trapAgainst` / the V overlay treat MOVING citizen boxes as trap candidates.**
   `ct/debug-collision.ts:128-153` colours every entry of the array it is handed
   by `trapAgainst(c, colliders)`, and `crosstown.ts:1387` hands it the live
   `colliders`, which `ct/crowd.ts:168` (`o.solid(box)`) puts every citizen into.
   A pedestrian is not a trap — it walks away, and it ghosts. The overlay
   therefore paints red along the **whole** east walk (0.63 at the 6.88 faces is
   also under the 0.95 threshold), and that false red is exactly what w24 wrote
   down and what cost this claim. **Files are `ct/gap.ts` + `ct/debug-collision.ts`,
   neither named by item 57, so I did not touch them** (BUILDER-BRIEF §9).
   `ct/gap.ts` is already queued as item 59 — worth folding in there.
2. **The bodega block eats 0.30 m of the sacred 2 m lane.**
   `bodega-corner.ts:220` sets the footprint collider at `FACE − 0.3`, leaving
   **1.70 m** of clear walk against 2.00 m elsewhere; its neighbours sit at 6.88
   and 7.00. `FACE − 0.3` is the *old blanket-footprint* pattern that
   `ct/street.ts:807-819` explicitly removed for the church, and
   `ct/tex-world.ts:1038-1046` records that the 0.30 reserve was repeated for a
   whole session without checking and is **not** what makes the shopfront relief
   safe (measured: collider 0.12 m out, deepest relief 0.20 m). I did **not**
   change it: pulling the collider back could expose the bodega's own mouldings
   to being walked through, which is a different item with a different DONE WHEN.
3. **`w30-trap57-walk.mjs` is a probe, not a guard.** Nothing calls it, so it
   "stays in as a guard" in name only — the trap w22 named. It is mutation-tested
   and would suit `scripts/checks.mjs`, but registering it means editing a file
   item 57 does not name.
4. **Three static reds on the east walk are genuinely under 0.72 m** and are not
   citizens: `x[5.070,5.731] z[−35.92,−34.08]` gap 0.490,
   `x[5.230,5.410] z[−33.59,−33.41]` gap 0.490, and
   `x[7.000,7.360] z[−8.70,−2.04]` gap 0.620. I did not walk these — they are
   outside item 57's band and outside its file — but they are the shape of thing
   item 57 was *looking* for, and somebody should.

## Housekeeping

`scripts/bugsweep.mjs` on 4193: **0 STATION MISS**, 96 shots, no new console
errors (only the pre-existing THREE.Clock and Canvas2D `willReadFrequently`
warnings). No source file changed, so `fp before/after` was not run — there is no
diff for it to be a diff of.
