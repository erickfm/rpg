# Item 240 — settled in pixels: seventyone was right, and the row's coordinate is wrong

**Worker onehundredeighteen, 2026-08-03. Port 4740, built bundle.**

## The verdict

**I am overturning sixtyfour's and eightytwo's conclusion and upholding
seventyone's.** The jail's "1 dimmed material" is **not a defect**, and the
coordinate the row has been arguing about for three sessions **does not exist**.

Three facts, each measured:

1. **The dimming material is at (1006.37, 2.42, −9.4), not (1006.37, 2.42,
   −5.60).** Same x, same y, **z is 3.8 m out**. Every one of the three reports
   quotes −5.60. `scripts/probes/w116-jail-which-material.mjs` (worker
   onehundredsixteen's, re-run here) prints the coordinate and says so outright:
   *"0 of 1 dimmed material(s) match it within 0.5 m — NOT the coordinate item
   240 names."*

2. **It grades day `#f0f3f6` → dark `#6c6f76`, and `#6c6f76` is exactly the
   night floor seventyone installed.** So seventyone's fix is present and doing
   its job; this material is landing ON the floor it set, not under it.

3. **IN PIXELS, THE JAIL DOES NOT DIM AT ALL.** Mean frame luminance standing in
   the jail: **108.69 at 13:00, 108.69 at 02:00 — a change of 0.00, 0%.**

The row demanded a pixel measurement because *"a fragment shader is invisible to
anything reading `material.color` from JS"*, and it was right to: **every
measurement in the three-way argument was a JS colour read.** One material of
**140** changes a JS colour and **the player sees nothing**.

### The positive control, without which the above means nothing

"The jail does not change between noon and 02:00" and "my clock/screenshot
pipeline is broken" produce the identical number. So the same two frames were
taken on the street at (0, −20):

**86.21 → 34.02, 60.5% darker.** The instrument works. The jail's flatness is a
fact about the jail.

### And it is correct BY DESIGN

`ct/props.ts:977` skips the night grader for anything at `|world x| > 100` —
*"interiors keep their own light"* — and the jail sits at **x 1000**. A jail
interior that did not dim is the specified behaviour. **Looked at**
(`shots/w118-jail-night.png`): at 02:00 it is a properly lit institutional
corridor, ceiling fittings on, cell blocks legible. Nothing is wrong with it.

**Why the argument lasted three sessions:** everyone was measuring a real thing.
The material's colour *does* change. It is just the daylight slot, it is meant
to, and it is invisible. A JS colour read cannot tell "changed" from "changed
visibly", and nobody had asked the renderer.

## Second half: `RoomDims` publishes room height

`RoomDims` published `w`, `d`, `y` (floor height) and `door` but **not the clear
height** — the last dimension of the box. That absence made a builder derive a
ceiling by hand and tighten the bound three times before its leg went green.

Added `h`, resolved (`spec.h ?? 2.9`) rather than as-asked, exactly as `w` is
`spec.w ?? roomWidthFor(frontage)`. **All 13 rooms publish it:**

```
bank 3.6  bodega 2.6  burger 3.2  church 9.5  diner 3    casino 3.6  hotel 3.4
jail 3.3  library 6.4 pawn 2.8    tax 2.75    thrift 2.75 apt301 2.55
```

**The type system found the one call site I would have missed** — `apt301` is
the sole `declareRoom` caller, and it now passes `R301_H`, the constant its own
walls and ceiling are already drawn from, not a second copy of 2.55
(BUILDER-BRIEF §8).

Documented as the **shell's** height, not headroom at a point: a room with a
stepped `floor` has less clearance over the dais, and `Slab.gy` is what answers
"what is underfoot".

## What I got wrong

**My pixel probe's first verdict failed a world that is right.** I asserted
`pct >= 0.5` — "the jail reacts to the clock" — which encodes an expectation
rather than the design, and it went red at 0%. The design says interiors keep
their own light. Corrected to assert the jail does **not** visibly change, with
the street control carrying the proof that the instrument works.

## Verification

| | |
|---|---|
| `w118-item240-jail-pixels.mjs` | 5/5 OK, **exit 0** |
| `w116-jail-which-material.mjs` | exit 0 — 1 of 140, at z −9.4, not −5.60 |
| `npx tsc --noEmit` | exit 0 (after fixing the `apt301` site it caught) |
| `health.mjs` | `WORLD OK`, exit 0 |
| `bugsweep.mjs` | **0 STATION MISS, 0 COVERAGE**, exit 0 |

## FOUND, NOT FIXED

1. **The row's coordinate should be retired, not re-investigated.** Any future
   report of "(1006.37, 2.42, −5.60)" is quoting a chain of three notes, not a
   measurement. The material is at **z −9.4**.
2. **`interiors-walk.mjs`'s jail light leg reports `1/97 materials dimmed`
   without a coordinate**, which is what made this unanswerable from its output
   for three sessions. It should print WHERE, or better, judge in pixels — a
   material-count leg cannot distinguish a window from a fault. Not fixed: not
   named by item 240.
3. **No negative case was added for the pixel probe.** The street control is a
   live positive control on every run, which is stronger than nothing but is not
   a registered `canfail` case. Worth one.
