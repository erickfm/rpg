# BLOCKED — builder E

## The park cannot be made deeper from my file, and 6.4 m is the real ceiling

Queue item: **"The park should be DEEPER."** I cannot do it and neither can
D alone. Two things, one of which is not obvious:

### 1. The depth constant is D's

The park SITE is `placePark` in `ct/street.ts` — `DEPTH = 7.0`, the ground,
the two flanks, the rear elevation, and the `PARK` extents it publishes.
`ct/park.ts` (mine) is what stands IN it. Making the site deeper is D's edit,
not mine.

### 2. The player is CLAMPED at x = −13.4, and that is the entry point's

`crosstown.ts`:

```ts
bounds: { minX: -FACE - 6.4, maxX: interiorMaxX(), minZ: -110.6, maxZ: 13 },
```

`-FACE - 6.4` is **−13.4**. It is a hard clamp in `FPRig.update`, not a
collider — you simply stop.

The park's back wall already stands at **x = −14.0**. So of the 7 m that is
built, **the player can only reach 6.4 m, and stops 0.6 m short of the rear
elevation**. That is very likely part of why the user says it reads as a gap
rather than a place: it is already deeper than you can walk.

**Any increase in park depth does nothing at all until that bound moves.**
Deepening D's constant alone would build a park you can see and not enter.

## What I need, and from whom

| who | what |
|---|---|
| **the desk** | raise `bounds.minX` in `crosstown.ts`. For a 14 m park: `-FACE - 15` (= −22). Check the alley (x to −14 at z −37…−43.5) still behaves — it is the only other thing out there. |
| **builder D** | `DEPTH` in `placePark`, plus the rear elevation and flanks that move with it |
| **the desk** | the number itself: how deep? |

## My recommendation

**14 m.** With 30 m of frontage that gives a 30 × 14 interior — the first
space in this world you could genuinely lose the street in, which is what
*"somewhere you cannot see from the sidewalk"* needs. 7 m gives you a verge.

Anything past ~16 m starts to want a second thing behind it, because the fog
does not close a hole that wide on its own.

## What I am doing meanwhile

Taking the next item and building `ct/park.ts` **against the `PARK` extents
D publishes rather than any hardcoded number**, so when the depth does change
the contents follow it without being touched again. That is the half of the
work that does not depend on this decision.

One thing I will need whatever the depth is: **`ct/street.ts` has to call
`buildPark`.** Nothing imports `ct/park.ts` yet. It is one import and one
line, in D's file — same shape as `buildCivic` already has.

_Written 2026-07-24. Delete when the depth is settled._
