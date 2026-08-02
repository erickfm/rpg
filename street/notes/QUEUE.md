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
| 20 | TODO | ct/apartment.ts + scripts/K-tv-off-unless-seated.mjs | **Sitting on the bed no longer turns the TV on** — a feature the ledger calls CONFIRMED. w14 reproduced it standalone twice (`scene.userData.tv.on` stays false to a 6s waitForFunction, not a timing artefact). **The desk moved that seat to the foot of the bed this session** (4d5729246, per the user: *"sitting on the bed should have a perspective more from the foot of the bed"*) so start there — the check finds the seat by matching `/sit on the bed/i` over `__ct.spots()`, and its own failure text says the SLEEP spot may now win every pick. Decide which is true: the pick moved, or the TV trigger broke. **Do NOT undo the foot-of-bed view; that is what the user asked for.** DONE WHEN: the check is green AND you have walked it — sit, TV on; stand, TV off. |
| 21 | TODO | scripts/checks.mjs + scripts/canfail.mjs | **Register `seat-facing.mjs` in CHECKS so it actually guards.** w17 wrote it and it went red on **105 seats** — 96 casino slot stools sat with their backs 0.37 m from the machines, next to NPCs already facing the right way. That is the fifth facing bug class and the check is currently a one-off that no suite runs, so the sixth will ship too. Needs a `canfail.mjs` case like every other registered check. DONE WHEN: `seat-facing` appears in the CHECKS table, `node scripts/checks.mjs` runs it, and its canfail case goes red when the mutation is applied. |
| 22 | TODO | scripts/seatface.mjs | **An instrument that lies, and it lied about the exact class w17 just found.** `seatface.mjs` filters colliders to `|minX| < 500`, but the interior belt starts at x ~ 600 — so it is blind indoors. It reported *"222 of 228 seats look at open ground"* on a world where **105 seats faced backwards**. Either lift the filter or delete the file; a check that cannot fail is worse than one that is wrong (BUILDER-BRIEF §7). DONE WHEN: it either agrees with `seat-facing.mjs` on the same world, or it is gone. |
| 23 | TODO | scripts/L-blackjack-inworld.mjs | **A check contradicts a deliberate safety fix — reconcile it WITHOUT weakening the world.** It calls `__blackjack.open()` with nobody seated (line 93; line 191 says *"NOT TESTED HERE: sitting down"*). 27be185fc made **not seated = not open, unconditionally**, because an open panel with an empty seat killed `[E]` everywhere until reload — the trap the user hit twice. So the tick closes it and the check reads 8 sub-failures. **The world is right; the check is wrong.** Do NOT relax the seat rule to make it pass. Give the check a seat, or the table a test-only hook outside the shipped path. DONE WHEN: `L-blackjack-inworld` green, `L-blackjack-reachable` still green, and you have proved the trap has not returned. |
| 24 | TODO | ct/props.ts + scripts/rain-check.mjs + scripts/rainlive.mjs | **Three rain follow-ups w16 reported rather than fixed.** (1) `rain-check.mjs` keeps the LAST `Points` of three and has been asserting world-lock about a 13-point set that never moves — the tell is every drop delta reading exactly 0.000, which the wrap cannot produce; `w16-rainlock.mjs` is a working replacement. (2) `rainlive.mjs` steps the clock with `h % 24`, but `hourAbs` is absolute and `rainAt` hashes it through murmur3, so it is not periodic in 24 — it tests a DRY hour believing it is wet. (3) The other two `Points` are also `frustumCulled` at the origin, which was exactly the rain bug; check whether either follows the player. DONE WHEN: each is fixed or shown not to apply, with the measurement. |
| 25 | TODO | notes/GOTCHAS.md | **Two numbering defects and a missing entry.** §51 and §52 are each used twice and §51 appears after §52 (w14 found it); the desk then appended §59 assuming 58 was the last. Renumber so every entry is unique and ordered, **without changing any entry text** — other files cite these by number, so leave a mapping note. Then add the entry w17 asked for: **`ctx.seat` yaw is `0 = -z` but `citizenSprite` facing is `0 = +z` — they are 180 degrees apart**, and that convention clash is plausibly where several of the five shipped facing bugs came from. DONE WHEN: no number appears twice, order is monotonic, the yaw-convention entry exists, and a grep for citations of any renumbered entry has been updated or noted. |
| 26 | TODO | ct/int-casino.ts | **One roulette seat is unreachable** — an 0.08 m sliver between the felt and a slot bank, found by w17 while fixing 105 backwards seats and left alone because it is a layout call, not a seat call. Pre-existing, not a regression. The 2 m lane is sacred indoors too. DONE WHEN: the seat has a legal standing approach, `seat-facing.mjs` is still green, and bugsweep reports zero STATION MISS. |
| 27 | TODO | scripts/seampairs* + ct/jail.ts | **39 declared-vs-mapped density mismatches, clustered at the jail exterior** (x~63, z~-103..-107) — the same location class as the seam disagreements, so possibly one underlying jail-masonry cause rather than two. Check whether the seam work already landed fixes them before doing anything else; if it did, say so and mark it done. DONE WHEN: the count is re-measured after the seam fix and either goes to zero or is explained with its real cause named. |
| 28 | TODO | ct/park.ts + ct/citizens.ts (outdoor seats) | **Outdoor benches and seated NPCs are still unguarded** by `seat-facing.mjs`, which covers only `__ct.seats()`. w17 wrote up the reasons and the cheap fixes in `notes/w17-seat-facing.md`. Five facing bugs have shipped indoors; the same class outdoors is currently invisible. DONE WHEN: outdoor seats and seated NPCs are covered by a check that goes red when one is deliberately turned around. |

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

**Push before spawning.** GOTCHAS 59: a worktree is a snapshot, so a builder
created before a fix lands cannot see it and will redo the work — that has
already cost two agents on one door and a merge conflict. Land and push
everything finished, THEN spawn.

- Add items **in rank order**, not at the end. Rank is the whole value of this file.
- Every item names its **file(s)** so collisions are visible before they happen.
- An item should be one builder's work. If it needs three, it is three items.
- When a builder marks something done, **verify it against the source yourself**
  before moving the LEDGER row. Every agent this week has made at least one claim
  that did not survive checking.
