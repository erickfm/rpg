# Builder A — the middle consumer of the frontage contract was unchecked

Landed in **`c9a8ed1a`**: `scripts/frontage-honours.mjs`, wired into
`npm run checks`.

## The gap

The contract is one number with three consumers:

```
the ROOM      declares a world coordinate      declareDoorWorld()
the PAINTER   reads it and paints there        registerFrontage()
the [E] SPOT  stands in front of it            doorStandFor()
```

Two were checked. `mirror-walk` walks the room against the declaration;
`doors-declared` checks the declaration arrives at all. **Nothing checked that
the painter used it.**

That is not a hypothetical failure. If a shop registers its frontage *before*
its room declares, the painter keeps its own fallback and the declaration is
silently dropped — the room and the `[E]` spot agree with each other, and the
facade disagrees with both. Which is **the user's original complaint**, with
nothing in place to catch it.

`ct/doors.ts` says in its own comments that `publishDeclaredDoors()` must run
before `buildStreet`. That is exactly the kind of ordering constraint that holds
right up until somebody moves a line.

## What it reports

```
·  BODEGA        canted bay — deliberately never handed to the painter
✓  BURGER BARN   room said -25.11, facade painted -25.11
✓  DINER         room said -46.61, facade painted -46.61
·  HOTEL ORPHEUS canted bay — deliberately never handed to the painter
✓  PAWN          room said -60.50, facade painted -60.50
✓  A-1 TAX       room said -20.13, facade painted -20.13
✓  THRIFT        room said -59.32, facade painted -59.32

5 declared doors, every one honoured by the facade
```

The two chamfers are **skipped with their reason printed**, not counted as
passes. A bay that is deliberately never handed to the painter is not evidence
of anything, and a check that quietly counts skips as successes is how a green
run stops meaning something.

`--selftest` makes one frontage forget it was told and paints it 3 m off.
Caught.

## The flag earning its keep

`FrontageWorld.doorDeclared` went in two commits ago, and I noted at the time
that it was published and unread — the exact thing I have criticised in other
people's code all week. This is what it was for: without it, "the painter used
the declaration" and "the painter guessed and happened to agree" are the same
picture from outside.
