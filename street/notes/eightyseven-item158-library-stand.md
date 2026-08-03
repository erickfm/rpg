# eightyseven / item 158 — the "weird table" in the library

**The user:** *"remove this weird table in the library."*

**Removed.** Built bundle, port **4430**, commit `34f619109`.

---

## It is not a table, and naming it is the finding

The object at the west wall was a **raked newspaper stand** — a body, a capping
rail, and **a lid at 12° (`rotation.x = -0.21`)**, which is the angled board he
describes jutting out of it. `ct/int-library.ts:1852–1866`.

**And this file had already written the rule that decides it.** The stand's own
comment read:

> *"Second attempt at this object. If it misses again it goes (START-HERE: two
> failures, then delete)."*

This is the miss. The user's word was REMOVE, the file's own standing rule says
delete on the third report, and both agree.

## Why it intersected the shelving — measured, not guessed

| | x span | z span |
|---|---|---|
| the stand (`AX = -W/2 + 0.35` = −9.65) | **−9.91 … −9.39** | **−2.45 … −1.35** |
| the magazine case, `wallRun` at −9.68 | **−9.94 … −9.42** | −2.60 … 2.60 |

They overlap across nearly their whole depth, and the stand's z sits **wholly
inside** the case's. **The stand was standing inside the shelving.** Confirmed in
the built world by AABB overlap before anything was touched — meshes **#7989**
(body, 0.52 × 0.86 × 1.1) and **#7990** (rail, 0.56 × 0.05 × 1.16) against
bookcase panel **#7980**, overlapping 3 cm and 5 cm in x.

**The cause is a collision between two earlier fixes.** Being flush to the wall
is what resolved the *previous* report on this object (item 5g, *"too cramped in
the back of the library"*): centred in the strip it left ~0.75 m either side,
under `gap.ts`'s 0.95 m `PASSABLE`, so it was pushed west against the wall — and
the wall is exactly where the magazine case is. **Both constraints could not be
met by moving it**, which is the strongest argument that the object was in the
wrong room rather than the wrong place.

## The two things the item told me to check first

1. **Does it carry a seat or an `[E]` spot? No.** The stand had only a `solid()`
   collider. The room's three `ctx.seat` registrations are the reading table
   (`:1013`), the terminals (`:1289`) and the reading-room rank (`:1585`) — none
   in this alcove. **`seat-facing`: 219 registered seats, 219 look at something,
   green.** No orphan.
2. **Does it collide with item 115?** **115 is TODO and UNCLAIMED**, and its row
   says to coordinate with 158. Nothing to coordinate with, so per the item I am
   recording it instead: **this removes one object from the layout plan 115 will
   work from.** I did not touch anything else in the room — no widening.

## Does the gap read as a hole? No.

What is left at that spot is the **magazine case's own end panel**, which is a
finished object — and the user said of the same shot that *"the bookshelf and
the blue display case … are working fine … they read instantly."* The strip in
front of the case is now clear floor instead of a 0.6 m obstruction a metre from
the chair.

Looked at three views before and after (`shots/w87-158-{west-wall,oblique,close}-{before,after}.png`).
**My verdict: the close view is decisive** — before, the stand is visibly buried
in the case end with its raked lid sticking up through it; after, the case reads
as one complete cabinet with a proper end panel and clear floor.

## What was removed

The stand's five meshes and its `solid()`; the `paperT` broadsheet texture (**no
other consumer**); and the `AX` / `STAND_W` constants (used by nothing else).

**The chair stays.** Its x is derived from the **case's** own east edge, not from
an offset to the stand — a deliberate earlier fix so it could not drift out of
clearance if its neighbour moved — so removing the stand cannot affect it. It
now reads as a chair to sit and read the magazines in.

## Verification

- The stand's meshes are **gone from (1070.35, −1.9)** — 0 hits on re-scan.
- **`interiors-walk library`: 29/29 PASSED.** (Its exit code is 1, from the
  pre-existing `[interior:hotel] NO BUILDING NAME` kit warning — a documented
  inherited red about the **hotel**, not this room.)
- `seat-facing` **green**, 219/219.
- **No phantom collider.** The only two colliders left on the stand's old
  footprint are the **west wall** (0.18 × 22.36 m) and the **magazine case
  itself** (0.6 × 5.28 m). The stand's own 0.6 × 1.2 `solid()` is gone, so the
  removal did not leave an invisible wall — which would have been worse than the
  object was. (`w87-item158-nophantom.mjs`.)
- `npm run sweep` **96 shots, 0 STATION MISS, 0 COVERAGE**; `health.mjs`
  **WORLD OK, exit 0**, build `c015ccd1f`; `npx tsc --noEmit` **clean**.
- Library re-scan: 481 meshes in the room. The 23 remaining table/shelf AABB
  overlaps my finder reports are **shelf boards inside their own bookcase
  carcasses** — a bookcase's internal structure, present before and after, not
  furniture clashing.

## Two instrument faults I caused and caught

1. **`roomDims()` returns an ARRAY of `{id, w, d, cx, cz}`, not an object keyed
   by name.** My first finder did `dims.library`, got `undefined`, and **silently
   fell through to sweeping every interior in the world** — 3931 meshes instead
   of 481 — where it surfaced an angled table at x 522.9, in a completely
   different room **550 m away**, as the leading suspect. Had I trusted it I
   would have removed the wrong object from a file the item does not name. It now
   asks by `id` and **throws** if the library is not there, rather than quietly
   widening its own scope. GOTCHAS 86's lesson one field over: ask the world, and
   make the failure loud.
2. **`interiors-walk.mjs`'s room filter is POSITIONAL (`argv[2]`), not an env
   var.** `ROOM=library node scripts/interiors-walk.mjs` silently swept **all
   twelve rooms** and blew a 900 s timeout with nothing to show. The file says so
   at `:281` — *"The room filter is POSITIONAL, so it must skip flags"* — and I
   had not read it. Correct form: `node scripts/interiors-walk.mjs library`,
   which finishes the one room quickly.

## Found and not fixed

- **`scripts/interiors-walk.mjs` cannot run against `vite preview`.** It
  dynamically imports `src/proto/ct/doors.ts`, which **404s on the preview
  server** — the same class as the documented "`fp.ts` cannot be imported at
  runtime by a harness". It has to be pointed at a **dev** server, which is what
  the 29/29 above was run on. Pre-existing and not mine, but worth a row: the
  item names this check, and the standing instruction is to verify on the **built
  bundle** (GOTCHAS 28). **The two requirements are in direct conflict for this
  one harness**, and every builder asked to run it will hit the same wall.
- Item 115, as above.

## Derived or copied

**Derived.** The overlap was computed from world AABBs read off the live scene,
and the library's box from `roomDims()` by id rather than from the slab formula
(GOTCHAS 86). The two source figures quoted here — `AX = -W/2 + STAND_W/2 + 0.05`
and `wallRun`'s `-W/2 + BAY_D/2 + 0.06` — are cited from `ct/int-library.ts` and
were confirmed against the measured mesh positions rather than trusted.
