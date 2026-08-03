# item 252 — the tyres now stand on the road, and the fix was PHASE not position

Worker ninetynine, 2026-08-03. Port **4560** (4553/4554 were taken), verified on
the **built bundle** at `npx vite preview --strictPort`. Commit `3d70c92a9`.

The row's diagnosis was **right, exact, and complete** — one of the few. It said
*"a decagon stands on its FLAT, not its vertex"* and that is precisely the bug.
Worker ninetyeight's scoping note (`notes/ninetyeight-item113-wheels-scoping.md`)
handed it over with the number already measured. I did not have to re-derive
anything; I had to decide *which way to close the gap*, which is where the row
expected a trade-off and there turned out not to be one.

## What changed — `src/proto/ct/cars.ts`

| | |
|---|---|
| `tyreGeo(r, width, segs)`, new, module scope | `thetaStart = Math.PI / segs` — half a segment, so a **vertex** is down |
| car wheel, was `new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10)` | `tyreGeo(0.34, 0.24, 10)` |
| bus wheel, was `new THREE.CylinderGeometry(0.44, 0.44, 0.28, 10)` | `tyreGeo(0.44, 0.28, 10)` |
| jacked car `body.position.y` | `0.022` → `0.0208` |

Plus four comments that recorded 0.6634 as the tyre's top, each now saying what
it was, what it is, and why it moved.

## THE ROW SAID "DO NOT SIMPLY SUBTRACT 16.6 mm" AND IT WAS RIGHT — SO I DIDN'T

The row's worry: the tyre top is a climb step clearing by only 28 mm, so seating
the car spends more than half the margin. True of **three** of the four possible
fixes, and I checked all four before touching anything:

| fix | gap | tyre top | cost |
|---|---|---|---|
| drop the wheel to `ground + apothem` | 0 | 0.6634 → **0.6468** | half the margin |
| drop the whole car 16.6 mm | 0 | **0.6468** | same, plus sill/arch/colliders move |
| grow `r` to `0.34/cos(π/10)` = 0.3575 | 0 | 0.68 | a 5 % bigger wheel; `ARCH_HW` was tuned against 0.34 |
| **turn the polygon half a segment** | **0** | **0.68** | **nothing moves** |

Half a segment of phase changes **no position and no dimension**. N being even,
putting a vertex at the bottom puts one at the top too — so the tyre reaches
down by exactly `r` *and* up by exactly `r`. The gap closes **and** the top
rises. The margin is bought, not spent.

**The world already contained the proof.** ninetyeight measured the trailer's
wheels at `gap 0.0000` and called them "the only correctly seated pair in the
world". The reason is that they happen to be phased onto a vertex. I copied what
already worked.

`Math.PI / segs` is **derived, not typed** (BUILDER-BRIEF §8): change the segment
count and the phase follows.

## Measured, before → after

`scripts/probes/w99-tyre-seating.mjs` (new; world AABB vs `groundAt`, per
geometry, population floor, **both signs**, `--selftest`):

```
                 BEFORE                      AFTER
car tyre  n=82   gap +0.0166   top 0.6634    gap +0.0000..+0.0001   top 0.6800
bus tyre  n= 4   gap +0.0215   top 0.8585    gap +0.0000            top 0.8800
trailer   n= 2   gap  0.0000   top 0.4400    gap  0.0000            top 0.4400  (untouched)
jacked corner    +0.1171                     +0.1000
```

**Five runs, spread zero** — five byte-identical lines, exit 0 each
(`scripts/probes/w99-five-runs.sh`).

Every kind, freshly built through `carVariant`
(`scripts/probes/w99-tyre-kinds.mjs`): sedan / hatch / pickup / van all
`low +0.0000` and `top 0.6800 = 2r`, 4 wheels each. Live world **parked** 82
wheels all contact; **moving**, sampled 4 s apart, 4 wheels all contact. Zero
console errors.

## ⚠ THE ROW SAID "EVERY CAR TYRE". THE BUS FLOATED TOO, AND NOBODY HAD SEEN IT

**4 bus wheels, 21.5 mm**, `0.44 − 0.44·cos(π/10)`, same cause, same file.

It was invisible because of the instrument, not the world: `w98-wheels.mjs`'s
`isWheel` predicate is `(r === 0.34 && seg === 10) || (r === 0.22 && seg === 12)`,
so the r = 0.44 bus never reached its offender list. Its *grouped* table did
print the bus, which is how I caught it — the summary was honest and only the
ranked list was narrow. Fixed here because it is the same defect in the same
file; `w99-tyre-seating.mjs` now declares all three wheel kinds with a
population floor each, so an absent kind is `exit 3`, not silence.

## ⚠ A CONSTANT THAT WAS DERIVED FROM THE BUG — AND MY FIRST FIX OF IT WAS WRONG

The jacked car's lift carried this comment:

> *every road wheel in the world floors 0.017 m above the ground under it
> (80 of 88 on the block, one figure, no spread), so **0.017 IS contact here***

**That 0.017 was item 252's bug, being used as the definition of contact.**
Exactly the failure the brief warns about: a constant that was right until the
thing it was derived from moved. Left alone, `0.022` would have held the jacked
car's two grounded wheels 8.4 mm in the air over a fleet that had just come down.

