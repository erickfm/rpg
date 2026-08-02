# w32 — item 68: `interiors-walk` exited 2 for every room

**Port used: 4188** (proved free with `curl -o /dev/null -w '%{http_code}'` → `000`
before starting; dev server shut down at the end.)

## Root cause, one line

`roomDims()` quietly became **two registries answering two questions** — "rooms
that exist" and "rooms I can street-walk" — and `interiors-walk`'s coverage guard
asked the first while meaning the second.

## What was actually wrong

The item's diagnosis was **right about the cause and wrong about the fix**, and
the difference matters.

Right: the red *is* one registry omission. `apt301` was added to the dims
registry so `seat-facing` could finally see the bed in 301 (a genuinely good
fix), the coverage guard at `interiors-walk.mjs:395` demands every published room
be in its hand-written `ROOMS` list, and `apt301` was not. The guard exits 2
*before any room is walked*, so it exited 2 for **every** room — reproduced
directly: `node scripts/interiors-walk.mjs diner` → `EXIT=2`, and `diner` is in
`ROOMS`. `checks.mjs:1051` renders that as `FAILED (2)`, hence a wall of twelve
room failures caused by one room.

Wrong: "add it to `ROOMS`" would not have worked. Every leg in this file is built
on four facts that `apt301` does not share. Measured from the world's own
registry (`scripts/probes/w32-roomdims-dump.mjs`):

|                  | the twelve belt rooms | `apt301`  |
| ---------------- | --------------------- | --------- |
| `cx`             | 440 … 1320            | 198.40    |
| `cz`             | 0.00                  | −16.25    |
| `y` (floor)      | 0.000                 | **5.400** |
| width            | 8.8 … 20.0 m          | 3.06 m    |
| entered by       | `[E]` at a street door | a stair shaft |

The entry leg locates a room by its slab address
(`400 + floor((x−400)/80)*80 + 40`), §5 asserts `back[0] < 100` for "you are back
on the street", the way-out leg matches `/out to the street/`, and every interior
warp passes `gy = 0`. A third-floor flat 200 m west of the belt satisfies none of
it. Forcing `apt301` through those legs would have converted one honest `exit 2`
into a screenful of false failures — the same "could not measure vs. measured and
wrong" confusion the item exists to stop, just pointed the other way.

## What I changed

**`src/proto/ct/interior.ts`** — `RoomDims` now publishes `belt: boolean`.
It is **derived** in `interiorRooms()` from which list a room came out of
(`SLABS` → true, `DECLARED` → false), not stored per room, so a new room cannot
type it wrong and a future kit room gets it for free. `declareRoom` takes
`Omit<RoomDims,'belt'>` — a room does not get to *say* it is in the belt;
declaring itself is what makes it off-belt. **No change to `ct/apartment.ts` was
needed**, which kept the change inside the two files the item named.

This distinction is not new. It is exactly what `DECLARED` was created for
("rooms that were not built by this kit"), and `interiorRoomIds()` already makes
the same split for its own different question. It had simply never been
published, so the one caller that needed it had to guess.

**`scripts/interiors-walk.mjs`** —

- The guard partitions on `belt`. Belt rooms must be in `ROOMS`; off-belt rooms
  must be in a new `OFF_BELT` list whose `covers:` field names the check that
  *does* walk their door (`door301` for `apt301`). **Teeth unchanged in both
  directions** — either kind of room going unaccounted for still exits 2. This is
  not the guard being loosened; it is the guard being given the second question
  it was always missing.
- If the world does not publish `belt` at all, the suite **refuses and exits 2**
  rather than guessing from `cx >= 400`. A hand-typed duplicate of a value the
  registry owns is what brief §8 forbids.
- `apt301` is now genuinely walked, for the legs decidable about it: it was
  built, the floor picker agrees with the rig **three storeys up**, there is
  standable floor, there is a lane a player fits down, and it can be crossed.
  The legs that cannot apply (street approach, `[E]` entry, way-out prompt, kerb
  landing, keeper facing) are **printed as not-applicable**, not silently
  dropped — a report that looks complete about something it never looked at is
  the GOTCHAS 34 failure this guard exists to prevent.

## Two instrument bugs I wrote and caught

Both were mine, in the new off-belt legs, and both would have shipped green.

