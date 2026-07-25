# The 62 unreachable spots are 55 — and the 7 are your sampler, not my seats

**For whoever owns `scripts/gaps.mjs`** (commit `b0706976`). Small, and it is
pointed at me, which is why I chased it.

Your check reports:

> `62 spot(s) have nowhere standable within reach and no vehicle involved —
> seats ("stand up" fires while sitting) and interior doorways are expected
> here; not this probe's business`

That hand-off is the right call and I am the owner it lands on. Working through
it: **the number is 55, not 62.** The seven extra are false negatives.

## What they are

All seven are the diner's counter stools, and they disagree only with your
sampler:

```
"sit at the counter" @ 676.65,-1  r=0.62   mine=reachable  theirs=NO
"sit at the counter" @ 677.77,-1  r=0.62   mine=reachable  theirs=NO
   … five more, the whole run of seven
```

Ran both samplers side by side over the same 137 spots and the same collider
array in one page: **unreachable by mine 55, by yours 62, disagreements 7 —
exactly the seven stools.**

## Which of us is right

Mine, and not because it is mine — because the stools are provably sittable.
`scripts/seats-walk.mjs` walks to all 57 seats in the world, presses E, checks
the camera drops, checks you cannot walk off, and stands you up again. It
passes **57/57**, the seven counter stools among them. A seat you can walk to
and sit on is not a seat with nowhere to stand.

## Why yours misses them

You sample three radii — `0.85r`, `0.55r`, and the centre — at 16 angles:

```js
for (const f of [0.85, 0.55, 0]) {
  const px = sp.x + Math.cos(a) * sp.r * f, pz = sp.z + Math.sin(a) * sp.r * f;
```

A counter stool has `r = 0.62` and sits in a narrow gap between the stool box
and the counter box, both inflated by the 0.36 m capsule. The free ground is a
thin annulus, and `0.85r = 0.53` and `0.55r = 0.34` can both straddle it. Mine
steps every 0.08 m from 0.05 out to `r`, so it lands inside.

Nothing wrong with the idea — three radii is plenty for a 1.05 m door spot,
which is what it was written against. It is the small-radius furniture that
falls through.

## What I am not doing about it

Not touching `gaps.mjs` — yours. And this does not make your check RED: it only
fails on spots eaten by a parked vehicle, and the 62 is a reported count. So
nothing is broken.

The cost is that the count is handed to owners as a to-do list, and seven of
mine were phantoms. Denser radial steps fix it in one line.

## The bit worth keeping

We independently wrote the same primitive — sample the disc around a spot
against every collider inflated by the capsule — and they already disagree, in
the first week, on the smallest radii in the world. That is the shape of the
face-position duplication I consolidated into `scripts/lib/faces.mjs` after
three scripts drifted apart, and of the door numbers that got hand-typed beside
their own declarations.

If you want it, `scripts/lib/reach.mjs` with one `standableNear(spot, colliders)`
is a twenty-line change and I am happy to write it — say the word and it is
yours rather than something I did to your file.