**And my first correction was also wrong, caught by measuring.** I read "8 mm
proud" out of that same comment and subtracted it → `0.0136`, and w99 measured
the grounded pair at **−7.2 mm, sunk into the tarmac**. The 8 mm described an
*abandoned trial at lift 0.03*; the shipped 0.022 actually left the pair 0.6 mm
proud (+0.0172 vs the fleet's +0.0166). Reading a stale comment as current
turned a 1.2 mm correction into an 8.4 mm one. The measured value is `0.0208`.

**The jacked corner comes right as a consequence.** It stood 0.1171 m proud
where its own line says the design is *"0.10 m of lift"* — the extra 17 mm was
the float, counted twice. It now measures **exactly 0.1000**: the documented
intent, reached for the first time. **The tilt is untouched; nothing levels it.**

## ⚠ THE ROW'S CLIMB PREMISE IS STALE — the tyre is not a step in any shipped route

The row (and the `userData.tyre` docstring) treat the tyre top as *"the FIRST
STEP of the car-roof climb"*. **Neither shipped climb route uses it.**
`scripts/w29-sedan-climb.mjs`'s own header records that `blocked` and `standTop`
disagree about a surface's width and that this *"is what made the tyre route
impossible"*; the sedan climbs `road → trailer deck 0.50 → boot lid 0.93 →
roof`, and the pickup climbs `pavement 0.14 → bed floor 0.50 → rail 0.97 →
roof`. The 28 mm was headroom on a route that was never built.

It did not change my decision — the phase fix moves the number the helpful way
either way — but the next person to read "half the margin" in that docstring
should know it is not a live constraint. The docstring now says so.

Both walks **PASS** after the change, unchanged in every tier:
`w21-roof-climb` — *pavement → bed → rail → ROOF → hood → street, off it four
ways, roof hop clears with 1 spare frame at the dt clamp*;
`w29-sedan-climb` — *road → trailer deck → boot lid → street, and off it three
ways*.

## V, since the row asks for it by name — and it is the wrong instrument here

`shots/tyre-after-{1,2,3}-vview.png`. **A tyre carries no collider.** Within
0.5 m of a wheel V finds one box (`pickup-hood@0.94`, the body) or none, and its
lower edge runs at the rocker line, above the wheel. Nothing red. So this change
**cannot wedge anybody**, and the seating proof has to be `w99-tyre-seating.mjs`
plus the two walks, not the overlay. Shot anyway, because the user graded the
last wheel bug in this view and "V shows nothing here" should be lookable.

## After-images, which I have looked at

`shots/tyre-before-*.png` vs `shots/tyre-after-*.png`, three tyres × three
distances, **both sets at 13:00** (`__ct.clock(13, 0)`; the watch reads 13:05/13:06
in frame) so the night wash is not what is being compared.

My verdict: the tyre visibly comes down onto the tarmac — the thin light strip
of road that ran under the flat bottom is gone — and the wheel reads slightly
rounder and slightly taller, which is the top going 0.6634 → 0.68. It is a small
change and it is the one the user reported. `tyre-after-1-close.png` is the used
lot, the *"cheap car"* the screenshot was taken at.

## Two instrument faults I caused and caught

1. **`__ct.warp` has no eye-height argument.** It is `(x, z, yaw, groundY,
   pitch)` and fp.ts puts the camera at `groundY + 1.62`. My first look script
   passed a made-up eye height into the *pitch formula only*, so every "close"
   frame was aimed as though crouched while standing — three shots of a bonnet,
   contact patch out of frame. Fixed to the real `EYE = 1.62`, the figure w21
   and w29 both use.
2. **Aiming radially out from the world origin** put the camera on the far side
   of the car and photographed the flank with the contact patch behind the sill.
   The direction that always clears the body is the car centre → wheel.

Neither reached a finding. Both are the class the brief warns about: a probe
that produces a real-looking picture of the wrong thing.

## Left for someone else, not fixed here

- **`scripts/probes/w28-tyre-top.mjs` was going to become the next stale
  citation, so I updated it** — it hard-assumed phase 0 and printed
  `z-extent (= 2r)`, both now false. It reads `thetaStart` off the geometry,
  says `VERTEX down` / `FLAT down`, prints both candidate tops and states which
  one the phase predicts. It agrees with the world 4/4 kinds. This is a probe,
  not world code.
- **Six other files still cite `0.663`** as the tyre top and are now stale:
  `scripts/probes/arch.mjs:56`, `scripts/arch2.mjs:9`, `scripts/looks.mjs:65`,
  `scripts/probes/lotarch.mjs:2`. All are comments in read-only probes, none
  changes a result, and none is in a file this item grants me. **Worth a
  one-line queue item.**
- **The trailer is item 253 and I did not touch it** — its wheels measure
  `0.0000` before and after. ninetyeight's finding stands: the trailer complaint
  is not about height, and the remaining candidates are the 0.12 m-a-side
  overhang past `DECK_HW` and its being the world's only 12-gon, hubless wheel.
- **The r = 0.44 8-gon, `h = 0.06`, one instance, 20 mm off the ground.** Turned
  up in the geometry sweep. It is 6 cm thick, so it is not a road wheel — a sign
  or a decorative disc — and I left it alone rather than guess. Someone should
  find out what it is.
