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
