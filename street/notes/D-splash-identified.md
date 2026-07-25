# The x ±6.9 "stallriser/pilaster family" is the lamp wall-splash — `ct/props.ts`

Two rounds have now asked whose this is. `21292ebb` scoped it as *"a
stallriser/pilaster family at x ±6.9 at a consistent 9.41 px/m — whoever owns
it"*; `abd56062` ruled A out by canvas size and left it *"still unowned"*.

**It is `ct/props.ts:831`, the light splash a street lamp throws on the wall
behind it.** Not a stallriser, not a pilaster, and not masonry.

    ct/props.ts:584   const wallSplashT = pixTex(32, 48, …)   a radial gradient
    ct/props.ts:831   new THREE.PlaneGeometry(3.4, 5.0)
    ct/props.ts:833   position.set(splashSide * (FACE - 0.06), sidewalkY + 2.7, z)

`FACE - 0.06` is the x ±6.94 in the scan, and `sidewalkY + 2.7` is the y 2.84.

## How to recognise it next time without reading any source

Found by querying the scene for every face carrying a 32 × 48 map. Eight came
back, and their positions are the giveaway:

    x ±6.94, y 2.84, z = -9, -23, -37, -51, -65, -79, -93 … alternating sides

**Evenly spaced every 14 m, alternating west and east.** Nothing architectural
repeats on that rhythm — but the street lamps do, and each splash sits on the
wall behind one. Its own comment says so: *"light spilling onto the wall behind
each lamp, so the brick beside a lamp isn't as flat-black as the brick
mid-block."*

## Why the density question does not apply to it

It is a **radial gradient** — `createRadialGradient`, three colour stops,
`AdditiveBlending`, `opacity: 0` until the night curve raises it. There is no
brick module in it to agree or disagree with the wall behind. 9.41 px/m is not
a masonry density that drifted; it is 32 × 48 texels stretched over the size a
pool of light happens to be.

So this is the same answer as the park ivy, one class over: the seam tool found
a wall-sized face next to brick and could not see that it is light rather than
material.

## What it needs

One line in `ct/props.ts`, builder B's file, not mine:

```ts
declareSurface(wallSplashT, 'detail')
```

`'detail'` on the existing `SurfaceKind` union is the closest fit. If a
`'light'` kind is ever added — and the halo, pool and splash sheets would all
take it — that is the honest label, but adding to the union is a change to
`ct/paint.ts` and A's call, not something to bolt on for one texture.

Either way it moves eight faces out of UNJUDGEABLE, and the question stops
coming back.

**Not touching `ct/props.ts`.** Routed through the desk.
