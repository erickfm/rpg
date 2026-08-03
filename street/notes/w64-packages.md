# w64 — the packages were built. He still could not see one.

Item 178. Ports: **4201** (dev), **4202** (built preview).

> *"i havent seen a single package outside my neighbors doors?"*

## The row's diagnosis is stale, and the real cause is a unit nobody converted

The row says, in bold: *"HE IS RIGHT AND THE ANSWER IS THAT NONE IS EVER PLACED
… grepping all of `src/` finds ZERO importers of either. Do not re-investigate."*

**That was true when the row was written and it is not true now.** The whole
feature landed in mainline while this row sat open — `ct/apartment.ts:2172+`,
`PACKAGES ON THE LANDINGS`: parcel meshes, a per-door-per-day hash, side-of-door
placement, floor-gated colliders, two `[E]` spots per door, `giveRandom()` wired
to the pockets, and a published `scene.userData.packages` test hook. There is
even a registered check, `scripts/packages.mjs`, and it is green on ten claims.

So I did not build the missing half. I measured why he cannot see the half that
exists, and **the answer is `crosstown.ts:423`: *"one real second = one game
minute"*.** A game DAY is 24 real minutes. `PKG_CHANCE` was declared as a small
chance *per day*, which sounds like a chance per day and is a chance per 24
minutes of play.

**Measured over 120 days at 0.08**, sampling the world's own hash through
`packages.list()` rather than re-deriving it
(`scripts/probes/w64-pkg-landing3.mjs`):

| | at 0.08 | at 0.20 |
|---|---|---|
| parcels building-wide, 120 days | 76 | 208 |
| days with any parcel anywhere | 50% | 81% |
| parcels on HIS landing (301/302) | 19 | 52 |
| days with any parcel on his landing | **14%** | **38%** |
| longest run with nothing outside 301 or 302 | **19 days = 7.6 real hours** | 10 days = 4.0 real hours |
| average doors carrying one, of 8 | 0.63 | 1.73 |

**Nineteen game days is seven and a half hours of play with no package where he
lives.** That is not a rare event, it is an invisible feature, and his sentence
is the correct report of it.

## What I changed: one constant

`ct/apartment.ts` `PKG_CHANCE` 0.08 → 0.20, with both of his statements in hand
— he asked for *"a small chance"* and he is telling me he has never seen one —
and against the failure the row names in the other direction, *"a landing with a
parcel at every door reads as a depot."* At 0.20 the building averages 1.73 of
its 8 doors, so most doors are still empty on most days.

Nothing else moved. The placement rule, the overnight wipe, the theft, the roll
table and the collider are all as they landed.

## And I walked his own landing, which nothing had

`scripts/packages.mjs` is a good check and it proves the arithmetic and the
GROUND floor. His sentence is about floor 3, where 301 is his flat and 302 is
the neighbour he actually sees, and nothing had stood there.

`scripts/probes/w64-pkg-landing3.mjs` does, on the built bundle:

| | |
|---|---|
| both floor-3 doors carry a parcel with the roll forced | ok — 301 at (200.26, −15.69) side +1, 302 at (202.15, −17.32) side −1 |
| the landing offers it | ok — `[E] steal 302's package` |
| `[E]` takes it off the landing | ok |
| and the HUD says what was in it | ok — *"pair of trainers — two sizes too big, and white."*, and on a second run *"pack of tube socks"* |
| the landing still walks afterwards | ok — 0.86 m backwards, so the parcel's collider does not trap you |
| page errors | 0 |

Frames: `/tmp/w64-pkg/landing3.png`, `landing3-after.png`.

## How it was proved

Built bundle (`vite preview`, 4202).

| | |
|---|---|
| `scripts/packages.mjs` | all ten green at the new rate — *"89 parcels over 40 days — 35 days had any at all, most ever on one day was 5"*. Its rarity clause is `withAny < 40`, and 35 of 40 keeps a 5-day margin |
| `scripts/probes/w64-pkg-landing3.mjs` | 6/6, floor 3 walked |
| `node scripts/bugsweep.mjs` | 0 STATION MISS, 0 COVERAGE |
| `node scripts/health.mjs` | WORLD OK, exit 0 |
| `npm test` | 17/17 · `npx tsc --noEmit` clean |
| `scripts/w5-shadow-census.mjs` | still 62/62, 145/146 (my own item-186 ratchet, unmoved) |

`fp` is not cited: nothing here adds or moves geometry at build time — the eight
parcel meshes already existed and only their visibility odds changed — but the
`PKG_CHANCE` edit changes no texture either, so the honest statement is simply
that the diff is one number and two probe files.

## Found and NOT fixed

1. **0.20 is a judgement and it is one constant.** If he says it is now too
   busy, `PKG_CHANCE` at `ct/apartment.ts` is the single knob and the table
   above is the arithmetic for picking another value. The desk should probably
   show him the frame rather than the number.
2. **The long tail is inherent to an independent daily roll.** Even at 0.20 the
   longest measured gap outside his own two doors is 10 days — 4 real hours.
   If that is still too long the fix is not a bigger number but a different
   mechanism (a pity timer: guarantee one on his landing if none has appeared
   for N days). That would be a design change and he has not asked for it.
3. **`scripts/packages.mjs` never walks above the ground floor.** It picks the
   first present parcel, which is deterministically 102's. My probe covers
   floor 3; a merged version of the two would be better than two scripts.
