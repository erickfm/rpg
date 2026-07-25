# Builder A — handoff

Queue `notes/queues/A-shared.md` has no unstarted item. Every explicit
obligation in it is discharged, including three I found only by re-reading items
I had assumed were closed:

- the handedness clause *"do that for every room, not just the tax office"* —
  `mirror-walk` now verifies all five declared rooms, and states its own scope
  and circularity
- *"tell the desk the exact shape of the export"* — `A-frontage-signature.md`,
  extracted from source rather than described
- *"republish the playable artifact"* — packed, verified, handed back unpublished
  as the item instructs, with a recommendation on whether it still earns its keep

## What is red

`doors-declared`, and it is not mine. `ct/int-casino.ts` imports a VALUE from
`ct/doors.ts` where its siblings import `type DoorDecl` only; the resulting
runtime cycle means its `DOOR` is skipped. 7 of 8 at HEAD across six runs.
`9c4fa019` measured 8 of 8 seven commits earlier, so it is order-dependent —
which is why its own recommended fix, moving the lookup into a leaf that globs
nothing, is the right one regardless of who measures what.

Everything else in `npm run checks` is green.

## Waiting on someone else

| what | who | state |
|---|---|---|
| the glazing migration, and the four `@deprecated` `Frontage` fields it unblocks | F | patch written against `alongU`, **measured as a no-op** — `tsc` clean, 0 of 226 room meshes change. `A-glazing-handoff.md` |
| one `declareSurface(tex, 'ground')` | `civic.ts` | retires the last UNJUDGEABLE face; `A-last-three-faces.md` |
| the casino declaration | `doors.ts` | above |

None is blocked on risk. The glazing one is blocked only on ownership, and I
have said so plainly in `BLOCKED-A.md` rather than leaving a disproven reason
standing.

## What I would do next

**The window grid publication has one consumer and could have two.**
`userData.windows` now carries `{ floors, cols, lit }`. `window-lattice` reads
it. The same grid would let something check that lit windows are not all on one
floor, or that a facade is not 100 % lit at 3 a.m. — neither of which anyone has
complained about, which is exactly why I did not build them.

**The four appearance guards are a template, not a set.** `burger-palette`,
`tree-crown`, `window-lattice`, `shop-interior` each guard a defect the user
named in their own words. The remaining unguarded requests in `e90c6736`'s audit
belong to other builders' files, and the method transfers: check the DEFECT the
user reported, never the QUALITY they asked for.
