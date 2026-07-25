# The used car lot — builder C

`ct/lot.ts`, mine. Built, verified, committed (`0ebec56a`). **Not wired in.**

---

## Status: done except the one thing I was told to wait for

The module is complete and shot from 21 angles (`scripts/lot.mjs`,
`shots/lot/`). What is missing is the roster: `placeLot(zN, zS)` takes the
frontage, and D's span has not come through yet, so nothing calls it.

I verified it by wiring it **locally** at the span CAFE + HARDWARE occupy
today — z 14.2 → −9.0, which is exactly the 23.2 m the brief quotes — taking
the shots, and then reverting. `street.ts` and `crosstown.ts` are untouched
and `ownership.sh` is clean.

## To wire it, the caller needs three things

```ts
import { buildLot, LOT } from './lot';
buildLot({ scene, flat, wet, KERB_H, obstacle, onFrame }).placeLot(zN, zS);
```

1. **It cannot be built from `ct/street.ts` as it stands.** `buildStreet` is
   not passed `onFrame`, and the lot needs it for the floodlight. Either
   street.ts gains `onFrame`, or the lot is built from `crosstown.ts`, which
   already has the full `CtxBuild`. The second is how I tested it.
2. **The block-long east collider has to be notched for the gate.**
   `crosstown.ts` hand-writes the east side as one box (`x FACE-0.3 → FACE+8`,
   z −96 → 20). That runs straight across the lot's mouth, so **the lot is
   not enterable until it is notched** — the same thing the library courtyard
   needed. `LOT.gate0` / `LOT.gate1` publish the mouth in z so the notch can be
   read off one import instead of copied by hand, exactly as `COURT` does.
   This is the same blanket-collider problem already routed to D as `bcd2c82`.
3. **Register the lot with the night dimmer** (`props.ts`'s `dimWorld`), or
   its opaque surfaces will not darken after dark like the rest of the block.

## Three things for other builders

**Builder H — cars.** The stock is `makeCar()` unmodified, seven of them, and
nothing in `ct/lot.ts` builds a vehicle. Two variants would earn their keep
here and are yours to make, not mine:
- **a car up on blocks**, wheels off — the one that is not for sale
- **one with the hood open** — a lot always has one being looked at

**Builder B — the night registry skips transparent materials.**
`props.ts:181` excludes any material with `transparent: true` from the dimmer.
That is correct for glass, but it also means every alpha-tested prop stays at
full daylight brightness after dark. In this lot the **chain-link fence and
the bunting glow at night** while the buildings behind them go dark — visible
in `shots/lot/21-night-pool.png`. It will hit any future alpha-cut prop, not
just mine, so it is worth a rule rather than a workaround.

**Builder D — two blank flanks.** Taking CAFE and HARDWARE off the roster
exposes the end walls of whatever is left either side, and those ends are flat
`endM` colour, not brick. A lot is exactly where you would see them. I did not
build party walls because their height depends on the neighbours the roster
ends up with, which is yours.

## Two things in the brief that do not exist yet

- **`ctx.seat()`** — the brief says F has landed it "with 29 seats already
  using it". It is not in `ct/ctx.ts` and nothing in the tree calls it. Nothing
  here needs a seat, so it did not block me, but the brief is ahead of the code.
- **`ct/park.ts`** — E has not landed it. The contrast with the park is
  therefore *designed*, not measured. The axes I built against are written at
  the top of `ct/lot.ts` so they can be checked once the park exists.

## What looking at it changed

Five things survived being reasoned about and died on contact with a
screenshot. Recorded because each one is a rule, not a one-off:

| what I built | what it looked like | what it is now |
|---|---|---|
| 2 m chain-link along the street | every car buried behind a grey haze | 1.15 m at the street, 2.0 m on the sides and back — the frontage exists to SHOW the stock |
| stock angled at −0.52 | nose-*into* the lot; every windshield, and so every price card, faced away from the pavement | nose-out at `π/2 − 0.5` |
| pennants drawn point-down in canvas | hung point-*up*, sitting ON the string like bunting on a shelf | flipped, verified by eye rather than by arguing about `flipY` |
| office board 80 px wide | "CROSSTO" — 9 characters at 2 px per texel is 108 px | both the board and the price cards size their canvas from the string |
| a floodlight | a pole with a box on it | a stepped halo at the lens and a pool on the asphalt, faded in with `f.night` |

The bunting got the most care on purpose: it is the one thing that says "lot"
rather than "car park" from the far end of the block. It hangs from its own
poles, and each swag is four segments on a parabola — strung level it reads as
a painted stripe, and only the sag says plastic on a string.

## Verification

`npm run build` clean · `ownership.sh` clean · 21 shots in `shots/lot/`,
including two after dark. The 2 m walk past the frontage is intact: the fence
collider's half-thickness is 0.10 against a fence line at `FACE + 0.12`, so the
whole box sits east of the building line.

**Not yet verified: that you can walk into it.** You cannot, today — the
blanket collider is across the gate. That check has to happen after the notch,
and it is the first thing to do once this is wired.
