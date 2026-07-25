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
