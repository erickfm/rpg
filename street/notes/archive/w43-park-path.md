# w43 — the park path: the corner, and the surface (items 90 + 89)

Port **4190** (dev) and **4191** (`vite preview`, the built bundle). Both shut
down at the end of the session.

Items **90** (the corner) and **89** (the surface) taken together — they are one
piece of geometry and fighting them separately would have meant rewriting the
same 60 lines twice. Item **88** (the bench) was claimed by **w44** one minute
after I claimed 90, so I did not touch bench placement; see *Found and not
fixed* below, which has a measurement w44 will want.

---

## Why it read badly, in one line each

**The corner:** the four edging strips each ran the FULL length of their leg
while the legs themselves stopped `CHAM` short of the turn, so all four overran
into the corner and crossed each other — the user photographed a **grey X
painted on the path**, and no amount of work on the corner *patch* would have
touched it.

**The surface:** isotropic 1-texel pepper at even density over a flat pale
field, identical shoulder to shoulder and end to end — **nothing about it said
people walk here**, which is the read of poured aggregate, not of ground.

---

## The corner: three faults stacked in one spot

1. **The turn was a separate rotated quad** dropped over the junction and drawn
   `PATH_W * 0.4` = 0.6 m longer than the gap it filled, so its square ends poked
   ears out into the grass past both legs.
2. **It was wider than the path.** A `PATH_W` band crossing a `PATH_W` band at
   45° covers `PATH_W / cos45` = **2.12 m** of it, so the turn measured half
   again as wide as either leg and read as a lozenge rather than a bend.
3. **The edging crossed itself in the middle of it** (above). This is the one
   the screenshot is actually of.

The item's three candidate reads were all partly right; the ranking was wrong.
The desk put the rotated patch first and the edging third. It is the other way
round — the patch is a *shape* problem you notice second, the grey X is what
your eye goes to.

### The fix

A path does not have corners; it has a plan. The loop is now **one closed
octagonal ring**, and everything that follows it — surface, edging, hoop rail —
is generated from that one function at a different offset.

The identity that makes it work, and the reason nothing can fail to mitre:

> offsetting a 45°-chamfered rectangle outward by `t` grows the rectangle by `t`
> on every side **and grows the chamfer by `t·(2 − √2)`**. Two rings built that
> way are a constant distance apart the whole way round, corners included.

Measured: **2×10⁻¹⁵ m** departure from 1.5 m at the worst of the eight edges.

Everything derives from `lx0/lx1/lz0/lz1`, `PATH_W` and `CHAM`, which already
existed. **No number was retyped** (BUILDER-BRIEF §8). The eight overlapping
coplanar surfaces the old corners needed the `LIFT * 1.25` y-separation hack for
are gone with them — there is not one overlapping coplanar pair left in the loop.

---

## The surface: the answer is not in the canvas

`slabTex({ grain: 0.18 })` was over its own documented **0.14 pebble threshold**,
so on top of the speckle it was laying 2 px stones at full contrast. That is the
confetti in his frame.

But re-rolling the noise is the change that already failed once, so the answer is
the **cross-section**, which is the one thing a tiling texture cannot hold. It
goes where this file already puts form in an unlit world: **vertex colour**, the
same technique and the same ~0.7–1.1 range `field`'s relief shading uses at
`park.ts:585`.

- a pale **spine** where feet go, falling away at the shoulders (`u²`, so it
  stays pale across the middle and dies only at the edges);
- the spine **wanders** with distance round the loop — this is where the
  direction of travel comes from, and because it is driven by arc length it
  carries through the turns instead of stopping at them;
- the outermost 100 mm goes **olive** as well as dark, so the edge is a margin
  and not a butt joint. That is the "no join between path and grass" candidate
  read, answered for free by the same mechanism.

Plus **one wrapped 4 m canvas for every path surface**, sampled through
world-metre UVs. Previously each rectangle carried its own independently-rolled
noise that stopped dead at its edge; now the grain runs straight through every
join. `lay()` got the same treatment, or the gate spur — the one join every
visitor crosses — would have stayed a flat rectangle beside a worn circuit.

**Two things came off the edging in the same pass, both his own words:**

- **flat, not proud.** It stood 70 mm up as a box, which is a *road kerb*
  profile — a road detail on a park path is exactly what this surface has now
  been rejected twice for.
- **it goes through `wet()`.** The path did and the edging did not, so in rain
  the path darkened and the edging stayed put. That is why in his own dim frame
  it reads as near-white rails flanking a dark brown path — the *"very stark"*
  he had already reported once, which the palette change only half fixed.

The **hoop rail** also follows the ring now. It used to be four axis-aligned runs
meeting at hard right angles, so every frame of a corner showed a square corner
drawn next to a mitred one.

---

## My verdict on the after-images

I have looked at all of them, at 13:20 dry and at 19:20 with `wetness 0.9` —
the second set because **his frames were dim and wet and mine were not**, and the
edging's whole problem only shows in weather.

- `/tmp/w43shots/wetbefore-corner-near-overhead.png` vs `wetafter-…` is the pair
  worth looking at. The "before" *is* his screenshot: a lozenge of bare earth
  with pale rails crossing it in an X and running on out into the grass. The
  "after" is one path turning a corner. **I will defend that one without
  qualification.**
