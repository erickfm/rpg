# "Make the exteriors match the interiors" — measured 2026-08-01, all twelve rooms, all MATCH

Build `bad863b43`. Dev server on port 4188 (`npx vite --port 4188`), aimed
explicitly everywhere with `SHOT_URL=http://localhost:4188/` per GOTCHAS 48.

**Bottom line: no genuine mismatch exists anywhere in the world today.** This
is a stop, not a punt — GOTCHAS 55 says a row can be OPEN and already done,
and that is exactly this row's shape. Nothing was fixed because there was
nothing to fix. One instrument gap was closed (see "Instrument" below) so the
next person doesn't have to redo this from zero.

## The twelve-row table

Per GOTCHAS 45, "match" means **which side the door is on**, not width or
depth. `insideOffset` is the room's own local x for its door (0 = centred);
`chamfer` marks a door on a cut face rather than a flat wall.

| room | building | inside offset | chamfer | exterior side | verdict |
|---|---|---|---|---|---|
| bank | FIRST FEDERAL | 0 (centred) | no | centred, recessed portal | **MATCH** |
| bodega | BODEGA | 3.4 (in the cut) | **yes** | door drawn IN the cut corner | **MATCH** |
| burger | BURGER BARN | −3.6 | no | left of frontage centre | **MATCH** |
| casino | SEVENS | 0 (centred) | yes (face) | centred gold portal | **MATCH** |
| church | ST BRIGID | 0 (centred) | yes (face) | centred arch, top of steps | **MATCH** |
| diner | DINER | −2.6 | no | left of frontage centre | **MATCH** |
| hotel | HOTEL ORPHEUS | 0 (centred) | yes (face) | centred revolving door | **MATCH** |
| jail | JAIL | 0 (centred) | yes (face) | centred double steel door | **MATCH** |
| library | LIBRARY | 0 (centred) | yes (face) | centred arch, top of steps | **MATCH** |
| pawn | PAWN | 0 (centred) | no | centred | **MATCH** |
| tax | A-1 TAX | −4.2 | no | left of frontage centre | **MATCH** |
| thrift | THRIFT | −2.2 | no | left of frontage centre (mirrors: exterior +2.43) | **MATCH** |

12 of 12. Confirmed two ways per room: (1) tracing which mechanism sources
each side's position (below), and (2) 24 screenshots — one standing just
inside each door looking in (`shots/bug-<room>-entry.png`, from `npm run
sweep`), one standing 5 m outside each door looking at it
(`shots/ext-<slug>.png`) — and eyeballing that the furniture/counter/aisle on
the inside sits on the same hand as the door sits on the outside. No shot
shows the user's complaint shape (door on the left outside, you land beside a
door on the right inside).

## Does the previous audit's "four decidable, six undecidable" finding still hold?

**No — it is stale, the same way the citizenSprite row was.** It undercounted
for two reasons, neither a regression, both closed since it was written:

1. It measured with `__frontages`, which (per `crosstown.ts`'s own comment)
   "covers flat shopfronts only." Six rooms — bank, casino, church, hotel,
   jail, library — were never flat-frontage shopfronts and so were invisible
   to it by construction, not because they were undecided.
2. `window.__ct.doors()` was added since (`crosstown.ts`, calling
   `doorPointFor()`) specifically to fix this: "`__frontages`... is A's and
   covers flat shopfronts only... so the BODEGA... was invisible to anything
   auditing doors." It returns a world point + outward normal for **every**
   declared door, chamfer or flat, which is what let this pass close all six.

The two rooms the old note flagged as "centred — undecidable" (pawn, bodega)
are not actually undecidable once you look at the SOURCE rather than
re-running a linear-offset formula: a centred door has no side to disagree
about, and it is still true in both directions. Bodega, the one the old note
called out for its 45° chamfer, is fully decidable now that `door: true` is
switched on in `int-bodega.ts`'s chamfer block (it was not, when that note was
written) — checked visually, `shots/ext-bodega.png` shows the door drawn
exactly in the cut corner.

## How each room's match is guaranteed, not just observed

The room → facade authority (`ct/doors.ts`) means most of these **cannot**
disagree short of a bug in one shared function:

- **burger, diner, tax, thrift** — the room's own `DOOR.at` is the one number
  `doorWorldFor()` mirrors onto the facade. One value, two consumers.
- **pawn, bank** — `at: 0`, centred on both sides by the same shared number.
  No side to disagree about.
- **casino, hotel** — `int-*.ts`'s `DOOR.face.x` is a direct `import` of
  `VICE_DOOR_X` from `ct/vice.ts`, the same constant the facade paints the
  gold/revolving portal from. Same source, not independently authored.
- **jail** — `int-jail.ts`'s `DOOR.face` is a direct import of `JAIL_DOOR`
  from `ct/jail.ts`, same relationship.
- **bodega** — the facade is explicitly approved and never repainted from
  the door registry (`ct/doors.ts` skips `d.face` in `publishDeclaredDoors`);
  the room's `face` literal was hand-set to match that approved, unmoving
  position. Confirmed by screenshot rather than by source alone.

**Two rooms are NOT single-sourced and are worth a future auditor's attention,
though both are currently correct:**

- **church** (`int-church.ts`, F's file) — `DOOR.face = { x: 9.6, z: -79.5 }`
  is a literal, commented as "measured off the flight the player actually
  climbs," not derived from `ct/civic.ts` (E's file). Checked against
  civic.ts's own step/landing arithmetic and it agrees today.
- **library** (`int-library.ts`, J's file) — `XF = -10.2` and `DOOR_Z = -13.0`
  are literals commented "from civic.ts," not imported from it. `XF` recovers
  correctly from `civic.ts`'s `-FACE - SET` (`-7 - 3.2 = -10.2`), and `DOOR_Z`
  matches the `cz` the room and the doorcase both build from.

Both are the exact shape `ct/doors.ts`'s own header describes as the bug this
mechanism exists to prevent — "ONE FACT AUTHORED TWICE." Neither is broken
today. **Not fixed here**: `ct/civic.ts` is E's file, `ct/int-church.ts` is
F's, `ct/int-library.ts` is J's, and nothing is actually wrong to route —
this is a fragility note, not a mismatch. If either civic.ts's step/doorcase
geometry ever moves, these two are the ones to re-check first.

## Instrument: doorside2.mjs is stale for bodega, and blind to six rooms

`scripts/doorside2.mjs` (not edited — scripts are add-only, GOTCHAS/OWNERSHIP,
and it isn't mine) reports bodega `** DOES NOT MIRROR **`. That is a false
red, not a regression: bodega's door moved onto the chamfer after that script
was written, comparing the chamfer's local offset (3.4) against the flat
wall's now-unused default layout is checking a quantity the room no longer
uses (the same class of fault as GOTCHAS 48 — a wrong instrument for the
shape, not a wrong world). It also never had bank/casino/church/hotel/jail/
library in its `NAME` map, so it silently reports "no frontage published" for
six of twelve rooms rather than saying it cannot see them.

Added `scripts/doormatch12.mjs` (new file, doesn't touch doorside2.mjs) which
uses `window.__ct.doors()` — the newer, general API that already covers every
declared door including chamfers — and states, per room, which mechanism
sources its exterior position rather than re-deriving a formula that only
applies to flat frontages. Run:

```
SHOT_URL=http://localhost:4188/ node scripts/doormatch12.mjs
```

It refuses to run without `SHOT_URL` (GOTCHAS 50 — an instrument that
defaults to a port is a silent wrong answer).

## Verification

- `SHOT_URL=http://localhost:4188/ node scripts/bugsweep.mjs` — **0 STATION
  MISS, 93 shots, no new console errors** (only known THREE.Clock deprecation
  and Canvas2D perf warnings, both pre-existing).
- `shots/bug-<room>-entry.png` × 12 — walked in each door and looked.
- `shots/ext-<slug>.png` × 12 — stood 5 m outside each declared door, facing
  it, and looked.

## Nothing else touched

No `ct/*.ts` file was edited — there was nothing to fix. `git status --short`
shows exactly one new file, `scripts/doormatch12.mjs`. No ledger row was
edited (the desk moves rows). No out-of-ownership mismatch was found to
report — the two fragility notes above (church, library) are not mismatches,
they are a same-answer-today, no-shared-source risk, and are named for
whoever next touches `ct/civic.ts`.
