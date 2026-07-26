# `m.userData.printed` — the flag, and how to set it

**For builder I (the lot) and builder H (the citizens).** The desk asked for
this in one place without hunting. It is landed on mainline and inert until you
set it. Fuller measurements: [`B-printed-optout-owners.md`](B-printed-optout-owners.md).

## The flag

```ts
m.userData.printed = true;   // this sheet is INK, not a light — grade me like masonry
```

That is the whole API. `isSelfLit` in `ct/props.ts` reads it **before it looks
at a single pixel**, so it cannot be out-voted by the texture heuristic.

## Where to set it

**On the material, where the material is CREATED** — not in a pass over the
built scene. Every module builds before `props.dimWorld(scene)` runs
(`crosstown.ts` 241/402/419, against 491), so a stamp made during construction
is always in place before the grade. `dimWorld` then takes each material exactly
once (`litSeen`), so a stamp applied while it is already running can arrive
after that material has been claimed.

```ts
const m = new THREE.MeshBasicMaterial({ map: priceCardTex(), alphaTest: 0.5 });
m.userData.printed = true;                    // <- one line, at creation
```

## What it is for

Printed artwork in saturated ink and a neon tube are **identical in texels**;
they differ only in whether anything is behind them, which a texture cannot
show. So the heuristic calls a price card a light source and pins it at full
daylight. Roughly 40 sheets in the lot alone — price cards, windshield
stickers, sandwich boards, the pole sign, the fence banners — plus two citizens.

It closes the user's *"make the unilluminated stuff darker. it should feel
scarier at night."*

## Two things that will otherwise waste your time

**1. Expect survivors, and do not chase them.** Anything a module hand-declares
as a light keeps its brightness — `isSelfLit` is never asked about it, so
`printed` is never consulted. In the lot that is two materials:

```
  ct/lot.ts:1963   haloM.userData.selfLit = true;
  ct/lot.ts:1973   poolM.userData.selfLit = true;
```

Flag your ~40 sheets and expect **41 → 2**, the two being the halo and the lamp
pool. That is the finished state. A hand declaration outranking the heuristic is
the right way round. (I published a wrong reason for those two first — traversal
order on a shared material — and it was a guess; the real cause is above.)

**2. Four selfLit materials are SHARED.** One is worn by 22 lot meshes, so
flagging it grades all 22 together. Right if they are one reused sheet, wrong if
they are not — check before flagging that one. The other 109 are one material
per mesh.

## Do NOT repaint artwork to slip under the threshold

The desk ruled on this and C had already stopped. The palette is the user's and
approved, and the pole sign was enlarged and re-contrasted **for legibility from
the far kerb** — trading that back for night grading is the wrong trade.

## What it buys

Stamped on every lot material and measured, then reverted:

```
                    selfLit        mean night luminance
lot   before          41/242              0.2058
lot   with flag        2/242              0.0557      <- 3.7x darker
street  (untouched)   38/419              0.1259      unchanged
vice    (untouched)   27/62               0.5579      unchanged
```

Tell me when it is in and I will re-measure the lot at 23:00 so the row can be
closed on numbers rather than on the change having been made.
