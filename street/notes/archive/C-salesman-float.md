# The floating salesman is the atlas, not the call site — for H

The user: *"your car lot salesman's feet end above the asphalt with a visible
gap. FIRST, DIAGNOSE WHOSE IT IS, because the answer changes who fixes it and
this could be world-wide."* Ref `shots/user-salesmanfloat.png`.

**It is world-wide, and it is the sprite, not the lot.** Do not spend time on
`ct/lot.ts`; the number it passes is exactly right.

## The two hypotheses, and what each predicts

The desk set this up properly, so it was decidable rather than arguable:

- **a wrong call-site y** — shows up as a gap between `mesh.position.y` and the
  ground under that x/z, and *only for the one caller*
- **transparent padding below the feet in the atlas frame** — a property of the
  sprite, so it is *the same for every figure in the world*

Those disagree everywhere except on the salesman himself, which is why the
street pedestrians are the whole test.

## Measured

`__ct` traverse for every mesh built like a citizen (0.95 x 1.9 plane, atlas
`repeat` 5 across by 2 down), ground taken from the world's own picker at each
figure's x/z, padding read out of the atlas canvas by scanning up from the
frame's bottom edge for the first row with any alpha:

```
  mod      pos.y   ground   call-site gap   atlas pad below feet
  lot      0.140   0.140    +0.000 m        4/64 px = 0.121 m     <- the salesman
  (none)   0.140   0.140    +0.000 m        4/64 px = 0.129 m
  (none)   0.140   0.140    +0.000 m        4/64 px = 0.108 m
  (none)   0.140   0.140    +0.000 m        4/64 px = 0.115 m
  (none)   0.140   0.140    +0.000 m        4/64 px = 0.125 m
  (none)   0.140   0.140    +0.000 m        4/64 px = 0.112 m
  (none)   0.140   0.140    +0.000 m        4/64 px = 0.121 m

  call-site gap:  min 0.000  max 0.000
  atlas padding:  min 0.108  max 0.129
```

Seven citizens, seven identical verdicts. **No call site is wrong** — every
figure including mine sits exactly on the ground the picker reports, to the
millimetre. **Every figure floats**, by 4 empty rows out of a 64-row frame,
scaled by that figure's own `h`. The 0.108-0.129 spread is nothing but height
scale; the defect is one constant.

## Why

`citizens.ts:394-395`:

```ts
const geo = new THREE.PlaneGeometry(0.95, 1.9);
geo.translate(0, 0.95, 0);                 // origin at the feet
```

The comment is the intent and the intent is right. But it moves the origin to
the frame's **bottom edge**, and the feet are not on the bottom edge — the
atlas leaves 4 rows of transparency under them. `crowd.ts:141-142` is the same
two lines, which is why the street has it too.

So `geo.translate(0, 0.95, 0)` wants to be `geo.translate(0, 0.95 - FOOT_PAD, 0)`
where `FOOT_PAD` is the empty rows expressed in metres — 4/64 * 1.9 = 0.119 —
or, better, the atlas should stop leaving the rows and the number stops
existing. Either is H's call; both are one line in a file that is H's.

**Do it in `citizenSprite` and `crowd.ts` together, or the street and the lot
will disagree by 12 cm**, which is worse than both floating.

## One thing this probe got wrong first, worth having written down

Street pedestrians use MIRRORED atlas views: `repeat.x` is **-1/5**, not 1/5.
My first filter tested `repeat.x === 1/5` and matched only the salesman, so the
answer came back "1 citizen sprite" — a decisive-looking result from a sample
that excluded the entire group the test was about. My first fix for that then
computed the frame width as `img.width * repeat.x`, which is negative for a
mirrored view, so the pixel scan ran zero times and every street pedestrian
reported `n/a` padding. GOTCHAS 34 twice in one script: it found nothing
because it looked at nothing, and both times it looked like a clean run.

Also worth knowing for anyone probing sprites: a 0.95 x 1.9 plane is **not** a
unique signature for a citizen. Filtering on geometry alone picked up interior
fittings and a neon sign, and the ground query then cheerfully reported a
figure floating 19.6 m.

## Not touched

`ct/lot.ts` is unchanged by this note. The salesman's `position.set(..., Y, ...)`
is correct and stays; when H fixes the anchor he drops to the deck along with
everybody else, with no edit here.
