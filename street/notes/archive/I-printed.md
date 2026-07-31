# The lot goes dark: 54 sheets that held full daylight are down to 12

Builder I, 2026-07-25. Part of my fourth queue item, taken on its own because it
closes a **separate user request** from the pole sign it was bundled with:

> *"make the unilluminated stuff darker. it should feel scarier at night."*

## What was wrong

`props.ts`'s `isSelfLit` calls a sheet a light when more than 8% of its texels
are bright and saturated, and hands it `FLOOR_SIGN = 1.0` — *a light source does
not dim when the sun sets*. A used car lot is saturated ink on white from end to
end, so **54 materials stood at full daylight brightness over a black yard**:
banners, price cards, windshield stickers, the buyer's guides, the office name
board, the pole sign, the arrow, the flag.

C had this open for weeks, sized it (*"39 sheets, hot fraction 8.6% to 97%"*),
and was right not to fix it from their side:

- **The heuristic is not at fault and cannot win.** A banner in `#e0a81c` yellow
  IS a bright saturated sheet. Printed signage and lit signage are identical in
  texels and differ only in whether anything is behind them, which a texture
  cannot show.
- **The palette could not be nudged under the threshold.** That worked for the
  bunting, which tripped it at 13.3%. At 62–97% hot there is no nudge — the
  sheet IS its artwork — and the pole sign at 85.3% is the one the user had
  enlarged and re-contrasted *for legibility from the far kerb*. Repainting
  approved work to slip under a checker is the wrong way round.

B landed the opt-out (`props.ts:446`, `m.userData.printed`) and it has been
inert since, because nothing declared itself. Now the lot does.

## What I did

One helper in `ct/lot.ts`, applied at eight signage sites:

```ts
const printed = <T extends THREE.Material>(m: T): T => { m.userData.printed = true; return m; };
```

The caller states what a material IS rather than having it inferred from pixels
— the same shape as `ctx.wet()` and as `notSignage`. Deliberately **not** applied
to the floodlight lens or the halo: those are lights, and dimming a light at
night is backwards. They remain the two declared `selfLit` materials.

## Measured

`scripts/mods-dim.mjs`, C's own instrument, unchanged:

```
  before   565 dim, 2 hold and say so (selfLit), 54 hold and do not
  after    607 dim, 2 hold and say so (selfLit), 12 hold and do not
```

Seen too — `shots/I-n-gate-aisle.png`, the aisle at 21:30. The yard is dark, the
price cards and banners are dark with it, and what stays lit is what should:
the `WE FINANCE ANYONE` neon and the office window.

## The salesman, who was the only person in the world that did not darken

He held full daylight brightness in a yard measured at 3% of noon, standing
beside fourteen citizens who dim. **Same fault as the banners, not a second
one**, and C's own correction is what proves it: the street's citizens come off
the same atlas and the same generator, and one of them is **23% hot and NOT
flagged** while the salesman is **13.2% hot and IS**. The 8% threshold never
decided it.

An 8-angle citizen is painted ink on a sheet, which is exactly what `printed`
means here, so he declares it and grades with the masonry. This closes the
"my two citizens do not dim" half of `BLOCKED-C.md` for the lot's one; the
walk-up hermit is C's and is untouched.

## The 12 that are left are NOT mine, and NOT a visible defect

All twelve are one object repeated once per car: the body slab in **`ct/cars.ts`
(H's)** — `BoxGeometry(1.8, BELT - ROCKER, slabLen)` with per-flank
`bodySideTex` materials. They report `1.000 -> 0.947`, a 5.3% drop, where the
rest of the lot drops 88–95%.

**I am not filing this as a defect the user can see, and the distinction
matters** (GOTCHAS 23). In `shots/I-n-gate-aisle.png` the cars plainly DO read
dark — the purple one is vivid at noon and deep at night. So what I have is a
measurement that disagrees with the picture, on one material per car, and the
likeliest reading is that `mods-dim` samples one face of a six-material box.

**For H, if it is worth a look:** the same `makeCar` builds the traffic fleet, so
whatever this is, it is not confined to the lot. I did not stamp `printed` on
them from my side on purpose — the material is built in H's file, and flagging
it from `lot.ts` would make *parked* cars grade differently from *driving* ones,
which is a worse world than the one I started with.

## Inert in daylight — with the control that makes that claim mean something

Scene fingerprint, same running world, with and without the change:

```
  with     textures=e1a92e28  structure=b17a4770   objects=6885
  without  textures=e1a92e28  structure=b17a4770   objects=6885
```

`tints` and `places` differed between the two — and **I did not report that as my
change until I ran the control**, which is two captures of *identical* code:

```
  ctrl-a   tints=45ed1f63  places=6398d1a7
  ctrl-b   tints=2429b257  places=c36e59f
```

Identical code, different hashes, and each control matches one of my two
readings. Those two fields carry run-to-run noise in this world and cannot
distinguish anything. The stable pair is identical, and no geometry, texture or
`rnd()` draw was touched.
