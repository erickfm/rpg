# w81 — item 228, RELEASED with the scoping done and one of the row's two findings disproved

I took item 228, did the measurement half, and released it before running out of
room rather than land half of a world change. **Everything below is measured on
the built bundle at port 4370.** Two probes are committed; start from them.

## (2) THE ROW IS WRONG ABOUT THE NORTH BOUND. The coupling is INTENTIONAL and documented.

The row says the world's north bound being decided by an interior *"is almost
certainly unintended"*. It is not. `crosstown.ts:997-998`:

```ts
bounds: { minX: westBound(), maxX: interiorMaxX(), minZ: -110.6,
  maxZ: Math.max(13, interiorMaxZ()) },
```

and the four comment lines directly above it, at **`crosstown.ts:993-996`**, say
why in the author's own words:

> *"maxZ ASKS THE BELT, the way maxX always has. 13 is the end of the street; a
> room deeper than 26 m reaches past it and the player was clamped short of its
> own front wall, unable to reach the way-out spot at `hd - 0.55`. Measured by G
> on the casino at d 30 (BLOCKED-G 1b)."*

So it is deliberate, it mirrors `maxX`, and removing it re-breaks a measured bug
in the casino. **Do not "fix the coupling".**

**But there IS a real defect here, and it is a different one: the world has ONE
bounds rectangle for two places that are 600 m apart.** The street and the
interior belt share `maxZ`, so a deep room necessarily buys the STREET 6 m of
extra north walking it has no geometry for — `Math.max(13, 19) = 19`, and 13,
the street's own number, can never win. That is why every escape measured today
stopped at exactly z 19.00: **it is the clamp, and the clamp is the interior's.**

**The fix is a REGIONAL bound, not a decoupled one** — the belt keeps
`interiorMaxZ()`, the street keeps 13 — and it is a change to `fp.ts`'s bounds
handling (one rectangle today), which is a file item 228 does not name.
BUILDER-BRIEF §9: that is the boundary, and reporting it is the success.

**If it is done, every containment number measured today moves**, so
`w75-site-contained` must be re-run for all three sites with before/after, as
the row already says.

## (1) IS (-30, 12) REACHABLE? NOT ESTABLISHED — and here is exactly how far I got

`scripts/probes/w81-item228-walk-to-the-hole.mjs` **walks** it. The only warp is
to (0, 0), the middle of the road; everything after is held keys through the
real input loop. Greedy: face the target, hold `w`, strafe when progress stalls.

```
WALKING to (-30, 12)   did not reach — closest approach 23.80 m, at -6.31, 9.73
WALKING to (-30, 18)   did not reach — closest approach 24.03 m, at -6.33, 13.84
```

**It is stopped dead at x ≈ −6.3 both times, and the collider map says why.**
`scripts/probes/w81-item228-lay-of-the-land.mjs` finds only **9 colliders** in
the whole quadrant x −42…10, z 0…22, and two of them are the entire story:

| x | z | what it does |
|---|---|---|
| −22.9 … −6.7 | −5.0 … 14.2 | the west building line — seals x < −6.7 for the street's whole north half |
| −7.0 … 7.0 | 14.2 … 20.2 | the street's north end wall — seals the full road width |

**They overlap in BOTH axes** (x −7…−6.7, and z meeting exactly at 14.2), so
there is no diagonal gap at the corner. From the street, the north-west quadrant
is sealed.

**WHAT I DID NOT TEST, AND IT IS THE LIKELY WAY IN: the PARK, to the south-west.**
`westBound()` was widened to `-FACE - 33` specifically so the player can walk
into the park (`crosstown.ts:985-992`), and the park is south of this block. A
player in the park is already west of x = −22.9; walking NORTH from there is
the route my greedy walker never looked for, because it only ever headed
north-west and the way in is south first. **That is the next builder's first
20 minutes: park → north along x = −30 → z 12.** Do not re-derive the collider
map; it is above.

> A failed greedy walk is not proof of containment. My probe says so in its own
> output, deliberately.

## (3) THE INSTRUMENT FINDING, WHICH I THINK IS THE MOST VALUABLE THING HERE

**`groundAt` reads exactly 0.00 at every one of the 297 points I sampled across
x −42…10, z 0…20**, except the two sidewalk strips at x = ±6 (0.14). The
suspected hole at (−30, 12) reads 0.00 and the middle of the road reads 0.00.

`groundPick` never returns null — it names a height for every point in R²,
including void — so **"the player walks to (−30, 18.00) on NO FLOOR" cannot be
established from a height reading, and neither can its opposite.** Any
containment probe that decides "floor / no floor" from `groundAt` alone is
measuring nothing out there, and reports whichever answer its threshold picked.

**So the sweep the row asks for needs a different question**: not *"what height
is here"* but *"does any drawn ground mesh cover this point"* — a downward
raycast against the scene, or a footprint test over the ground meshes. That, run
over a GRID of the world bounds rather than seeded per site, is the instrument
that closes the "ground owned by no site is unswept" gap. It is also the honest
way to answer (1) without walking every metre.

## What I did not do

Nothing was changed in `src/`. The two probes are committed, the collider map
and the walk numbers are above, and the row's finding (2) is disproved with a
line citation. `w75-site-contained` was NOT re-run: nothing moved, so its
numbers are still whatever they were (the brief records it RED at the lot with
10 escapes, correct, item 221 — do not loosen it).
