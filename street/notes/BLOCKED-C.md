# BLOCKED — builder C

## 0. THE WORLD DOES NOT BOOT ON MAINLINE — someone owns ct/doors.ts

**Read this first; it is not my file and it is down for everybody.**

`publishDeclaredDoors()` throws during world build, so `__ct` never
initialises. Every builder's shot script times out on `waitForFunction`, and
`scripts/health.mjs` times out rather than printing WORLD OK. No visual
verification is possible by anyone until it is fixed.

**Cause**, confirmed by instrumenting the loop rather than by reading it:

```
[probe] undefined namespace: ./bodega.ts
```

`ensure()` walks `import.meta.glob('./*.ts', { eager: true })` and reads
`.DOOR` off each namespace. `ct/bodega.ts` imports `./doors` back, so under an
eager glob **its namespace entry is undefined**, and `MODS[path].DOOR` throws.
The guard was `if (!d || typeof d.building !== 'string')` — that catches a
missing DOOR, not a missing MODULE. The comment four lines above the loop
already predicts this exact cycle; the guard just does not cover it.

**RESOLVED while this was being written** — the owner landed `MODS[path]?.DOOR`,
which is the same fix and tidier than the guard I had staged, so mine was
dropped on rebase. The world boots and `health.mjs` is green again. Left here
because points 1–3 below are still open and the cause is worth having written
down: it cost a full diagnosis to find, and reading the loop does not reveal
it.

**What still needs doing, by whoever owns these two files** — the optional
chain stops the throw, it does not fix the cause:

1. **Break the cycle.** `ct/bodega.ts` importing `ct/doors.ts` while
   `ct/doors.ts` eagerly globs every sibling is the actual defect. Either
   bodega stops importing doors, or the glob stops being eager, or DOOR
   declarations move to a leaf module nobody imports back.
2. **Bodega's declared door is currently being DROPPED, silently.** `?.` turns
   a crash into a shrug: if bodega declares a DOOR it is now ignored with no
   trace. That is the same class of bug as the missing glyph that shipped
   "BUY ERE AY ERE" for several commits — a silent blank is indistinguishable
   from correct. Worth a `console.warn` on the undefined branch until the
   cycle is actually gone.
3. **`world.ts` globs `./*.ts` eagerly too**, and `interior.ts` globs
   `./int-*.ts`. Whatever rule comes out of this should be applied to all
   three, not just to doors.ts.


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
The part a vehicle actually uses is narrower and is now measured rather than
guessed: `scripts/lotwalk.mjs` walks the rig in and the clear lane is
**z −0.5 → 6.0**. A cut on **z 0.0 → 5.5** with the flares inside that lands
squarely in it.

Everything on my side is built to suit whatever B lands. The lot's whole plan
now points at this opening — the drive aisle runs from it to the back of the
site, the stock herringbones off the aisle, and the office sits at the far end
facing back down it. The rolling gate is parked clear to the north of the
mouth. A pedestrian can already walk in and is stopped by the fence
everywhere else; it is only the KERB that a car cannot cross.

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
