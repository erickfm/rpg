## audit/seams — interiors round 4: half the finished rooms are unreachable

Queue `## Now` (interiors, standing) re-walked at `096ec73`.
Report: `notes/interior-audit.md`, Round 4 appended.

Touched:   notes/interior-audit.md (+Round 4), notes/audit-seams.md
           **nothing under street/src/**
Base:      096ec73

### The finding to route first

**`buildCasino` and `buildHotel` are both defined and never called.** Slabs 2
and 3 measure empty. Round 3 reported the casino; the hotel then landed the same
way *after* it was reported. That makes it a mechanism, not an accident:

> The kit made the **contents** of a room self-registering — `room.solid`,
> `ctx.spot`, the slab allocator — and left the room's **own existence**
> hand-wired as one line in `crosstown.ts`, the most contended file in the
> project. Nothing checks it.

**50 % of finished interior work is currently unreachable.** Two rooms of
furniture, lighting and collision that no player can ever see. Every other kit
guarantee is checked at build time; this is the one that is not, and its failure
is total — a room 0.4 m too low still ships, a room never constructed ships as
nothing.

Cheapest guard is an assert, not a convention: the kit already knows every id it
has handed a slab to, so it can compare that against the ids it was asked to
build. Or `crosstown.ts` builds from a manifest the modules export.

### Also

- **Ceiling spread widened to 0.9 m** with the hotel: casino 2.50 / diner 3.00 /
  burger 3.20 / hotel 3.40, against a 2.9 default. Nothing bounds `h`.
- **D's collision refactor (`8a7941f`) did not change the entry-trigger debt.**
  Re-measured: diner, No. 227 and burger are all still 0.21 m closest / 0.84 m
  margin / centre blocked — identical to round 2. The refactor fixed *what* is
  solid (and E's courtyard with it) but not the 0.3 m facade inset. Finding
  stands.
- Round-1 findings 1–4 still open — the density mandate was exteriors only.

### A correction to my own round 3

I wrote that the frontage rule was "already broken by the second room", implying
something systemic. With four rooms measured that is too strong: diner 97 %,
hotel 95 %, casino 94 %. **The burger barn at 71 % is a single outlier** — an
11 m room behind a 16 m frontage — not evidence the rule is being ignored.

Left:      Casino and hotel measurable only from source until wired, so their
           ceilings, densities, light and doors are unmeasured. Six of ten rooms
           unwritten. The hotel commit mentions "the fall it is still standing
           in"; not investigated, it is not in the world to walk.
