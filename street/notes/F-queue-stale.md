# F — five queue items in a row are already delivered. Please re-cut my queue.

I have now taken five consecutive items off `queues/F-interiors.md` and found
each one already done. That is not a complaint about the queue — it is a
measurement problem worth naming, because I am spending most of each pass
proving that finished work is finished, and a builder cannot tell a stale item
from a live one by reading it.

Each of these was verified by running the user's own test, not by reading code.

## 1. Tax service `[E]` spot — DELIVERED

> *"the entrance to the tax service is not aligned with the door of the facade"*

Measured every building's entry spot against its declared door point:

    A-1 TAX          door 7,-20.13      spot 6.25,-20.13     gap 0.75
    THRIFT           door -7,-59.32     spot -6.25,-59.32    gap 0.75
    BODEGA           door 8,-95         spot 7.47,-95.53     gap 0.75
    ... all ten identical

Every spot is exactly 0.75 m out — `doorStandFor`'s standoff — and sits **on
the door's own axis**. They derive from the descriptor; none is hand-typed.
The stopgap the item authorises is not needed.

## 2. Handedness / mirroring — DELIVERED (see `F-doorside-tax.md`)

Every decidable room mirrors correctly: burger, diner, tax, thrift. The rest
have centred doors or publish no frontage and read as *undecidable* rather
than as passes. **Note the correction in that file** — I briefly reported tax
as broken and it is not.

## 3. Flip the authority — ALREADY THAT WAY ROUND

Rooms populate `DECLS`, `publishDeclaredDoors()` pushes each room's door to
the painter, `doorAlongFrontage()` hands it over in canvas columns, and the
mirror lives once in `doorWorldFor`. Nothing to flip.

## 4. Church steps and entry — DELIVERED

    church: walked 2.73 m up, gy 0.14 -> 0.55
    church: walked back down, gy 0.55 -> 0.14

`interiors-walk church` 25/25, in through the door and back out. E's picker
reaches the registry via `FLOORS` → `courtGround` → `ctx.ground` at
`civic.ts:134`, with `COURT.climbable` set in the entry point.

## 5. Diner seating — DELIVERED

Booth run is perpendicular to the window, continuous, back-to-back. Walked
**8.65 m of clear aisle** end to end, in a band from z −0.3 to +0.9 (blocked
at −0.6, which is the counter side) — past the 1 m the item requires. Sat and
stood in two booths: standing returns you to your pre-sit position with 2.3 m
of free movement, so nobody lands inside a table. `shots/f-diner-aisle.png`.

## Also verified in passing, against later items in the queue

- **"Three finished rooms are not in the world"** — the world publishes ten:
  bodega, burger, casino, church, diner, hotel, library, pawn, tax, thrift.
- **"Every seat in the game should be sittable"** — 151 seats registered, and
  151 corresponding sit prompts. The mechanic is built and wired.
- **"The park and the car lot are not in the world"** — both are in.
  `park.ts:597` and `lot.ts:126` call `ctx.ground`, which only executes if the
  module registered. (A name search of the scene graph returned nothing, but
  that search proves nothing — most objects carry no `name`. Recording the
  weaker method so nobody mistakes it for the strong one.)
- 328 registered spots, **zero console errors** on load.

## What I would ask for

Re-cut `queues/F-interiors.md` against the world as it stands. If it helps, I
can run the checks above as one script and produce this list on demand rather
than by hand — but per the standing rule I am not building that unless it is
the shortest path to a live user request, and right now the shortest path is
just for the queue to be re-cut.

I do not currently know which of my remaining items are live, and I would
rather be told than keep discovering it one pass at a time.
