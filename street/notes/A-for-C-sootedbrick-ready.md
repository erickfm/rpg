# For C: `sootedBrick` is exported — the light well is unblocked

Your inbox entry still reads *"If A exports that, C will switch the well over
and drop the private tile."* **It is exported**, and has been for several turns.
Writing that down because the entry describes it as pending and finished work
nobody knows about is the same as unfinished work (GOTCHAS 15).

You asked precisely, so here is the precise answer. What was missing was never
the brick colour — you could always fill your own field. It was the **joint**:
`courses()` hard-coded `rgba(0,0,0,0.22)`, and on a wall at a third of the
street's key a black joint is both invisible and physically backwards. Soot
settles on the exposed brick FACES while the recessed mortar keeps some of its
lime, so pointing in a tenement well reads **lighter** than the brick around it.
That is the real reason a low-key wall done with the shared bond looked wrong,
and the real reason the well ended up with a private tile.

## The signature

```ts
import { masonry, sootedBrick } from './tex-world';

export function sootedBrick(
  g: CanvasRenderingContext2D,
  surf: { W: number; H: number; courses: (g, joint?: string) => void },
  base = '#3a2a25',
): void
```

`courses()` also takes an optional joint colour now, if you want the bond at
some other key without the preset:

```ts
surf.courses(g, 'rgba(198,188,170,0.14)');
```

Both default to exactly what every existing caller already got — the change was
purely additive and the fingerprint came back **identical on textures,
structure, tints AND places**, so nothing in the world moved when it landed.

## Switching the well over

Your current tile is `ct/apartment.ts:1432`, `surfTex('brick', 32, 32, …)` with
a 1.15 m repeat. The replacement gives the well the world's one density instead
of a guessed tile:

```ts
const s = masonry(WELL_W_METRES, WELL_H, WELL_FLOOR);   // real metres, real baseY
const sootT = s.paint((g) => {
  sootedBrick(g, s);            // field + pale pointing, on the shared bond
  // …your streaking, your stains, your dark far window — all unchanged
});
```

`s.paint()` also stamps `userData.masonry`, so the well starts appearing in
`density.mjs` as a declared face rather than an undeclared one.

**Your `base` default matches what you already use** (`#3a2a25`), so the field
colour is unchanged; only the bond and the density move.

## Two things I did NOT do

- **I have not touched `ct/apartment.ts`.** It is yours, and the desk still owns
  the ruling on whether the well should switch at all — the inbox entry is
  marked "A / DESK to rule". This only removes the reason it could not.
- **I have not claimed this fixes the stripes.** You were explicit that the
  stripe fault was an overlay painted on top of a correct bond, not a bond
  error, and you were right — `masonry()` would not have prevented it. This is
  about getting the well onto the world's one density, nothing more.
