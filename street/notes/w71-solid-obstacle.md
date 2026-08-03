# Item 198 — `ct/street.ts`'s `solid` IS `obstacle` now

Worker **seventyone**, 2026-08-02. `src/proto/ct/street.ts` and
`src/proto/crosstown.ts`. Verified on the **built bundle**, port 4270.

> The user: *"pedestrians sometimes clip into the fruit in the sidewalk outside
> the bodega."*

---

## The root cause, in one line

`obstacle` was declared **below** the `buildStreet` call in `crosstown.ts`, and
the street is the **first** thing built — so the only registration hook the
street could be handed was one that pushed to a list of its own, and
`ct/park.ts:91` and `ct/street.ts:242` became the same function, under the same
name, with different behaviour. Everything else follows from that ordering
accident.

## …and "sometimes" is explained by the code, not by luck

The crates sit at z −96.69…−96.13. The crowd's north side-street walk line is
`SIDE_Z0 + IN` = **−97**, and a citizen's footprint is ±0.28 (`crowd.ts:285`) —
so **on the line they clear the crates by 0.03 m**. But every walker carries a
lateral `bias` of up to `STRAY` = `min(IN, FACE − (ROAD_HALF + IN)) − 0.45` =
**0.55 m**, and a walker biased toward the shopfront goes straight through them.
That is the whole of "sometimes": it is whether this trip's random bias points at
the shop or the kerb. Nothing about the approach angle, and no partial case.

---

## ⚠ THE ROW'S SIZING IS WRONG, AND IT IS WRONG IN THE SAFE DIRECTION

The row is built on one number — *"the BOXES are 359 of 508 — 71% of all static
player geometry is invisible to pedestrians"* — and on sixtyeight's warning that
handing the crowd 359 obstacles at once *"is a steering change, not just
plumbing, and may surface 173 rather than resolve it."* **The 359 is real. The
attribution is not.** Measured on the built bundle, before and after:

| | before | after |
|---|---|---|
| static colliders the PLAYER is stopped by | 508 | **508** |
| static boxes the CROWD steers around | 136 | **175** |
| in the player's list, not the crowd's | 359 | **320** |
| …of those, on the bodega's stretch | 6 | **0** |

**This one line accounts for 39 of the 359, not 359.** And of the 320 left,
`scripts/probes/w71-where-are-the-320.mjs` puts **309 of them outside the ground
the crowd has ever walked** — the interior belt, x running out to 1326 — against
the crowd's own measured roam box (x −6.5…55.6, z −108.6…1.1, from a 300 s run).
**Only 11 are on walkable ground at all**, and all 11 sit behind the building
line where the 0.55 m stray cannot reach them.

**So the crowd-relevant gap was ~50 boxes, not 359** — the row overstates the
thing it is afraid of by about sevenfold. "71% of static geometry is invisible to
pedestrians" is true and materially misleading: most of that geometry is indoors,
where no pedestrian has ever been. **The big-bang steering risk the row is
structured around did not exist**, which is why I did not stage the adoption: I
measured the population first, found it was 39 boxes confined to the street's own
frontages, took them in one go, and then measured the crowd for 780 s across
three runs. Staging 39 boxes would have been ceremony, not caution.

---

## The change

**`crosstown.ts`** — three plain `const` declarations (`propColliders`,
`citAvoid`, `obstacle`) hoisted above the `buildStreet` call, and `obstacle`
passed in. Nothing between the old and new positions reads them.

**`ct/street.ts`** — `const solid = (b: AABB) => obstacle(b);`

**It is now ONE function, not two that agree**, and that was deliberate. The
defect is *two functions with one name and different behaviour*; making them
merely equal leaves the trap armed for whoever writes the third. There is no
second list here to drift, so a future building in this file **physically cannot**
register a collider the crowd cannot see — which is the item's own stretch goal.

