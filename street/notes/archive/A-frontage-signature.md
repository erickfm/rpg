# Builder A — the frontage export, exact shape, for the desk to hand to F

The queue item *"Export where the door and window ARE"* ends with:

> **Tell the desk the exact shape of the export when you commit** so I can hand F
> the real signature rather than a description.

I never did. I wrote notes describing it, and the descriptor has changed several
times since — the authority flipped, `alongU` arrived, `doorDeclared` arrived.
So here it is extracted from the source rather than remembered.

## The types

```ts
export interface Placement {
  axis: 'x' | 'z';           // the axis the roster lays this street out on
  loWorld: number;           // frontage extent on that axis
  hiWorld: number;
  facePos: number;           // the facade plane on the other axis
  outward: 1 | -1;           // which way the facade faces
  uDir: 1 | -1;              // which way the TEXTURE's u runs, MEASURED off the mesh uv
}

export interface FrontageWorld extends Placement {
  frontageM: number;
  doorWorld: number;         // world coordinate on `axis` — the door's centre
  doorWidthM: number;
  glazingLoWorld: number;    // world coordinates, not offsets
  glazingHiWorld: number;
  doorDeclared: boolean;     // did a ROOM say, or did the painter guess?
  stallriserH: number;
  fasciaH: number;
  fasciaBottomM: number;
  glazingBottomM: number;
  glazingTopM: number;
}
```

## The functions

```ts
registerFrontage(name, wMeters, p: Placement): FrontageWorld   // painter calls, once per shop
frontageWorld(name): FrontageWorld | null                      // consumers call
declareDoorWorld(name, doorWorld): void                        // a ROOM calls, before the street builds
alongU(f, world): number                                       // world -> metres along u
uAt(f, world): number                                          // the same over frontageM, 0..1
doorAlongU(name, wMeters, fallbackM): number                   // painter's own use
frontageOf(name, wMeters): Frontage                            // DEPRECATED shape, still live
```

Also published at runtime: `globalThis.__frontages` — every `FrontageWorld` with
its `name`, for scripts.

## The three rules a consumer needs

1. **Everything positional is a WORLD coordinate**, on the axis the street runs
   on. Not an offset, and never "left" or "right" — those are the terms that
   make mirroring a thing you can get wrong.

2. **Convert with `alongU`, never with the building's `side`.** `uDir` is
   measured off the mesh; `side` is assumed from which side of the street a
   building sits on. They disagree on 7 of 16 frontages, and a conversion that
   uses `side` applies the mirror twice — measured, it replaces the diner's
   window with a solid panel.

3. **The room is the authority.** `declareDoorWorld` before the street builds;
   the painter reads it and paints there. `doorDeclared` says which happened,
   because the fallback is otherwise silent.

## Status of the consumer side

`ct/interior.ts` still reads the four `@deprecated` fields. The migration is
written out in `notes/A-glazing-handoff.md`, **measured as a no-op** — `tsc`
clean, 0 of 226 room meshes change. It is F's file; I have no mandate and have
not applied it.
