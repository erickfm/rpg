# Handoff — builder H, `feat/traffic`

**Worktree:** `../rpg-traffic` · **port** 4187 · **base:** `c7135dd` (mainline)
**Owns:** `ct/crowd.ts` (new, this note), `ct/cars.ts` (per queue — see
*Ownership* below)

---

## Done — queue item 1: split the walking sim into `ct/crowd.ts`

**Commit:** `09b8323`

### What the queue asked for vs. what was actually there

The queue says to split the sim "out of `ct/citizens.ts`". It was not there.
`ct/citizens.ts` was **already** only the atlas — `citizenAtlas()` + `viewFor()`,
258 lines of painting, which is the half that is genuinely shared (three modules
paint people through it). The sim was inline in **`crosstown.ts`**: the `CAST`
list and build loop at lines 213–280, and the per-frame walking pass at 484–539.

So the split is `crosstown.ts` → `ct/crowd.ts`, and `ct/citizens.ts` is
**untouched**. The outcome the queue wanted holds either way: the atlas stays
desk-owned and shared, the sim is mine.

`crosstown.ts` 606 → 490 lines.

### What moved

Verbatim, comments and all — the cast list, `strideFor`, the `Citizen` record,
the build loop, `clearAt`, and the whole steering / ghosting pass.

Two invariants had to survive the move, and did:

- **The build call sits at the same point in the sequence.** The atlases paint
  through `pixTex`, off the shared `Math.random` stream. `buildCrowd()` is
  called exactly where the inline `CAST.forEach` was — between the traffic pool
  and the `colliders` array. Move it and every texture painted after it
  re-grains (`GOTCHAS.md` §1). There is a comment at the call site saying so.
- **Run order is unchanged.** The sim registers itself with
  `ctx.onFrame(fn, ORDER.LATE)` rather than being called from `update()`. LATE
  is the last hook order, so it still runs after the props pass, and it still
  reads the cruiser's box from the *end of the previous frame* — same as the
  inline loop, which ran before the traffic pass wrote it.

### Two seams worth knowing about

`buildCrowd(ctx, opts)` takes its own options object instead of widening
`CtxBuild`. `ct/ctx.ts` is desk-owned, and the crowd needs three things that are
not on it: the live `citAvoid` list, a way to register a person's box as solid
to the *player only*, and `props.lit`. A local options object keeps ctx.ts out
of the diff entirely.

`citAvoid` is held as a **live array reference**, not copied. `crosstown.ts`
pushes the cruiser's box onto that list *after* the crowd is built, so a
snapshot would have made the moving car invisible to pedestrians. If anyone
changes the crowd to copy that list, cars stop being avoided and nothing will
fail loudly.

### Verification

**Pure refactor, structurally (`GOTCHAS.md` §1):**

```
npm run fp before / after
textures   282 vs 282 — IDENTICAL   (88364e99)
structure  591 vs 591 — IDENTICAL   (5d8fc4fa)
places     591 vs 591 — 7 differ
```