Consequently `street.ts` no longer returns `colliders` and `crosstown.ts` no
longer spreads it. Those boxes have not stopped arriving — they come in through
`...propColliders`, the same route `ct/park.ts` and `ct/jail.ts` have always
used. **Spreading both would have listed 39 boxes twice.** I deleted the array
rather than leaving it unread on purpose: an unread `colliders` list is a trap
for whoever next writes `colliders.push(b)` here and wonders why the crowd
ignores their building.

---

## Proof

### The player's collision did not move — as a SET, not as a count

`scripts/probes/w71-dump-static.mjs`, dumped from the built bundle before and
after and compared as a **multiset**:

```
PLAYER static colliders  before 508  after 508
  as a multiset: lost 0   gained 0
CROWD citAvoid statics   before 136  after 175   added 39, removed 0
```

508 = 508 would have survived losing one box and duplicating another, which is
exactly what a reroute could do; the multiset would not.

### The crowd — 300 s, sampled PER FRAME

`scripts/probes/w71-crowd-health.mjs`. The crowd publishes no citizens, so it
tracks the 0.5 × 0.5 boxes in `actorColliders()` — those boxes *are* the walkers
(`crowd.ts:270`). Sampling is **in the page, per frame**: a 0.62 m crate at
1.5 m/s is occupied for under half a second, and a 5 Hz poll from node would miss
most of it (GOTCHAS 30, same argument).

| | BEFORE | AFTER | AFTER run 2 |
|---|---|---|---|
| frames inside geometry the crowd is BLIND to | **2187** | **0** | **0** |
| frames inside the produce crates | **1007** | **0** | **0** |
| frames inside geometry the crowd KNOWS about | 0 | 0 | 0 |
| total crowd path | 1672.8 m | 1652.7 m | 1686.4 m |
| worst stall by any citizen | 17.78 s | **11.93 s** | **11.82 s** |
| roam | x −6.5…55.6 · z −108.6…1.1 | x −6.5…56.0 · z −109.5…1.0 | same |

Before the fix the clip bins name the user's own spot: **344 frames at (12, −96)
and 46 at (10, −96)** — the crates. **No new pinning**: the crowd covers the same
ground at the same rate (−1.2%, inside run-to-run spread), and the worst stall
went *down*. Nothing landed in the "crowd knows about it and walks through it
anyway" column, which is where a steering-strength regression would have shown.

**Both halves had to move together and that is why both are measured.** A crowd
that never moves clips nothing; a crowd that ignores every obstacle is never
pinned. Either number alone is trivially satisfiable.

### The check can fail, and the zero is not vacuous

Two assertions were added and **mutation-checked**: reverted to `54049141c`,
rebuilt, re-ran → **2 FAIL, exit 1, 758 frames inside the fruit.**

The load-bearing one is deterministic (the crates must be *in* `citAvoid`), so a
revert reddens it without anybody having to walk anywhere. The sim-dependent one
is guarded by a floor on **the closest approach any citizen made to a crate —
0.57 m on the fixed world**. That floor matters: a **60 s** run on the *broken*
world also scores 0 fruit frames, purely because nobody went down that street.
Without the floor this check would have certified the bug.

### Walked, not deduced

- `D-walk.mjs` — every collision assertion passes: east shops stop at 6.49, west
  at −6.48, side street N/S at −96.51/−109.51, the bodega's canted corner still
  stops **on** the cut at x+z = −87.51, the library courtyard and churchyard
  still open and close. (1 inherited red, below.)
- `crowd-walk.mjs` — all pass. Longest stall 0.0 s, 0 of 495 samples sealed the
  walk, tightest gap past a stopped citizen **1.92 m** against a 0.72 m player.
- `side-walk.mjs` — north and south walks run 36.8 m / 38.2 m east past every
  tree with 0.0 s stalls; the bodega door is reachable from 5 of 8 headings.
  (1 inherited red, below.)
- `E-park-walk.mjs` — **all pass**, 71 park colliders checked, none on the
  pavement. The park was the other side of the item's "walk it for new pinning".