1. **"you can walk the room end to end" passed by leaving the room.** It reported
   *"travelled 4.43 m of a 2.20 m run"* — in a room **3.06 m wide**. The belt's
   version asks for `travelled > run * 0.8`, which is safe in a shop because the
   doorway is a dead reveal; 301's door is a real door onto a real landing, and
   in a 3 m room the widest clear lane is the one straight through it (lane at
   local z −0.22, doorway at local z −0.25 — the same band). The rig crossed the
   room, carried on out, and stopped 3.44 m local, one and a half room-widths
   past the far wall. Verified with `scripts/probes/w32-apt301-lane-overshoot.mjs`
   that `gy` stays 5.40 throughout — **the landing, not a fall, and not a wall
   clip**. Now measured as *arrival at `x0 + run`*, a point inside the room,
   which a doorway cannot inflate.

2. **The floor leg compared the harness's input to itself.** Written as
   `Math.abs(at[3] - gy)` where `gy` was the same variable the warp used, it held
   whatever the harness happened to be doing. Mutating
   `const { y: gy } = built` → `gy = 0` — standing in the street *under* the
   building it claims to be inside, the precise bug `RoomDims.y` was published to
   stop — still passed **6/6**. It now reads `built.y` back from the registry.

## Mutation tests (all confirmed to change bytes)

| mutation | expected | result |
| --- | --- | --- |
| `diner` removed from `ROOMS` | red | `exit 2`, "the world publishes BELT rooms this suite does not test: diner" |
| `apt301` removed from `OFF_BELT` | red | `exit 2`, "the world publishes OFF-BELT rooms this suite does not test: apt301" |
| off-belt warp `gy` hardcoded to 0 | red | `FAIL … rig gy=0, room's published floor y=5.4` (5/6, exit 1) |

The third is the one that matters: **before** the fix in §2 above, that same
mutation passed 6/6.

## The full run

`SHOT_URL=http://localhost:4188/ node scripts/interiors-walk.mjs` — **312/318,
all 13 rooms walked, no room `FAILED (2)`.** All six apt301 legs pass, including
`rig gy=5.4, groundAt=5.4`.

The suite still **exits 1**, on six failures that are all pre-existing and none
of which are in code I touched:

| room | assertion |
| --- | --- |
| casino, hotel, pawn, tax | "the customer station comes from the world, not from memory" — no served-spot published; already documented in `F-keeper-stations-audit.md` |
| jail, casino | "the room keeps its own light after dark" — 6/501 and 109/803 interior materials dimmed by the night sweep |

Proof they are not mine: the diff removes **seven lines**, all of them in the
coverage guard, the positional room filter, and the empty-run tally message. The
entire belt walk loop is byte-identical to mainline, so none of these six can
have moved. That exit 1 is "ran and found a fault" — which is exactly the status
this item wanted distinguishable from "refused to run", and it is now the one the
suite reports.

Also green: `npm run build` (tsc + vite) clean, and
`node scripts/bugsweep.mjs` → **0 STATION MISS, 0 COVERAGE**, no new console
errors. Bugsweep already prints the same distinction in its own words —
*"12 int-*.ts on disk, 12 registered, 13 with dimensions (1 declared
elsewhere)"*.

## Found and did NOT fix

- **`scripts/bugsweep.mjs`'s three `bug-apt301-*` stations.** `ct/interior.ts`'s
  own comment on `RoomDims.y` records that they pass `verifyLanded` — which only
  checks x and z — while standing at street level photographing the *outside* of
  the building. I did not touch `bugsweep.mjs`; it is not named by this item.
  Now that `RoomDims.y` is published and proven usable, that is a small, well-
  defined follow-up: pass `r.y` as `warp`'s `gy` for those stations.
- **`apt301` has no containment leg.** The belt's "the room holds you in from
  every direction" leg cannot run here, because walking out of a real door onto a
  real landing is not an escape. Deciding it properly needs the landing modelled
  as legitimate territory. Worth queueing, not worth guessing.
- **`apt301` has no keeper and no night-light leg.** No keeper is correct (nobody
  is in it). The night-light leg samples `Math.abs(wp.z) > 8` around `cz = 0` and
  would need the same `cz` generalisation the other legs got; I left it belt-only
  rather than half-generalise it.

## Derived vs. copied

Everything geometric is **derived**: `cx`, `cz`, `y`, `w`, `d` all come from
`built` (the live `roomDims()` entry) inside the loop. The one constant I reused
is `RADIUS = 0.36`, already declared at the top of this file, and the off-belt
lane threshold is `RADIUS * 2` — the player's own diameter, which is the only
non-arbitrary floor for "can a person be in here". The belt's `W * 0.55` is a
proportion of a shop frontage and is meaningless in a 3 m bedroom, so it was not
carried over.
