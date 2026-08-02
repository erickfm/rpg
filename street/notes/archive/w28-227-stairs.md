# w28 — item 53: you can walk up your own stairs now

**Root cause, one line:** the No. 227 door landed you at `AX(1.2)` — the
arithmetic middle of the lobby, which is the middle of the **core wall** between
the two flights (its collider is `AX(1.04)…AX(1.36)`). The mean of the two
flights is not a place; it is the wall.

Nothing was wrong with the staircase, and the item said so. It was right.

## Reproduced before anything was changed

`scripts/probes/w28-227-landing.mjs`, on the unmodified world: from `AX(1.20)`,
holding W for six seconds walks into the wall and stops at **z −11.99 — 0.39 m
short of the stair foot at −11.6** — and `gy` never leaves 0.00. The item
quoted 0.37 m; same wall, same stop.

## The band that actually climbs, walked at 1 cm resolution

| landing | result |
|---|---|
| `AX(0.40)` and below | blocked by the west lobby wall, stops at z −17.3 |
| **`AX(0.41)…AX(0.67)`** | **climbs flight A to the half-landing, gy 0.00 → 1.35** |
| `AX(0.68)` and above | clips the core wall's SW corner, stops at z −11.99 |
| `AX(1.20)` (shipped) | the wall itself |
| `AX(1.80)` (flight B) | blocked — at lobby level flight B is the dead space *under* the return flight |

Both bounds are **static collider corners**. No frame time enters them, so these
margins are facts rather than averages — unlike anything involving the jump.

## The fix

`0.6` is now **`FLIGHT_A_X`** (with `FLIGHT_B_X = 1.8` for the return flight),
and **both the tread meshes and the door's `jumpTo` read it**. They had the same
number written twice and only one of the two copies was ever about where a
player stands, which is how they were allowed to disagree in the first place
(BUILDER-BRIEF §8). The landing sits **+0.07 / −0.19** inside the measured band.

I chose flight A's own centreline over the band's midpoint (`≈0.54`) because it
is derived and self-documenting — *land on the flight you are about to climb* —
and 7 cm against a fixed wall corner is a real margin. Said here rather than
buried, because the upper side is the tighter one.

## Proof — walked, on the built bundle

`scripts/w28-227-stairs.mjs` is the acceptance test and it **walks**. Item 53 is
explicit that a check which warped instead of walking is how the storey picker
went untested for its whole life, so: the door is found through
`__ct.spots()` by its label, the player is put **on the street** at it, the
world's own `act()` does the entering, and from wherever that drops him **the
only further input is a held W**. No steering, no second warp.

```
the door publishes itself at (6.55, -44.00), r=1.05
OK   standing at No. 227 the door OFFERS itself
OK   pressing [E] put you INSIDE — the lobby, at (200.60, -18.70)
     held W: walked 9.37 m to (200.60, -9.33),  gy went 0.00 -> 1.35
OK   holding W REACHES THE FIRST STEP AND CLIMBS IT
OK   and keeps going to the half-landing at 1.35
```

**Mutation-tested, exactly as the DONE WHEN asks.** Landing moved back to the
flight boundary `AX(1.2)`, rebuilt, re-run: **2 FAIL, exit 1**, landing at
201.20 and stopping at z −11.98. The bytes moved with it — the content-hashed
bundle went `index-CtzTte_8.js` (1,116,335 B) → `index-BIS-ksD8.js`
(1,116,340 B) — so this was a real build of a real change, not a re-run.

The verdict is **`gy`**, not `camY`. `__ct.pos()` is `[x, EYE, z, gy]` and index
1 is a constant 1.62 whatever is under your feet, so a climb is invisible in it.
Reading the wrong element cost the first probe a whole run and is GOTCHAS §20 in
miniature — the same array-versus-object trap `L-slots-inworld.mjs:285` already
warns about.

Also: `bugsweep.mjs` on the built bundle — exit 0, **zero STATION MISS**, no page
errors. `health.mjs` — WORLD OK. `tsc --noEmit` clean.

No `fp before/after`: the only drawn change is `AX(0.6)`/`AX(1.8)` becoming
`AX(FLIGHT_A_X)`/`AX(FLIGHT_B_X)`, which are those same two numbers. The world
cannot have moved.

## A trap that cost me three runs, recorded so it costs nobody else one

**The DEV SERVER served a stale landing through HMR after I edited
`apartment.ts`.** Three consecutive runs of the acceptance test on
`vite --port 4181` reported the door dropping the player at `(198.60, −16.30)` —
an origin that does not exist in this world; there is exactly one core-wall
shaft, at `APT_X = 200`. A diagnostic probe against the *same server seconds
later* read the correct `(200.60, −18.70)`, and the built bundle has been right
every time since.

I nearly went looking for a second apartment block that was never there.
**Verify this class of change on the build** — BUILDER-BRIEF §10 already says so
and this is one more reason.

## Found and NOT fixed

1. **`scripts/probes/w25-kerb-gy.mjs` fails 2 of 9 in this worktree** — the
   `groundAt`-is-a-pure-read pair, item 49's subject. **Not mine and not a
   regression:** my branch is based on `4d35e1b1b`, and
   `git merge-base --is-ancestor 4747db57b HEAD` confirms w26's fix
   (`4747db57b`, "groundPick was a query that moved the player") is **not an
   ancestor of my HEAD**. It will pass once the merge train rebases this.
2. **`AX(1.20)` is still reachable as a landing from anywhere else that lands in
   this lobby.** I fixed the one door item 53 names. `apartment.ts:3127`'s
   `jumpTo(SPAWN.x, SPAWN.z, …)` and the interior door spots were not audited
   against the flight-boundary problem; a sweep of every `jumpTo` in that file
   against the measured band would be a cheap follow-up now that `FLIGHT_A_X`
   exists to compare against.
3. **The band's lower bound at `AX(0.41)` is the west lobby wall plus the
   player's radius**, and I did not identify which collider makes the upper
   bound `AX(0.67)` rather than the `1.04 − radius ≈ 0.70` the geometry
   predicts. 3 cm unexplained; it does not change the fix, but the arithmetic
   does not quite close and I would rather say so.

## Ports

**4181** (dev, `curl` → `000` before use) and **4180** (built preview). Both
proved free. Both shut down at the end.
