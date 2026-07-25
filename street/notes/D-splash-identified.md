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

---

# Same again: the 8.57 px/m ground family is the lamp POOL

`c9a16d97` cleaned the list to **18 faces actually missing**. Five of them are
the wall-splash above. Five more are its partner:

    8.57 px/m, 5.6 x 5.6 m ground patches at
    (±4.1, 0, -23) (±4.1, 0, -51) (20, 0, -98.9) (45, 0, -98.9) (34, 0, -107.1)

That is `ct/props.ts:742`, `lampPoolT` — a 48 x 48 radial gradient laid flat on
the pavement under each lamp head (`ct/props.ts:819`, `pool.rotation.x = -π/2`,
`position.set(headX, 0.02, headZ)`).

Identical reasoning to the splash: three colour stops, additive, flat on the
ground, one per lamp. Not masonry, no module to agree with the paving about.
8.57 px/m is 48 texels over the 5.6 m a pool of light happens to be.

**So ten of the eighteen are the same object — a street lamp — seen twice**,
once on the wall and once on the floor. Two `declareSurface` calls in
`ct/props.ts` close more than half the remaining list:

```ts
declareSurface(wallSplashT, 'detail')
declareSurface(lampPoolT,   'detail')
```

Both are B's line. Still not touching `ct/props.ts`.

## What the other eight look like, unverified

Recorded so nobody re-derives it, and flagged as **inference, not lookup** —
the distinction that has cost this session twice:

- `31.88x32 px/m at (-8.6, 0.1, -13)` — ground, inside the west building line
  at the library. Reads as `ct/civic.ts` courtyard paving.
- `8x8 px/m at (11.2, 13, -70.5)` and `(11.3, 8.5, -79.5)` — x ≈ 11, high up,
  on the church. Reads as `ct/civic.ts`.

Both E's if so. I have not queried either, and after this session's record I am
not calling them without doing so.