The 7 are the 6 walkers and one pigeon, all ~0.1 m. **Two runs of the same code
differ in those same 7** — I captured a third fingerprint to confirm it, so that
is the noise floor and not the change. (The `before`/`before2` pair happened to
agree on the walkers exactly, which is luck of load timing, not determinism —
don't read that as a tighter floor than it is.)

**And by walking, not looking** — `scripts/crowd-walk.mjs` (new, mine), drives
the player at a citizen and samples the encounter:

```
OK  six people in the scene
OK  they are walking — 6/6 moved >0.2 m in 1.5 s
OK  all feet planted on the kerb at y=0.14
OK  they walked up to you — closest approach 0.06 m
OK  halted a step short instead of walking through — 1.4 s at 0.8–1.25 m
OK  gave up and squeezed past — never trapped you
OK  west walk still passable — 14.4 m south in 6 s (people, trees and all)
```

The halt plateau measuring 1.4 s is the `stuck > 1.4` timer, observed rather
than asserted from the source. `scripts/people.mjs probe` also passes unchanged
(6 distinct sheets, 6 distinct silhouettes, feet at y=0.140), `npm run build` is
clean, and `npm run sweep` reports no new console errors — only the pre-existing
`THREE.Clock` deprecation and GL readback warnings.

**One thing found while probing, worth writing down** (not a bug, cost me a
detour): the citizens' outer home lanes are `|x| = 6.22` and `6.39`, which is
0.31 m off the facade at `FACE = 7.0`. Fine for a 0.25 m-half body, but the
0.36 m player capsule warped there is *jammed inside the wall collider*
(`maxX = -FACE + 0.3 = -6.70`) and cannot move at all. So **a probe cannot warp
the player into an arbitrary citizen's lane** — only the innermost, `|x| = 6.05`.
The 2 m walkable lane itself is unaffected and still clear.

---

## Done — queue item 2: cars turn the corner

**Commit:** `dc5b062` (rebased by the merge train mid-session, see below)
**New file:** `ct/traffic.ts` · **also touched:** `ct/cars.ts`, `ct/crowd.ts`,
`crosstown.ts` (wiring)

### What was wrong

Traffic ran one axis. A vehicle was a `z` coordinate and a direction, and it
vanished at `z = -L + 6 = -90` — **eight metres short of the junction at
z = -98**. The corner the user has twice called the best thing on the block was
literally where the world stopped.

### The junction, and why none of it is tuned

A vehicle now follows a **route**: a chain of straights and circular arcs.
Position, heading, lean and steer all come off one path parameter `s`, which is
why nothing snaps — nothing is set directly any more.

The main street dead-ends into the side street, so it is a **T** with exactly
two movements. Both arcs are **concentric about the kerb corner**
`J = (ROAD_HALF, SIDE_Z0)`, because a 90° arc joining two perpendicular lane
centre lines has exactly one radius. For a vehicle in the lane `d` off the
centre line:

| movement | radius | ends on |
|---|---|---|
| tight — south → east | `ROAD_HALF - d` = 3.5 | `z = SIDE_Z0 - r` = −101.5 |
| wide — west → north | `ROAD_HALF + d` = 6.5 | `x = -d` = −1.5 |

Every arc end lands exactly on the far road's own lane centre. Nothing is
eyeballed, and the bus's narrower 1.35 lane gets its own correct pair for free.
Traffic keeps **right** (southbound sits at +x, which is a driver's right when
heading −z), so the tight arc is the right turn and the wide one crosses the
oncoming lane, as at any real intersection.

**The consequence worth having: the two routes never intersect.** Concentric
arcs of different radii cannot cross, and the four straights sit on four
different lane lines. So the queue's "two cars arriving at the junction
together" hazard is answered by the *geometry* — there is no reservation, no
priority rule, and no deadlock to get wrong. Measured, not asserted: run both
movements at once and they pass **3.00 m** apart, which is the 2 × laneX the
arcs predict, neither dropping below 3.27 m/s.

### The rest of it

- **Slows into the turn** off the cornering limit (`A_LAT` 3 m/s²), so it
  arrives already braking — 3.66 m/s through the arc against 8.50 on the
  straight.
- **Wheels and body agree.** Front wheels steer to `tan δ = wheelbase / r`
  (the tight arc asks 39.6°, so it sits at the 35° lock) and the body leans
  *away* from the turn. `ct/cars.ts` now exposes `userData.steer` and
  `wheelbase`; the wheels use rotation order **YZX** so the steer angle turns
  them about their own vertical instead of the tilted axle. At steer 0 that is
  the same matrix as the `rotation.z` it replaces — no structural change, which
  the fingerprint confirms.
- **Gives way to anybody in the road ahead** — the queue's "turning through the
  crossing while a pedestrian is on it". This reads the crowd's live positions
  (`crowd.walkers()`, added for it) *and* the player.
- **Dead ends U-turn** through one tight arc when the player is close enough to
  watch, instead of the old code's teleport 3 m sideways plus an instant 180°
  flip. The bus is never asked to — a 30-footer needs four times the room.
- **Vehicle colliders are the body's box as an AABB**, so a car *across* the
  junction is 5 m wide in x rather than in z. One box per vehicle in the pool.

### Two things I got wrong first, since the numbers are the lesson

**Proportional braking is not enough to avoid running people over.** Braking in
proportion to the room left reads fine, but the eased speed *lags* the target
by about 5 m at 8.5 m/s — the first cut drove to **0.12 m** from somebody
standing on the crossing. It now follows the kinematic curve `sqrt(2·a·room)`
and **clamps the speed itself**, not just the target. Comfort caps (the corner)
may be eased through; a person in the road may not be. It now comes to rest
**2.94 m** short.

**A proximity test cannot tell "in my way" from "on the other arc."** The
rear-end check used a radius around the other vehicle's centre — but a 5 m car's
bounding circle is 3.7 m and the two arcs pass 3.0 m apart, so each car saw the
other as an obstruction and both stopped dead *at the junction the geometry had
just proved was safe*. Following distance is now measured in **route space**:
only a vehicle on my own route can be in front of me. There is a comment on the
one manoeuvre that crosses the other route (the dead-end U-turn) — it cannot
collide while `maxActive` is 1, and **raising that needs a cross-route check**.

### Deliberately unchanged

One vehicle on the block at a time (an earlier deliberate decision — it is one
number, `maxActive`), the 11% / 15% bus and taxi rarity, and the parked cars,
which are built in `crosstown.ts` off the seeded stream and are not traffic.

### Verification

**The art and the structure of the world are untouched.** Fingerprinted against
my base commit: `textures IDENTICAL`, `structure IDENTICAL` (723 objects), only
the 6 walkers and a pigeon in `places` — the same noise floor as the crowd
split. That is the check that proves the car textures were not re-grained (the
`buildTraffic()` call sits at the same point in the build sequence for exactly
that reason) and that the wheel rotation-order change added no meshes.

**The bus contract is intact** — `scripts/bus.mjs stop`: front door at rest at
`z=-33.52` against a flag at `-33.50`, pulled in to `x=3.54`, dwelt, pulled
away.

**Driven, not looked at** — `scripts/corner-traffic.mjs`, 22 checks, all pass:

```
entered heading S, left heading E
settled in the eastbound lane — z=-101.50 (want -101.50)
path is continuous — biggest step 0.53 m
heading never snaps — biggest turn 3.5° in one frame
slowed into the turn — 3.65 m/s in the arc vs 8.50 on the straight
leans away from the turn, not into it (steer -35.0°, roll 3.4°)
two vehicles ran together — never closer than 3.00 m, slowest 3.27 m/s
stopped for the person on the crossing, closest 2.93 m
the three parked cars never moved
```

`scripts/corner-traffic.mjs shots` writes `shots/ct-*.png` for looking at.
`npm run sweep` is clean of new console errors, and the crowd probe still
passes unchanged.

**A note on the rebase.** The merge train rebased this branch onto new mainline
*while I was running checks*, resolving a conflict in `crosstown.ts` — which is
what a transient `<<<<<<< HEAD` in the vite log and two failed sweeps were. The
tree came out clean; I re-ran the fingerprint against the **new** base and the
full probe afterwards rather than assuming, and both are above.

---

## For the desk

1. **`crosstown.ts` is in my diff and `ownership.sh H` flags it** — for both
   items now. Unavoidable: the crowd sim and the traffic sim both lived there,
   and moving code out of a file means touching it. Scope kept to the minimum
   each time — delete the sim, add one `build*()` call, repoint the `__ct`
   affordances. **No shared signature or behaviour changed**; `ct/ctx.ts` and
   `ct/citizens.ts` are untouched, and both new modules take their own options
   object rather than widening `CtxBuild`.
2. **`OWNERSHIP.md` is out of date for me.** No entry for `ct/crowd.ts` or
   `ct/traffic.ts`, and `ct/cars.ts` still reads `= B` though my queue transfers
   it to H. Your file, not mine.
3. **Traffic density is a knob, not a decision I made.** `maxActive = 1` keeps
   the world exactly as it was, but the junction is now safe for two. If the
   user wants a busier street it is one number — with the U-turn caveat above.

## Next up (queue items 3–4, not started)

Extend the detail down the side street → pedestrians get more complicated
paths.

For the path-graph item, note that the crowd is currently a **1-D ping-pong**:
each person owns a `home` lane on the x axis and walks `dir` along z between
`-L + 4` and `10`. Turning the corner means that `home`-lane-plus-z model has to
become a graph position, and `clearAt` is the only part of the steering that
generalises unchanged.