- The surface I will defend as *much* better and not as finished. It now has a
  worn line that wanders and shoulders that die into the turf, and the confetti
  is gone. At noon it is still a little brighter and yellower than I would
  ideally have it; I pulled it down twice already (the first pass came out the
  colour of sand) and stopped rather than drift toward the grey it was rejected
  for the first time.
- One honest loss: at night the hoop rail used to be legible mainly because it
  was silhouetted against a bright edging strip. With the edging weathering
  properly, both are dark and the field's edge is softer after dusk. I think
  that is the right trade — it was legible for the wrong reason — but it is a
  real change and the desk should know it was deliberate.

---

## Proof

| | |
|---|---|
| width through every turn | 1.5 m ± 2e-15 (old corner: 2.12 m) |
| floor level under the band | 338 samples across the full width, 0.140…0.145 |
| walk the street leg into the turn | z −82.10 → −76.61, floor flat |
| walk the chamfer | 5.05 m, **0.000 m off the turn's centreline** |
| built bundle (`vite preview`, 4191) | same four results, `health.mjs` WORLD OK |
| `bugsweep.mjs` | **0 STATION MISS, 0 COVERAGE**, no new console errors |
| `tsc --noEmit` | clean |

`scripts/probes/w43-park-loop-walk.mjs`, `scripts/probes/w43-park-corner-shots.mjs`.

**Two of the probe's own first-run failures were the instrument, not the world**
(BUILDER-BRIEF §7), and both are now written into it: `pos()` is `[x, y, z, gy]`
so z is index **2**, and the forward vector is **`(sin yaw, −cos yaw)`**, not
`(sin, cos)`. Reading it the other way sent the "round the chamfer" test 7.9 m
across open grass, where it **passed for the wrong reason**. It now also asserts
you stayed on the turn's centreline.

---

## The `fp` recipe cannot answer this question — measured, not asserted

`npm run fp before` → change → `npm run fp after` → `npm run fpdiff` reported
**671 of 1461 textures and 1741 of 8379 structure rows differing**, which reads
as "you moved half the world".

It is not. I ran a control: pre-change `park.ts` with **one extra `Math.random()`
call added and nothing else whatsoever**. That produces **the same 671 differing
textures** and 1681 differing structure rows.

`scenedump.mjs` seeds `Math.random` so the art layer is reproducible, so *any*
change to how many draws happen before an object is painted re-rolls every
texture after it — and because a `structure` row embeds its material's texture
hash, `structure` follows `textures` wherever it goes. **For any change that
adds or removes a texture, `textures` and `structure` carry no signal at all.**

`places` is the field that does. Attributing it by hand:

- 386 distinct `places` rows differ; **378 are inside the park site**.
- Of the 8 outside: 2 are street props at 1–2 cm (a pigeon; the documented noise
  floor), 3 are `0,0,0`-ish, and 3 are `Mesh@0.00,0.14,±0.29` / `@0.00,0.29,0.00`
  — my hoop children, which are now reported in **local** space because each
  hoop became a `Group`. The `Group` carries the world position.

**Nothing outside the park moved.** Worth queueing: either `fpdiff` should say
this out loud, or `scenedump` should hash textures by *content the author chose*
rather than by painted pixels — as it stands the project's mandated proof recipe
gives a builder 671 red lines for a one-line change and no way to tell that from
a catastrophe.

---

## Found and NOT fixed

**1. Seven colliders stand inside the park loop — and four of them are benches
0.16 m into the walk.** This is item 88's family and w44 holds it, so I left it
alone, but item 88's brief only records the bench 0.36 m onto the **sidewalk**.
This is a second, separate encroachment: onto the **park path itself**.

| centre (x, z) | into the 1.5 m walk |
|---|---|
| −28.00, −93.05 | **0.160 m** |
| −28.00, −72.95 | **0.160 m** |
| −18.60, −93.05 | **0.160 m** |
| −18.60, −72.95 | **0.160 m** |
| −12.08, −78.80 | 0.040 m |
| −33.67, −88.00 | 0.040 m |
| −33.67, −78.80 | 0.040 m |

**It is pre-existing and this pass did not cause it**: the loop's centreline and
`PATH_W` are unchanged, and the only width change is that the corners got
*narrower* (2.12 m → 1.5 m), so the encroachment can only have stayed the same or
reduced. `scripts/probes/w43-park-loop-walk.mjs` check 4 is the red check item 88
asks for — it already fails on this and prints the depth.

**2. `claim.sh --help` claims an item.** `mode=${1:-}` falls through to
`who=$mode`, so `--help` is taken as an agent name; it claimed item 93 for an
agent called `--help` before I noticed. It had reverted to TODO by the time I
looked, so nothing is stuck, but the next person to type it will not be so
lucky. A one-line guard on `--*` would do it.

**3. The park's `notes/QUEUE.md` is tracked in git in the builder worktrees** but
the shared queue `claim.sh` actually writes lives in the *main* worktree. A
`git stash` in a builder worktree therefore picks up a stale tracked copy and
conflicts on `pop`. `claim.sh:29` already says the queue "MUST NOT LIVE IN GIT";
it still half does.
