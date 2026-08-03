# onehundredone / item 183 — the plug was never load-bearing; the wall was

**DONE, and the row's premise is false.** Item 183:

> *"Collider **#204** blocks 302's doorway on all four floors… now that 109 has
> cut real openings for 102, 202 and 402, **that collider is the only thing
> stopping the player walking into those flats**… DO NOT SIMPLY DELETE IT. DO
> NOT SIMPLY LEAVE IT."*

The worry is a good one — a stray-looking collider doing load-bearing work is a
real trap, and filing it rather than quietly leaving it was right. **It was
pointed at the wrong box.**

---

## Measured first, by walking — `scripts/probes/w101-flatdoor-plug.mjs`

Stand west of the east doorway on each floor, face east, hold W. Twice: once as
shipped, once with the plug parked at 9999 at runtime (the same mutation
`setCap` performs on the caps every frame — nothing on disk).

| | floor 0 | floor 1 | floor 2 | floor 3 |
|---|---|---|---|---|
| **with** the plug | 1.876 | 1.876 | 1.876 | 1.888 |
| **without** it | 2.040 | 2.039 | 2.040 | 2.040 |

Local x; the east wall's inner face is **2.40** and the rig's radius is **0.36**,
so **2.04 is the wall, exactly.** **The player never reaches the opening either
way.** Removing the plug opens nothing on any floor; it moves you 0.17 m.

**Why, in one line:** the east wall's own collider is
`{ AX(2.40)…AX(2.55), AZI(0)…AZI(13.2) }` — **a single unsplit run over the
whole east side** — where the west wall is pushed as *two* pieces with a hole
between them. The row read a collider list, where those two look alike; the
difference is the entire mechanism.

---

## What is actually deliberate here, now written down

Eight flats open off this shaft. **One is modelled** — 301 — and the asymmetry
between the two wall lines *is* the design:

| | | |
|---|---|---|
| **west** `AX(0)` | 301 is enterable | wall collider **SPLIT** around the doorway; 101/201/401 are shut by **`aptDoorCap`**, which `updateCaps` moves into the gap on every storey but 301's. It **moves** because *which floor you are on* is what decides. |
| **east** `AX(2.4)` | nobody enters 102/202/302/402 on any floor | wall collider is **ONE UNSPLIT RUN**. Nothing to gate, so nothing moves. **This is what holds all four east doorways shut.** |

Both halves now say so at the push site, and the east wall's line carries the
warning that splitting it "to match the west wall" opens four doorways into
unmodelled space.

## #204 — justified in place, not deleted, not left silent

It is **not** structural, and it now says that in its own comment. What it *does*
do is keep the player out of the **0.15 m reveal** the east doorways are cut
into — the one the hermit stands in. `hermitCap` only makes him solid while he
is home, so on his way out it is this box that keeps the doorway his rather than
letting you stand shoulder to shoulder inside it. Derived from the same
`DOOR_GAP` the opening is cut from, so it cannot drift from the hole it fills.

## ⚠ AND A TRAP I FOUND WHILE LOOKING FOR A BETTER MECHANISM

My first instinct was the obvious tidy-up: give each doorway its own collider
**bounded to its own storey** with `minY`/`maxY`, so a reader can see one box per
door. `AABB` supports it (`fp.ts:42`).

**Do not.** `fp.ts`'s `standTop` treats **any collider carrying a `maxY` as a
standable surface** — worker fifty measured that the only ones in the world are
the pickup's five tops and the sedan's two — so bounding these per-floor would
let the player **stand on a door head at 2.1 m and walk the building at lintel
height.** That is now a warning at the push site, because it is exactly the
"helpful" change the row was written to prevent, one axis over.

---

## The item's other question: does `texdensity` reach these surfaces?

> *"`masonry.mjs` cannot see any of these surfaces — they are interior and the
> cull hides them… if item 161 has landed, the new `texdensity.mjs` sweep should
> now reach them, so check."*

**Checked. Yes, and they are clean.** In the walk-up's band (x 194…210,
z −30…−6): **442 meshes, 281 textured faces, only 8 currently hidden** — and
`texdensity` ignores `visible` entirely, which was the whole point of it, so it
measures all 281. **None of them is gross.**

**But nothing in the report says "walk-up".** The building publishes no
`userData.mod` and its meshes are mostly unnamed, and `ownerOf` only falls back
to the interior registry, which does not cover x ≈ 200. So all 281 are
attributed to the anonymous **`?`** bucket. It is measured, and it is
unattributable — which is a smaller version of the same problem `userData.mod`
was invented to solve.

---

## Verification

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `scripts/jump-walk.mjs` | **all green** — lobby, the ramp, the half landing, mid-flight, upstairs; every apex in band, every spot lands on the floor it left |
| `probes/w101-flatdoor-plug.mjs` | identical numbers before and after the edit |
| `node scripts/health.mjs` | `WORLD OK`, exit 0 |
| `node scripts/bugsweep.mjs` | 96 shots, 0 STATION MISS, 0 COVERAGE |

**The change is documentary.** `git diff` on `apartment.ts` is 51 insertions and
1 deletion, and the single non-comment line is a trailing comment moved onto its
own line above the collider. Behaviour is bit-identical, which the probe's
matching numbers demonstrate rather than assert.

## ⚠ My own probe lied first

The first cut held **`d`** — strafe — and reported all eight runs stopping at
exactly the x they were warped to, **1.600, with and without the plug**. Two
identical columns look like a clean answer ("the plug does nothing") and were in
fact the player never moving. Yaw π/2 already faces +x, so **forward is east**
and the strafe was pushing him along −z, which the probe was not recording. It
now records z as well, and it prints **"this measured NOTHING"** rather than a
verdict when the player has not moved.

That is the second time in this item that two matching columns nearly passed for
proof, and it is why the real result above is stated with the wall's own
arithmetic (2.40 − 0.36 = 2.04) rather than just as a pair of numbers.

---

## FOUND AND NOT FIXED

1. **The walk-up publishes no `userData.mod`.** 281 textured faces land in
   `texdensity`'s `?` bucket, along with everything else anonymous in the world
   (19 gross faces between them, none of which is the walk-up's). One line on
   the building's group would split the largest unattributable owner in the
   report. Not this item's file to change and cheap for whoever does.
2. **`masonry.mjs` still cannot see any interior surface.** Item 107 fixed its
   visibility skip; the point stands that it only judges faces carrying
   `userData.masonry`, and none of the walk-up's do.
3. **The six unmodelled flats stay unmodelled** — the user has not asked for
   them and a shut door that stays shut is the correct answer, as the row says.
