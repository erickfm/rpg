# w4 — item 5g, "a door leaf makes the rear aisle too cramped" — FIXED, but the stated cause was wrong

## Root cause (one line)
**The library's entrance door leaves are purely visual and carry no
registered collider at all** — `ct/int-library.ts`'s "THE ENTRANCE, FROM THE
INSIDE" block (~431-753) builds the two swinging leaves as plain
`THREE.Mesh`/`PlaneGeometry` objects with no `solid()`/obstacle call anywhere
near them, so they cannot appear in `__ct.colliders()` and therefore cannot
be painted red by the V overlay, which is driven by exactly that array
(`ct/debug-collision.ts:137`, `trapAgainst(c, colliders)` — the same function
and the same array, confirmed by reading both). The real, measured cause was
a **different fixture in the same room**: the periodicals alcove's newspaper
stand (`ct/int-library.ts`, "THE PERIODICALS ALCOVE" section), which the
item's own language ("a door leaf... stands proud", "the stacks opposite")
plausibly describes at a glance — the stand's angled 12° reading lid could
read as an open door leaf in a screenshot, and it sits right where the
freestanding book stacks end.

## How I found it (measure, don't guess — GOTCHAS §7)
Read the entrance code fully first and concluded, on the geometry alone, that
the door (front wall, local z=+11) and "THE STACKS" (rear half, local z
-9.7..-2.0) are ~13-20 m apart in a 22 m room and cannot interact. Rather than
stop there, I queried the live built world directly: `__ct.roomDims()` for
the library's world offset (cx=1080, cz=0), then `__ct.colliders()` filtered
to a 3 m margin around the room, then ran `ct/gap.ts`'s own `corridor()` /
`isTrap()` logic (inlined read-only, not imported, to avoid a module-path
detour) pairwise over all 33 nearby colliders. That found 6 real trap
corridors near the library, none within 10 m of the door, and traced two of
them (both exactly 0.750 m) to one specific object at local (-8.95, -1.9):
the newspaper stand, identified by its exact box dimensions
(`0.52 x 0.86 x 1.1`) and its `solid(AX, rz, 0.6, 1.2)` registration.

## What I did
`AX = -W/2 + 1.05` (the alcove's own comment: "the strip between the west
ends of the stacks and the west wall") put the stand's 0.6 m footprint dead
centre in a ~2.1 m strip, leaving ~0.75 m bare on **both** sides — under
`gap.ts`'s 0.95 m PASSABLE floor either way, confirmed as two separate trap
corridors (stand-vs-west-wall, stand-vs-stack). Nobody reads a wall-mounted
rack from behind it (the reading side is the chair, further into the room),
so I pushed the stand flush to the wall instead of centring it:
`AX = -W/2 + STAND_W/2 + 0.05` (a hair off the wall, not coplanar with it —
GOTCHAS 6). That moves the entire spare floor to the stack side in one
motion, comfortably clear.

**This moved the chair too** (it has always been positioned at `AX + 1.15`),
and reintroduced the identical trap class one object over — 0.63 m against
the wall-mounted magazine case (`wallRun`), caught by re-running the same
measurement after the first fix rather than assuming one object couldn't
affect another. Fixed by deriving the chair's position from the case's own
known east edge (`caseEastEdge = -W/2 + BAY_D + 0.06`) plus `gap.ts`'s
**imported** `PASSABLE` constant plus the chair's own half-width, instead of
a hand-typed offset from `AX` — so it cannot silently drift out of clearance
again if either the stand or the case moves independently. `import { PASSABLE
} from './gap'` is a new one-line dependency on a pure, stable named export;
`STAND_W` is a second small derived constant replacing a repeated literal
`0.6` in both `AX`'s formula and the stand's own `solid()` call.

## Verification
- **Structural, before/after, same script**: re-ran the colliders+corridor
  probe after each of the two edits. First edit: both stand-related traps
  (0.750/0.750) gone, but a NEW one appeared (chair vs case, 0.630) — caught,
  not shipped. Second edit: back down to exactly the same 4 traps that were
  present in the room **before I touched anything**, all in the front
  hall/gallery area (x 3.6-9, z 2-6.8), unrelated to this item and not
  touched (see "not fixed" below).
- **Existing checks, unmodified**: `scripts/J-library-room.mjs` — still 6/6
  PASS, including "the west alcove has ONE raked reading surface, not a rank
  of slabs" (I moved the stand, didn't add or remove any raked plane).
  `scripts/interiors-walk.mjs library` — 25/25 PASS (run against the DEV
  server on :4184, which this specific script needs — it does a runtime
  `import('/src/proto/ct/doors.ts')` from inside the page, which 404s against
  a built preview; noted so the next reader isn't confused by that, GOTCHAS
  28-adjacent but about this script specifically, not a general rule).
- **Looked** (not committed, `shots/` is gitignored): from a few metres into
  the alcove, and from where the chair now stands — the case, stand and
  stack read as a coherent, roomy corner, not a pinch. My own verdict: clear.
- tsc clean. `npm run build` clean (same two pre-existing unrelated
  warnings). `bugsweep.mjs` against the built preview on :4183 — exit 0,
  zero STATION MISS, zero new console errors.

## What I did NOT fix
**The 4 pre-existing trap corridors found near the library that are NOT
this item**, left exactly as measured, for the desk to route separately:
  - w=0.440 between two colliders centred (1083.60,4.00) and (1083.60,6.45)
  - w=0.460 between the front wall and an object at (1089.68,-8.45)
  - w=0.640 between two colliders centred (1076.50,4.26) and (1079.10,4.20)
  - w=0.920 between two colliders both at local x≈9.68 (the gallery/east-wall
    area), z -8.45 and -3.40
None of these are near the door, the stacks, or "the back of the library" —
they sit in the front hall / gallery region, so they don't match this item's
own description and I have not investigated what they are.

## Derivation
`STAND_W = 0.6` copied from the existing `solid()` call it now also feeds
(previously a literal, appearing twice — now one source). `caseEastEdge` and
the margin terms (`PASSABLE` imported, `+0.25` the chair's own known
half-width from its `solid(... , 0.5, 0.5)`, `+0.15` a safety margin in the
same spirit as this file's other small "hair" clearances) are all derived
from values already declared in this file or imported from the module that
owns the constant, not retyped.
