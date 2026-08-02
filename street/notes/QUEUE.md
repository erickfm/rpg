# The queue

**One ranked list. Builders take from the top and keep going.**
Rules for *how* to do the work are in `notes/BUILDER-BRIEF.md` — read that once.

- `./scripts/claim.sh <name>` — atomically takes the top unclaimed item
- `./scripts/done.sh <name> "what you did"` — releases it for the desk to verify
- **Never edit this file by hand while builders are running.** The scripts lock it.

Ranking is the desk's judgement about what the user actually cares about.
**Take from the top; do not shop.** The only reason to skip is `file:` collision
with an item another builder already holds.

| # | state | file(s) | what |
|---|---|---|---|
| 1 | DOING w13 23:37 | `fp.ts` + `ct/gap.ts` + callers | **COLLIDERS HAVE NO HEIGHT AND NO ROTATION — the user has reported this from three directions.** *"we should be able to jump on the cars"*, *"i want the collision to be a bit more accurate to the objects"*, and *"we should fix this so its not just a bunch of separate rectangles and its just made properly."* `fp.ts:9` is `AABB = { minX, maxX, minZ, maxZ }`: every collider is a footprint extruded to infinity, so a car is a car-shaped wall with no top, and the bodega's 45 degree chamfer is faked with a staircase of small boxes (13 round that corner, smallest 0.24x0.16 m). **Give a collider a top (`minY`/`maxY`) and let the floor picker stand on it when the player is above** — `ct/interior.ts` and `COURT.climbable` are the prior art for standable surfaces. Rotation (an oriented box or a segment) fixes the chamfer; more small boxes fixes nothing. **THIS IS THE HIGHEST-RISK CHANGE IN THE PROJECT.** `fp.ts` is the movement core, the 2 m sidewalk lane is sacred, and **every existing `ctx.obstacle` call must behave exactly as it does now unless it opts in** — an opt-in default is what makes this safe. Do it in stages, committing each: (1) add the fields, defaulted so nothing changes; (2) prove the world is unchanged with `npm run fp` before/after; (3) make ONE object standable — a parked car — and walk onto it; (4) only then widen. **Also fix the false alarm this exposes:** `trapAgainst()` paints adjacent boxes forming one wall as red trap corridors, which is why the bodega corner lights up worst exactly where the geometry is worst. Verify by WALKING, with V on, and re-run `interiors-walk.mjs` for every room. |
| 5 | DOING w14 23:45 | `scripts/checks.mjs` | **The full check suite kills its own preview server** partway through, so ~half its 52 failures are that rather than real faults. **Fix the cause, not the symptom** — restarting the server after each check would hide a check that kills servers. Then classify all 52 real vs artefact and queue the real ones. |
| 6 | DONE w15 — Item 6 seams fixed, 227 -> 0 (grown from the item's 103-107). ROOT CAUSE, and the item's stated cause was WRONG: shell() in ct/jail.ts handed the FLANK material to material index 0 too, but on BoxGeometry(depth,height,width) the +/-x faces span WIDTH and the +/-z faces span DEPTH, so a depth-sized texture was stretched over a width-sized face — worst case a 4 m canvas over the 14 m BACK wall, 4.57 px/m against a declared 16. w3's note blamed the east FLANK; the flanks measured 15.96-16.09 and were always fine. Fixed with a 'back' material on shell() defaulting to 'face' (derived: both +/-x faces span exactly width x height), 0.2 m end caps on the yard screen walls (was 770 px/m), own-height flanks on the lintel/recess shells, and dressed stone for the five trim boxes that shared one 1 m ashlar canvas (0.08 m sill drew at 200 px/m). Trim density DERIVED from masonry(1,1,0,2).ppm so the 'detail' declaration is not what makes it pass. Mutation-tested: reverting the back slot returns 126 disagreements; seampairs --selftest still PASSES; the walk's collision legs go red when told to walk through the fence. World unmoved: objects 8351->8351, zero geometry params changed, the 3 'places' rows are 4 props decals that reroll y on EVERY unseeded load. bugsweep 0 STATION MISS, walk 8/8, all re-verified on the BUILT bundle. NOTE: this row had already been marked done once and the desk's own QUEUE.md commit d4f511e1b overwrote it — see notes/w15-jail-seams.md. | `scripts/seampairs*` + `ct/jail.ts` | **103-107 brick seam disagreements**, sample dominated by the jail block; a worker established these as REAL, not artefact, with visual confirmation. Now fix them. |
| 7 | DOING w16 23:47 | `ct/props.ts` | **Rain never gets heavy.** Scanning 72 half-hour steps, peak material opacity was 0.155 (`0.55 * rainLevel`), so `rainLevel` never exceeds ~0.28 — it is permanently a faint drizzle at every hour sampled. The desk added a dark sheath to each drop for contrast but could not judge it because a downpour never arrives. **Raise the ceiling so heavy rain is heavy, then judge the sheath by facing four directions at peak.** The comment at `ct/props.ts:101` records rain was already made "findable" once; this is the same complaint one level deeper. |
| 5b | DESK-PARTIAL | `ct/props.ts` | **Rain contrast — desk applied the fix, and found a SECOND bug that blocks verifying it.** Cause measured, not guessed: drops per view facing three ways from one spot were **142 / 129 / 126** — the volume is even, so `RAIN_BOX` and the wrap are NOT the bug. It is contrast: the streak was `rgba(214,222,232)` pale blue-white against fog `0x8a97a2` pale blue-grey, so along the street it dissolved into sky while across the street dark brick made it read. **FIX APPLIED: a dark sheath either side of the bright core** — against sky the sheath bites, against brick the core does, and the core stays one texel so the streak does not fatten into 'falling grit' (the previous note's warning, still valid). **SECOND BUG, UNFIXED, and it is why the desk could not confirm the first by eye: THE RAIN NEVER GETS HEAVY.** Scanning 72 half-hour steps, peak material opacity was **0.155** — `0.55 * rainLevel`, so `rainLevel` never exceeds ~0.28. It is permanently a faint drizzle, in every direction, at every hour sampled. **Whoever takes this: raise the ceiling so a downpour is a downpour, THEN judge the sheath by walking four directions at peak.** The comment at `ct/props.ts:101` says rain was already made more findable once — this is the same complaint one level deeper. |

**Not queued, deliberately:** `D-outline-debug-only` fails on stale stations, not
a regression. Do not send anyone after it.

---

## For the desk

**RANK IDS ARE `<digits><letters>` ONLY — `0a`, `5b`, `9e`.** Never `0d2`: the
claim pattern is `[0-9]*[a-z]*`, so a digit after a letter makes the row
invisible and the item silently unclaimable. That has now happened twice; the
second time the check below caught it in seconds.

**Run this after every queue edit:**

```sh
./scripts/queue-check.sh          # counts must match; see the script
```

**Workers run whenever this file has unclaimed work.** The user's standing rule:
*"if there is a queue there should be workers working. always."* Check
`grep -c '| TODO' notes/QUEUE.md` first thing every tick; if it is non-zero and
fewer than the cap are running, spawn. Do not let items sit while slots are free.

**Push before spawning.** GOTCHAS 57: a worktree is a snapshot, so a builder
created before a fix lands cannot see it and will redo the work — that has
already cost two agents on one door and a merge conflict. Land and push
everything finished, THEN spawn.

- Add items **in rank order**, not at the end. Rank is the whole value of this file.
- Every item names its **file(s)** so collisions are visible before they happen.
- An item should be one builder's work. If it needs three, it is three items.
- When a builder marks something done, **verify it against the source yourself**
  before moving the LEDGER row. Every agent this week has made at least one claim
  that did not survive checking.
