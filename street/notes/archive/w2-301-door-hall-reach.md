# w2 — item 1: front door unreachable from the hall

**Root cause, one line:** `ct/apartment.ts` registered exactly one `[E]`
interaction spot for 301's door, positioned deep inside the room (x 199.36,
r0.95), so its own reach (x ≤ 200.31) never got past the wall into the hall,
and the aim-based fallback (`pickSpot`'s `looked` path) couldn't reach it
either because a shut door is opaque and blocks the visibility raycast —
there was never a code path by which a player standing on the landing, with
the door shut behind them, could interact with it at all.

## Fix

Added a second `ctx.spot` for the same door, mirrored across the dividing
wall's centreline (`AX(0)`) by construction — `HALL_STAND_X = 2*AX(0) -
ROOM_STAND_X` — rather than a second hand-typed coordinate. Both spots share
one `ok`/`label`/`act` triple (`doorOk`/`doorLabel`/`doorAct`), so the door
stays one piece of state with two thresholds, not two doors that could drift
out of agreement. `src/proto/ct/apartment.ts:1027-1066`.

## Verification

- `npx tsc --noEmit -p .` — clean.
- Extended `scripts/A-verify-301-door.mjs` with a second station: shut the
  door from the room spot, warp to the hall spot, and run the same
  close→open→close cycle from the landing. Ran against dev (4181) and
  against the **built bundle** (`vite preview`, 4181) — both green:
  ```
  door shut, on the landing   [E] open the door
  after E from the hall       [E] close the door
  after 2nd E from the hall   [E] open the door
  ```
- Confirmed the check actually catches the original bug: `git stash`d just
  `apartment.ts` (keeping the extended script), reran against the unpatched
  build — the hall station correctly reports `CANNOT ANSWER — only one
  door-spot registered; no hall-side station exists.` (exit 3). Unstashed
  and reran clean.
- `node scripts/bugsweep.mjs` against 4181: 93 shots, zero STATION MISS, no
  new console errors (only pre-existing THREE.Clock deprecation / Canvas2D
  readback / GPU-stall warnings, same as before this change).

## Not fixed, found in passing

Nothing new found outside the claimed file. The hall-side stand point
(200.64, hall z) sits in open hall floor with no colliders nearby — checked
`sevColliders` by hand, no overlap.

## Derivation note

`HALL_STAND_X` is derived from `ROOM_STAND_X` and `AX(0)` (both already
declared in this module) rather than typed as a second literal — see the
comment at the mirror's declaration for the arithmetic. `STAND_Z` is shared
by both spots unchanged from the original room-side value.
