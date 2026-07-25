# BLOCKED — builder C

Two asks, both small for the person who can do them. Neither stalls me — I am
shipping the rest of the lot meanwhile.

## 1. The curb cut needs the kerb to break — that is B's file

**What I need:** a break in the kerb and a ramped apron across the walk, over
one span of the lot's frontage.
**From whom:** builder B (`ct/tex-ground.ts`), through the desk.

This is the top half of my current item and the question the user actually
asked — *"how does one even enter, drive a car off the lot"*. I cannot answer
it from `ct/lot.ts`, and I want to be exact about why rather than half-build
something that looks wrong.

`buildGround` lays the kerb along a continuous path with red zones and corner
fillets resolved by arclength. There is no gap, notch or driveway facility in
it. So:

- **The kerb face has to stop.** It is 0.14 m tall at x = ±ROAD_HALF. I can
  ramp the walk down to meet it and I can flare an apron, but B's kerb face
  still stands across the mouth — an 11 cm lip exactly where a car would
  drive over it. Anything I build from my file leaves that lip, and a lip is
  the thing that says nobody thought about it.
- **The walk itself has to change.** The brief is specific and correct: the
  paving RAMPS down over the cut and the scoring runs ACROSS it. A dropped
  kerb with unbroken pavement over it is wrong. The walk surface and its
  score grid are `walkTex`/`buildGround` — B's, and deliberately world-aligned
  so the grid is continuous across neighbouring surfaces. Overlaying my own
  slab on top of it would fight the very thing that makes the grid work.

**The exact span**, so this is a five-minute job rather than a conversation:
the lot's mouth is the middle of its frontage, `openSite(..., gate: 0.3)`,
which with the lot at z 14.2 → −9.0 puts the opening at **z −2.04 → 7.24**.
A cut narrower than the mouth is fine and probably better — a real driveway is
6–8 m, so **z 0.5 → 7.0** would do, with the flares inside that.

I have built everything on my side of the line to suit whatever B lands: the
rolling gate sits on the mouth, and the drive aisle behind the front row lines
up with it.

**Nothing I have added encroaches the walk.** The auditor is sweeping for that
and the fence, banners, pole sign and gate are all east of x = FACE.

## 2. Three car variants — H's file

**What I need:** cars with the hood up, on a jack with a wheel off, and
optionally up on blocks.
**From whom:** builder H (`ct/cars.ts`), through the desk.

The brief asks for "one car up on a jack with a wheel off, one with the hood
open". Cars are H's and I have added none — the lot's sixteen are `makeCar()`
unmodified. In order of value:

1. **Hood up.** The single thing that makes a lot read as *working* rather
   than as sixteen parked cars. Ideally a dark engine bay so it reads at
   distance.
2. **On a jack, one wheel off.** Pairs with the tyre stacks already in the
   lot, and gives the back row a reason to exist.
3. **Up on blocks** — the one that is not for sale.

**An option needing no new geometry:** a flag on `makeCar` to omit one or all
wheels. That gives me both the jack car and the blocks car by itself, and I
stack the tyres beside them — I already build tyre stacks.