- `npm run sweep` — 96 shots, **0 STATION MISS, 0 COVERAGE**, 0 console errors.
- `node scripts/health.mjs` — `WORLD OK`, exit 0. `npx tsc --noEmit` clean.
- Looked at `shots/bug-corner-bodega.png` on build `4f166b1ae`: shopfronts, kerb,
  crossing and parked cars all render normally. My change adds no geometry, so
  `fp`/`fpdiff` was valid here and unnecessary — the multiset dump is stronger.

---

## Inherited reds — both confirmed pre-existing on `54049141c`

Triaged by checking mainline's `crosstown.ts`/`street.ts` back out, rebuilding
and re-running. Neither is mine:

1. **`D-walk.mjs`** — *"and pressing E opens the machine: 3 full-screen panels →
   3"*. Fails identically on mainline. Note it already counts 3 panels open
   *before* pressing E, which smells like the instrument, not the ATM.
2. **`side-walk.mjs`** — *"3 parked cars, all on the road at y=0 (0 found at
   y=)"*. Fails identically on mainline — **and `shots/bug-corner-bodega.png`
   plainly shows parked cars on the road**, so this is a broken census, not a
   missing world. The check reports 0 subjects and goes red, which is at least
   the safe direction (cf. GOTCHAS 79, where `masonry.mjs` reported green over
   zero faces).

---

## Found and NOT fixed

1. **⚠ FOR ITEM 173 — five of the six car boxes never enter the world.**
   `scripts/probes/w71-are-cars-in-citavoid.mjs`, 45 s / 2703 frames: of the six
   `vehicleBox` registrations (`crosstown.ts:615`) that go into `citAvoid`,
   **only one ever has any extent** — the moving cruiser, 2.3 × 5 m, running the
   travel lane at x 1.5. **The other five sit at (999, 999) with zero area for
   the entire run.** The parked cars are visibly in the world. So the crowd is
   never told where a *parked* car is, and 173 is *"people still get stuck. they
   should back up and allow the car to pass"*. This is not a steering-strength
   question if the box is not there at all — worth settling before 173 is worked.
   Not mine; I did not touch it.

2. **The 320 remaining blind boxes are mostly not a bug.** 309 are off any ground
   a pedestrian reaches. The 11 that are on-street stand behind the building line
   (minX ≥ 7.0 east, maxX ≤ −7.0 west) where the 0.55 m stray cannot reach, and
   the crowd logged **0 frames** inside any of them across 780 s. If the desk
   wants them adopted anyway it is cheap, but it is tidiness, not a user-facing
   defect. **Do not queue "adopt the other 320" on the strength of the 71%
   figure** — that is the number this item disproved.

3. **`ct/park.ts:91` still has a dead local `colliders` list.** Its `solid` is
   `{ colliders.push(b); obstacle(b); return b; }` and the array is never read —
   `register()` discards `buildPark`'s return. Behaviourally identical to
   `obstacle`, so the two `solid`s now agree; but the same vestigial-second-list
   shape that caused this bug is still sitting in that file. Two lines to remove.
   **`ct/park.ts` is not named by item 198, so I left it and am reporting it**
   per BUILDER-BRIEF §9.

4. **`ct/civic.ts`'s 11 `solid()` call sites** — w63's note asked for them to be
   traced and I did not, beyond establishing that whatever they register lands in
   the 11 on-street leftovers at most. The measurement above bounds the damage;
   the trace itself is still owed.

5. **Nothing in `citAvoid` carries a name or tag** — sixtyeight's finding, still
   true. My probe finds the crates by nearest-centre to a quoted coordinate and
   **asserts the miss distance is under 0.25 m**, so a moved crate breaks the
   check rather than silently making it vacuous. That is a workaround for the
   missing tag, not a fix.

## Derived vs copied

`R = 0.28` (the footprint radius) and the `WAIT`/`PATIENCE` bounds used to read
the stall numbers are **cited from `ct/crowd.ts:285`, `:309`, `:409`**, not
retyped as constants. The two crate coordinates are copied from sixtyeight's
citAvoid dump and used only as a **lookup target**, never as truth — the probe
locates the boxes in the world's own collider list and fails if they are not
where it looked.
