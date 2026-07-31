# Alley grate — asking before drawing a second casting

The request is explicit about this, so I am doing what it says rather than
guessing:

> *"If the casting is B's asset, ask me and B exports it rather than you drawing
> a second one - a second grate design is exactly how this project ended up with
> two of everything."*

## It is B's, and it is not exportable today

`ct/tex-ground.ts` builds the kerb inlets as a **local**:

```ts
const basin = (kx: number, z: number, side: number) => { … }
//   ↑ const, not export. It also stamps userData.basinPart so scripts/basin.mjs
//     can find its surround by name.
```

`OWNERSHIP.md`: `src/proto/ct/tex-ground.ts = B`. So the casting is B's and there
is nothing for me to import.

## What the alley has now, and why it looks like stripes

Mine is not geometry at all. It is **painted into the alley floor texture** —
`fillRect` bars inside `alleyFloorT` at 24 px/m — which is why it reads as four
dark lines with no frame, no thickness and no hole. That was deliberate once
(`seam-audit.md` finding 4 pushed the alley's ground detail onto one dense canvas
so it stopped reading as smears) and it is the wrong call for a drain.

## The question

**Ask B to export the casting, and I place it?** That is the version the request
prefers and it keeps one grate design in the project.

The alley does need the differences the request already names — mid-floor rather
than kerb-side, square or round rather than the kerb inlet's shape, paving dished
into it, staining where water runs to it. Those are placement and surround, which
are mine. The **bars, frame and throat** are the casting, which is B's.

If B would rather not export it, say so and I will draw one — but then it is two
designs on purpose rather than by accident, and worth a line in the note saying
which is which.

**Not started pending that answer.** The height and interaction work on the ATM,
and the cat move, are done and independent of it.


---

## The dished paving is mine and I have NOT done it — here is why, and what it costs

The request splits the job: the casting is B's, but *"an alley drain sits
mid-floor with the alley falling toward it … and the paving should dish slightly
into it"* is mine and does not need the casting.

I went to do it and stopped, because **it is a two-part change and doing only
the visible half introduces a defect.**

**Where it goes.** The drain is painted at texture `(0.5, 0.42)` of the alley
floor — centre of the 6.6 m width, 42% along the 7.0 m length. A dish would be
`PlaneGeometry(AF_W, AF_L, 12, 12)` with vertices pulled down toward that point,
about 6 cm over a 5 m radius.

**Why that alone is wrong.** GOTCHAS §7: floor height comes from a **picker**,
not from the mesh. `crosstown.ts:506 groundPick` asks each module that registered
a `ground(fn)` callback. `ct/street.ts` does not register one — `buildStreet`'s
parameter list has no `ground` — so the player would keep walking the flat height
and **float over the visible dip**. That is exactly the class of defect this
project keeps catching, and I would have shipped it as a cosmetic tweak.

**So it is:** segment and displace the floor, AND register a ground function for
the alley patch that returns the dished height, AND pass `ground` through to
`buildStreet` — a third field on a signature I have already widened once.

Worth doing with the casting, in one pass, rather than now in two. Recorded so
whoever picks it up knows the collision half exists before they see the dip.

---

## UPDATE — the dish is BUILT, both halves. Only the casting is still blocked

I was wrong to bundle it. The casting has been waiting on a ruling for a while
and the dish never needed it: **I** decide where the drain sits, B would only
export the art that drops into it. So the paving now falls to the drain and the
casting can land in a floor that already slopes to meet it.

**Where it is.** Drain at world **x −10.30, z −40.77**, derived rather than
guessed. `DRAIN_U`/`DRAIN_V` are now one pair of constants that both the texture
painter and the geometry read, so the painted gully and the low point of the
bowl cannot drift apart.

**The z axis runs backwards through the canvas and that is measured, not
assumed.** `pixTex` leaves `flipY` at the CanvasTexture default `true`, so canvas
row 0 is v = 1 is local +y is world −z. Verified by mapping the canvas corners
through the mesh's own `localToWorld`: top → z −43.50 (the end wall), bottom →
z −37.00 (the mouth). The drain is 42% of the way from the **end wall** toward
the street. Reading it the other way puts the dish 1.3 m out, on the wrong side
of the alley's centre, and it would look deliberate.

**The shape.** 6 cm over a 2.6 m radius — a 2% fall, what a real yard gully is
laid to. smoothstep rather than a cone: flat at the centre so the casting beds
level when it arrives, flat at the rim so the bowl does not meet the paving on a
crease.

**Both halves, which was the whole reason I stopped.** `ct/street.ts` now
registers a ground function through `ctx.ground` — the pattern `ct/park.ts` and
`ct/civic.ts` already use. It answers **only inside the bowl** and returns null
everywhere else, so nothing outside changes hands. That is deliberate: the
fallback in `groundPick` gives `KERB_H` for |x| < FACE + 0.3, so there is a 14 cm
kerb step in the strip x −7.3 … −7.0 at the alley mouth, and a patch that
answered for the whole alley floor would have quietly flattened it.

**Walked, not screenshotted.** `scripts/alleydish.mjs` compares the mesh's own
displaced vertices against the ground picker, by standing the player on them:
worst disagreement **0.0 mm across 4 points**, and walking in from the mouth
takes you down **6.0 cm** with a largest step of 19 mm. Watched failing on the
real defect — remove the registration and it reports 59.9 mm and a 0.0 cm walk.

---

## RESOLVED — B exported the casting, and the grate is built

**B answered.** `ct/tex-ground.ts` now exports `floorDrain(scene, x, y, z, size)`
— the kerb inlet's vocabulary with the throat removed, because a yard gully
takes water from every side rather than down a gutter, so there is nowhere for a
throat to go. That is a better answer than exporting `basin` would have been: it
is the same casting language in a second correct variant, rather than one object
bent to two jobs. **The block has one grate design, which is what the request
asked for.** I drew nothing.

**Placed at the bottom of the bowl.** `floorDrain` takes the floor height from
its caller and explicitly does not guess it, and ours is the dished paving:
`floorA.position.y + dishAt(DRAIN_X, DRAIN_Z)` = −0.055 m. Passing the flat
alley height would have left the frame floating 60 mm above the dip it is meant
to sit at the bottom of — and from directly overhead, which is how anyone would
screenshot it, that looks identical to correct. There is now an assertion for
exactly that.

**Measured:** 12 solids, 7 bars, frame top −0.0310 m, **rebate 11.0 mm** — the
bars sunk under the frame top, which is B's whole point (*"a flush grate looks
painted on"*) and the difference between a hole and four stripes. Frame stands
24 mm proud of the paving.

**The texture now paints the HOLE and nothing else.** The old painted bars are
gone — geometry provides those, and painting them twice double-images against
the casting. The dark square is deliberately a little larger than the 0.60 m
opening: B's void plate sits under the slots but this floor plane is opaque and
continuous beneath it, so what you actually see between the bars is that paint.
Flush to the opening, a rim of lit paving would show inside the frame.

**And the staining the request asked for** — *"staining where water runs to
it"* — is 16 streaks that CONVERGE on the drain rather than more scattered
blobs. The alley falls to this point now, so the dirt says so.

Shot from standing height in `shots/D-drain-standing.png` and
`shots/D-drain-close.png`. Nothing in this item is still blocked.
