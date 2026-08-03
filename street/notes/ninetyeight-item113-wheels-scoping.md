# item 113 — the wheels, measured and RELEASED un-fixed

Worker ninetyeight, 2026-08-03. Port **4540**, built bundle. **I changed no
world code.** This is the diagnosis the row was missing (`[DIAGNOSIS LOST]`),
with numbers, so whoever takes it next does not start from the screenshots.

Probe: `scripts/probes/w98-wheels.mjs` (committed). It computes each wheel's
**world AABB** and compares its lowest point with `groundAt` under it.

## Finding 1 — EVERY car tyre in the world floats 16.6 mm

83 car tyres (`CylinderGeometry(0.34, 0.34, 0.24, 10)`, `ct/cars.ts:1141`):

```
r=0.34 seg=10 h=0.24   n=83   gap 0.0166 .. 0.1171   apothem 0.3234
```

**0.0166 is exactly `R − R·cos(π/10)` = `0.34 − 0.3234`.** That is not a
coincidence and it is the row's own standing note read in the other direction:
the car is seated so the hub sits at ground + **R**, but a decagon laid on its
side stands on a **flat**, so it only reaches down by the **apothem**. Every car
on the block hovers 1.66 cm. That is the systematic defect, it is on all four
wheels of all 20-odd vehicles, and it is very plausibly *"fix the wheel on this
cheap car"* — the lot is where you stand closest to a parked car's wheel.

**DO NOT JUST SUBTRACT 16.6 mm.** The tyre's top is load-bearing:
`ct/cars.ts:1465`'s docstring records that the tyre is *"the only candidate
first step in the whole fleet"* for the car-roof climb, and at 0.6634 it clears
the 0.14 m pavement by **28 mm** against a guaranteed reach of 0.551. Dropping
every car 16.6 mm spends 16.6 of those 28. Whoever fixes this **must re-walk the
climb** (`notes/w21-car-roof-climb.md`, `notes/w28-car-climb-route.md`) — the
seating fix and the climb margin are the same number and cannot be checked
separately.

The clean fix is probably to seat from the apothem *and* re-derive the arch and
climb constants from one exported helper, rather than to nudge a literal.

## Finding 2 — one corner at (27.4, 8.51) is 117 mm up, and that one is FINE

```
(27.40, 8.51)  gap +0.1171     <- the odd one
(28.08, 7.02)  gap +0.0172
(25.21, 7.53)  gap +0.0171
```

One car with three wheels at the fleet-wide 17 mm and a fourth at 117 mm. That
is the **jacked car** — `ct/cars.ts:1528`, *"a car on a jack TILTS"* — and the
tilt is deliberate. **It is not a defect and must not be levelled.** Recording it
because it is the largest number the probe prints and the obvious thing to
"fix" first.

## Finding 3 — the trailer wheels do NOT float, so the trailer complaint is something else

```
r=0.22 seg=12 h=0.14   n=2   gap 0.0000 .. 0.0000
```

Both trailer wheels touch the road **exactly**. A 12-gon at R 0.22 has apothem
0.2125, so a wheel standing on a flat would float 7.5 mm — these read 0.0000,
which means they stand on a **vertex**. So the trailer wheels are the one pair
in the world that are seated correctly, and *"fix the wheels on the trailer"*
is **not** about height.

What is left, from source (`crosstown.ts:912-921`) and not yet confirmed against
the user's screenshot:

- **They stand proud of the deck.** Wheels at `x = ±0.95`, half-thickness 0.07,
  so they reach ±1.02 against `DECK_HW = 0.9`. The code's own comment says *"two
  wheels tucked under the deck"* — they are not tucked under it, they overhang
  it by 0.12 m a side, with no fender.
- **They are the only 12-gon wheels in the world.** Every car tyre is a 10-gon
  0.24 m wide with a hubcap; these are 12-gon, 0.14 m wide and plain black with
  no hub at all. At the same viewing distance they will not match.

Either is a plausible reading of the complaint and I am **not** going to guess
which — the screenshot is named in `FEATURE-REQUESTS.md:2608` and should be
looked at before anything is moved.

## ⚠ THE ROW NAMES ONE FILE AND THE WORK IS IN TWO

The row says `ct/cars.ts (the $695 hatch, and the trailer wheels)`. **The trailer
is not in `ct/cars.ts`.** It is built in **`crosstown.ts:879-936`** — the deck,
drawbar, axle and both wheels — and `ct/cars.ts` mentions a trailer only in a
comment at line 121. So finding 3 cannot be actioned inside this row's stated
boundary, and `crosstown.ts` is the contended wiring file (GOTCHAS 11).

**The desk should split this into two rows**, one per file, or re-scope it to
name both. That is the main reason I am handing it back rather than starting.

## Why released rather than finished

Finding 1 is a fleet-wide seating change whose margin is the car-climb route, so
it needs the climb re-walked on the built bundle after it; finding 3 is in a file
this row does not grant and whose real symptom is still unread. I had the budget
to measure both properly or to change one carelessly. The measurement is
committed and reusable.

## Instrument fault, mine, caught before it became a finding

The first cut of `w98-wheels.mjs` ranked **every cylinder in the world** by
ground gap and led with *"FLOATS +9.3150"* at (680, 6) — a ceiling fixture. True,
meaningless, and exactly the shape of a confident wrong answer: had I quoted it,
the next worker would have gone looking for a wheel 9 m in the air. The probe
now filters to the two geometries that are actually road wheels, and says so.
