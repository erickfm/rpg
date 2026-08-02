# w2 — item 8: church/library hand-duplicate their door position

**Root cause, one line:** `ct/int-church.ts` typed its own door's world
z-coordinate (-79.5) three separate times (`DOOR.cz`, `DOOR.face.z`, and the
room's own `door.z`/`outZ`), and typed two more points 0.75 m and 2.4 m out
along the same face — `door.x: 8.85` and `outX: 7.2` — as unrelated-looking
literals rather than as offsets *derived* from `DOOR.face`. All five numbers
happened to still agree, which is exactly the "correct today, able to drift"
shape the item describes: nothing would have failed loudly the day someone
moved the church without re-measuring the other four.

## What I fixed (church, fully — `ct/int-church.ts`)

Hoisted the one fact — `CHURCH_FACE = { x: 9.6, z: -79.5, nx: -1, nz: 0 }` —
and a two-line `standOff(distance)` helper, the same derivation
`ct/int-jail.ts`'s `JAIL_DOOR`/`standOf` already uses one file over (I
checked: `standOff(0.75)` reproduces `{8.85, -79.5}` exactly, `standOff(2.4)`
reproduces `{7.2, -79.5}` exactly — confirmed algebraically before editing,
not guessed). `DOOR.cz` now reads `CHURCH_FACE.z`, `DOOR.face` **is**
`CHURCH_FACE`, and the room's own `door:` field spreads `standOff(0.75)` for
the way-in point and derives `outX`/`outZ` from `standOff(2.4)`. Nothing
below the declaration retypes -79.5, 9.6, 8.85 or 7.2 any more.

Kept `standOff` local to this file rather than importing `ct/int-jail.ts`'s
`standOf` — a *runtime* edge between two `int-*.ts` siblings is exactly the
GOTCHAS §28 shape (an eager-glob module in a cycle can silently resolve to
`undefined` in the built bundle), and the function is two lines, so
duplicating it with a citation is cheaper and safer than importing it. Also
did not reach into `ct/civic.ts` to derive `CHURCH_FACE` itself from the
exterior's own geometry: the church exterior is built in a LOCAL frame inside
`buildCivic()` and only turned/positioned into world space by `ct/street.ts`
*after* `civic.ts` returns (see the comment at `civic.ts:153-154`), so the
"one true source" for a world-frame door point does not exist inside
`civic.ts` today — deriving it correctly would mean composing `street.ts`'s
placement transform too, and `street.ts` is not named by this item and is a
much higher-risk shared file. Flagging this as the honest next step below
rather than reaching for it.

## What I did NOT fix — the library half, and why

The item also names "library pair" (`ct/int-library.ts`). I looked: its
duplication is smaller than the church's — `DOOR.cz: -13` and
`frontage.cz: -13` retype what a local `const DOOR_Z = -13.0` already holds
two lines above (the room's own `door:` trigger position isn't retyped at
all; the kit derives it from `DOOR.face`, which already reads `XF`/`DOOR_Z`
correctly). A one-line fix once it's reachable.

**It is not reachable right now.** `ct/int-library.ts` is named by item 3,
which was `DOING w1` (a different builder, a different worktree) for this
item's entire duration — a same-file collision, not a decision. Per
`BUILDER-BRIEF.md` §9, I left it untouched rather than editing a file another
builder currently holds. Queue-worthy follow-up for whoever picks it up next
(one line, in `ct/int-library.ts`): change `frontage: { name: 'LIBRARY', w:
16, cz: -13, ... }` to `cz: DOOR_Z` and `DOOR.cz: -13` to `DOOR.cz: DOOR_Z`.

## Verification

- `npx tsc --noEmit -p .` — clean.
- `SHOT_URL=… node scripts/interiors-walk.mjs church` against **dev**:
  25/25 passed, including the numbers that prove the refactor changed
  nothing — entry prompt at `x=8.85 z=-79.5` (was the literal `8.85,-79.5`),
  exit lands at `pos=7.2,1.62,-79.5` (was the literal `7.2,-79.5`), no
  re-entry trap, room walkable end to end. This script cannot run against
  the **built** bundle by construction — `apartment.ts:165` documents why
  (`af5b68cd`: it dynamically imports the dev-only `/src/proto/ct/doors.ts`
  path) — so I did not try to force it there.
- `node scripts/world-wired.mjs` on dev: 12/12 interiors still build.
- `node scripts/bugsweep.mjs` against the **built** bundle (`vite preview`):
  93 shots, no new console errors.
- Confirmed via `git diff --stat` that only `ct/int-church.ts` changed.

## Derivation note

`CHURCH_FACE`'s own `{x:9.6, z:-79.5}` is still a measured literal — it is
the ONE place that fact is now typed, replacing five. `standOff` is a
citation-flagged duplicate of `ct/int-jail.ts`'s two-line helper, not an
import, for the GOTCHAS §28 reason above.
