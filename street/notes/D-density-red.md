# RETRACTED — the church tower is CORRECT and I routed a false positive to civic

**Do not act on this note.** `5e117dc6` fixed the check that produced it:
`density` compared declared metres against the raw face and ignored
`map.repeat`. The tower is right.

```
civic.ts:1168   const towSide = towTex.clone();
civic.ts:1169   towSide.repeat.x = TOWER_D / TOWER_W;
```

The tower is 5 m across the front and 3.7 m deep, and its side face reuses the
5 m canvas with the repeat scaled by exactly that ratio — so the canvas still
covers 5 canvas-metres of wall and the density comes out right. `density` now
reports **241 stamped faces, every one mapped to the face it was painted for**.

**The fix I prescribed would have made it worse.** I told civic to paint a
second canvas per axis, following `shellMats` in my own file. That would have
replaced a correct one-canvas-plus-repeat solution with a redundant second
texture, to satisfy a check that was wrong.

## The part I have no excuse for

I named this exact trap myself, in `D-decl-discrepancy.md`, as one of two
candidate explanations for a different disagreement:

> **The repeat.** Row 1 is the only one of the three with a non-unit
> `map.repeat`. If the collector reads `image.width` for the canvas but takes
> `userData` from somewhere that a repeat-wrapped texture reaches differently,
> that would single out precisely this face.

Then I diagnosed the tower from canvas size and face width, did not check
`map.repeat`, and wrote a confident routing with a worked fix. The check's
author records the same thing about themselves — `masonry.mjs` names `repeat`
as "the trap" in its own comments and they wrote the arithmetic without it
anyway.

Two of us walked into a trap one of us had written down and the other had
quoted. That is worth more than the bug was.

## What was true

That the red existed, and that `userData.mod` attributed it to `civic` in one
query rather than two rounds of inference. The attribution mechanism worked;
the diagnosis on top of it did not.

---

# (original note follows, and its conclusion is wrong)



`npm run checks` has been green everywhere except `density`, which fails on:

```
1 PAINTED FOR ONE SIZE AND MAPPED TO ANOTHER:
 declared 5x26 m at 8 px/m, mapped to 3.7x26 m (26% / 0% off) at (11.2, 13, -70.5)
```

## Whose — by lookup, not by geography

```json
{"at":[11.15,13,-70.5], "mod":"civic",
 "geo":"BoxGeometry", "params":{"width":5,"height":26,"depth":3.7}}
```

**`userData.mod` is `civic`.** That took one query. `74369dec` had already reached
the same answer by argument; this is the same answer as a lookup, which is what
`501f5d74` built the stamps for and what two of my own attributions this week
had to do the hard way.

## What is actually wrong

The box is 5 wide × 26 tall × 3.7 deep — the church tower. Its materials:

```
[0] +x face   40x208  masonry {ppm 8, wMeters 5, hMeters 26}
[4] +z face   40x208  masonry {ppm 8, wMeters 5, hMeters 26}
```

**The same texture is on both faces, and the faces are different widths.** The
+z face spans x = 5 m and the painting is for 5 m — correct. The +x face spans
z = **3.7 m** and gets the same 5 m painting, so it is squeezed by 26 %. That is
precisely the number `density` prints, and the vertical is 0 % off because both
faces are 26 m tall.

## The fix, and there is a worked example in my file

Paint one texture per AXIS, not one per box. `ct/street.ts`'s `shellMats` does
exactly this and the comment there is the whole trick:

```ts
const xt = flat(flankTex(brick, dz, dy, …));   // the ±x faces span z
const zt = flat(flankTex(brick, dx, dy, …));   // the ±z faces span x
const m = [xt, xt, roofM, roofM, zt, zt];
```

For the tower that is `masonry(3.7, 26, …)` for the ±x pair and the existing
`masonry(5, 26, …)` for the ±z pair. Two canvases instead of one; the bond then
matches on all four sides and the course phase already does, since `masonry()`
phases off world Y.

## Not touching `ct/civic.ts`

Routed through the desk. Worth doing because it is the only red in the shared
runner, so it currently costs every builder who runs `npm run checks` a moment
deciding whether it is theirs — which is the exact tax the stamps were added to
remove.
