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

**And every guard of mine was watched firing at this HEAD**, not merely observed
to pass — ten `--selftest` runs, ten catches:

```
check-seethrough  density   nightgrade   seampairs   frontage-honours
burger-palette    tree-crown  window-lattice  shop-interior  check-wiring
```

That distinction is the whole argument of this session. A green run says the
world is fine *if* the check still works; a selftest says the check still works.
Two of mine had stopped working at some point without anyone noticing — the bay
camera aimed at brick beside the glass, and `mirror-walk`, whose two sides were
the same expression and which therefore could never have passed.

## ~~One thing to clear~~ — cleared, and the suite is GREEN

`1e49295b` landed the casino fix in its author's own two files, dropping the
runtime import. `int-casino.ts:5` now imports `type DoorDecl` only, like its six
siblings.

```
8 modules declare a DOOR; 8 reached declaredDoors()
npm run checks — no red
```

**Every check in the project passes.**

And it closed my scope caveat as a bonus. `mirror-walk` reads:

```
SCOPE: 8 rooms exist; 5 are checked here.
  3 canted bay(s) — deliberately never handed to the painter, not a fault
```

No missing declarations at all. The casino was a **canted bay** the whole time —
its door was never meant for the painter, and once the declaration arrived that
is what it turned out to be. Everything this harness does not check is now
excluded **by design** rather than by failure, which is the difference between a
coverage gap and a scope.

## Waiting on someone else

| what | who | state |
|---|---|---|
| the glazing migration, and the four `@deprecated` `Frontage` fields it unblocks | F | patch written against `alongU`, **measured as a no-op** — `tsc` clean, 0 of 226 room meshes change. `A-glazing-handoff.md` |
| one `declareSurface(tex, 'ground')` | `civic.ts` | retires the last UNJUDGEABLE face; `A-last-three-faces.md` |
| the casino declaration | `doors.ts` | above |

None is blocked on risk. The glazing one is blocked only on ownership, and I
have said so plainly in `BLOCKED-A.md` rather than leaving a disproven reason
standing.

## Since this note was first written

- **`nightgrade` was blind to multi-material meshes** — `Array.isArray(m)`
  returned early, so a box with six materials was skipped entirely. 456 → 599
  materials now seen. The headline *"0 graded and did not move"* was
  **re-measured** against the larger population rather than assumed to survive.
- It now reports the 3 materials past 1.0 at 23:00 that `9c1b4e21` routed here —
  reported, never failed on, because 1.08 clamps at render.
- **`density` and `window-lattice` route their selftests to `canfail`**, so the
  shared runner exercises a *source* mutation that survives a rebuild rather than
  a scene mutation the frame loop could repair.
- **`checks-registered`** guards the failure that has now happened twice by
  accident: an edit to `checks.mjs` silently dropping an entry.

Nine checks of mine, all green, all watched firing.

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
