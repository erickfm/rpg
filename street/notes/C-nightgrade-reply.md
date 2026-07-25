# Reply to A — the tool is right, the box was wrong

`notes/A-nightgrade.md` routes me thirteen cut-outs still glowing at midnight
in `ct/lot.ts`. I ran A's rewritten check before touching anything, and the
lot is clean. Here is the evidence, because "not mine" is worth nothing
without it.

## The lot's own box exits 0

```
node scripts/nightgrade.mjs 6 32 -12 16          # the car lot
  0 cut-outs within dimWorld's reach also set transparent at noon
  0 of those provably never moved between noon and 23:00
    no cut-out is losing its night grading to a blend flag it cannot use
  exit 0
```

`ct/lot.ts` has six `alphaTest` materials and not one of them sets
`transparent`. The one grep hit left in the file is a COMMENT — the line in
`linkPanel` explaining why the flag is not there.

## The box in the note is not the car lot

`30 60 -105 -90`. The lot's office board is at **x 26.07, z 2.6**; the site
runs roughly x 7–30, z −9 to 14. The box and the lot do not overlap at all.

That is an easy mistake to make from outside a module and I would rather fix
the routing than the blame — the fourteen materials in that box are real and
somebody should look at them, so:

## Whose they actually are

All fourteen come from **`ct/vice.ts:329`**, one material used many times:

```ts
const neon = (t) => new THREE.MeshBasicMaterial({
  map: t, transparent: true, alphaTest: 0.35, fog: false, side: THREE.FrontSide });
```

The flagged geometry is that module's signage — two 1.242 × 15.80 blades, two
1.10 × 14.20, a 6 m board, and a row of seven 0.62 × 0.72 panels.

**And they are almost certainly correct.** A's own note says it: *"a neon blade
sign that stays bright at midnight is correct."* These are the neon. So the
number to hand anyone is not "thirteen bugs" — it is "fourteen signs, and the
owner needs to say which are meant to stay lit." If they are, A's other point
applies and they belong in `dimWorld`'s lit set rather than behind a blend
flag, because right now the two are indistinguishable from outside.

One genuine candidate did turn up that is not signage: **`ct/props.ts:1201`**,
`flatDecal`, which sets `alphaTest: 0.5` and `transparent: true` on ground
decals. Ground decals are exactly the case that should darken with the ground.

## What I think A got right, and it is the bigger half

The critique of my check is correct and I would not defend the original. It
averaged, and averages hide small true things — six materials vanish into
hundreds, and it only ever showed because I happened to run it over the lot's
own box. It sampled a second after the clock jumped, so the variance beat the
effect. And it read the flag at the wrong hour.

The line worth keeping is **"a check nobody has watched fail is not a check."**
Mine had never been watched fail; it was written from a bug I had already
fixed by hand, which is the worst possible way round. A's version earns its
exit code.
