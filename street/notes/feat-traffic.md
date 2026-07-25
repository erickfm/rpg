# Handoff — builder H, `feat/traffic`

**Worktree:** `../rpg-traffic` · **port** 4187 · **base:** `c7135dd` (mainline)
**Owns:** `ct/crowd.ts`, `ct/cars.ts`, `ct/citizens.ts`, `ct/traffic.ts`,
`ct/crowd-net.ts`, `ct/sidestreet.ts`, `ct/gap.ts` (per queue — see *Ownership*
below)

## Everything I have written down, in one place

Five documents, and until now three of them were reachable only from a
paragraph in the middle of this file — which is the same "nobody could find it"
fault this project keeps hitting with tools, applied to prose.

| | |
|---|---|
| `notes/BLOCKED-H.md` | **Start here if you are the desk.** Three rulings I cannot take myself, each with the arithmetic, plus four gaps in tools that are not mine |
| `notes/CITIZEN-STYLE.md` | If you need a person, CALL THE ATLAS. The `Look` table, the contact sheet, and the traps |
| `notes/H-carstate.md` | The car variants for C's lot: hood up, on a jack, up on blocks — API, and the fingerprint warning that comes with using them |
| `notes/H-parking-verdict.md` | Audit finding D ruled on: parking not re-rolling is the FEATURE, and what breaks if you change it |
| `notes/H-atlas-facing.md` | How to read a citizen's AUTHORED facing from outside — the column/mirror table, and why the bodega keeper is not an anomaly |
| `notes/H-settle-reply.md` | My answers to A's settle-ramp list and C's movement-key list, both corrected after the ramp was retracted |
| this file | what landed, the three probe patterns, and the sixteen probes |

---

## Done — queue item 1: split the walking sim into `ct/crowd.ts`

**Commit:** `38cf9e640`

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
textures   282 vs 282 — IDENTICAL   (hash 88364e99)   <- fingerprint values,
structure  591 vs 591 — IDENTICAL   (hash 5d8fc4fa)      NOT commit sha1s
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

## Done — the truck: tailgate, bed, and off the alley mouth

**Commit:** `9b2e89507` · three queued items, one vehicle, one pass. Full reasoning
is in the commit message; the short version:

- **"Janky textures on the back"** was **GOTCHAS §6, not §4.** The tailgate's
  outer face sat at exactly `z = half`, which is the body slab's rear plane —
  1.70 m × 0.22 m of coplanar overlap fighting for the depth buffer. That is
  also why **the tail lights read asymmetric**: they are symmetric in the
  texture (texels 3…12 and 36…45 of 48) and always were, but a z-fight resolves
  in patches, so one showed as a wide bar and the other as a short one. No UV
  fault, no texture fault. §4 hygiene was applied as well — the bed faces lost
  their dither and took `NearestFilter`, and I audited the rest of the fleet:
  every remaining dither sits on a face 0.5 m or taller. Two faces thinner than
  0.3 m carry no dither but do carry lettering (the bus's 0.26 m roller sign,
  the taxi's 0.18 m roof sign) and now use `NearestFilter` too.
- **The bed** was asked about twice, and the reason the first pass did not land
  is structural: the slab ran solid the whole length at y 0.34…0.84 and the
  tub's floor was **inside** it, so what you saw as the bed floor was the slab's
  body-coloured top face, 0.13 m below the rail. Moving `FLOOR_Y` from 0.77 to
  0.62 moved a surface nobody could see. The slab now stops behind the cab and
  the bed is a real box: floor top 0.50 → **0.470 m inside**, liner **near-black**
  (#16171a where it used to be the body colour × 0.6 — the same green to the
  eye), coarse front-to-back ribs, no dither.
- **The alley:** the truck's tail reached z = −36.8 against a mouth at −37.
  Per the queue I moved the **constraint**, not the car: the nominal spot is
  derived so the whole body, the full ±1.2 m draw spread and a 2.5 m sight line
  are all clear. Worst case is now **2.50 m** and the draw keeps its spread.

**Verified:** the other three car kinds and the bus are untouched — checked by
diffing every vehicle's geometry against the base, where the only 24 changed
lines are the two pickups. That check exists because the fingerprint **cannot**
answer it here: rebuilding the pickup changes how many objects it creates, and
three.js burns four `Math.random` calls per object in `generateUUID`, so 125
textures re-grain under the seeded harness. Grain, not geometry.
`scripts/truck.mjs [shots|fleet]` regenerates the stills.

## Done — profile feet (third attempt)

**Commit:** `053627b04` · `ct/citizens.ts` came to me with this item.

Two separate faults. **A standing citizen had one leg** — both legs were drawn
at `cx-2±stride`, the same x when stride is 0, and the back one was a 35%-alpha
overlay that `alphaTest: 0.5` discards wherever it is not on top of the front
leg, so offsetting it alone would have drawn nothing. **The shoe had no toe** —
it spanned `cx-5…cx+6` around a leg at `cx-2…cx+2`, i.e. symmetric about the
ankle, and a foot symmetric about the ankle cannot say which way it points. The
eye resolves that as *backwards*, which is the user's word.

The toe points **left** because that is where the view faces — the nose at
`cx-7`, the brim at `cx-9` whose comment already read "brim points forward".
Ankles are separated by `stride`, one texel less than the legs, so at rest they
collapse to one shoe of the right length while the legs still read as two.

**The old floating-shoes fix is not just kept but made unnecessary:** its cap
existed because the shoes were flung 12 texels apart *while both legs were drawn
at the same x*. With the legs splaying properly each shoe sits under its own leg
at every stride 2–5, so there is nothing to float beside.

**Checked at all eight angles, standing and walking**, because the last two
attempts were judged on one: `scripts/feet.mjs` renders the 8 facing sectors
(not the 5 painted columns) with `viewFor`'s mirroring applied, and measures the
shoe off the painted pixels. `scripts/feet-check.mjs` answers what a screenshot
cannot — whether the painted toe points the way the person actually *walks*,
which is the product of the painted facing, `viewFor`'s column+mirror, and the
billboard's yaw. 22 profile cases, both columns, all forward.

## Done — pedestrians route over a walkable graph

**Commit:** `7c93e47ad` · **new:** `ct/crowd-net.ts`

The sidewalk is one continuous ring around the roadway, so the graph is that
ring, with every node derived from the constants the ground is built from. Plus
exactly **two crossings, both at the junction**, because that is the only place
the kerb has a ramp. Pedestrians never leave the graph, so "cross only at the
crossing" is structural: 330 person-samples in the roadway over 100 s, every one
on a crossing.

Nodes carry a reason to stop — window, doorway, the 42's bench, a kerb to pause
on. Trips are mostly local and mostly toward one of those, and some end in a
double-back, which a shortest path never produces on its own.

Two things I got wrong first:

- **Stops were too rare (5%)** because waiting only happened at destinations,
  and a long trip takes the best part of a minute. People pause **en route**
  now — 14% stopped, four distinct errands.
- **The lateral offset accumulated.** Nudging people sideways each frame to dodge
  props, with nothing pulling them back, walked them off the kerb into the road.
  Position is now kept *on* the edge plus a bounded offset, so straying off the
  walk is impossible by construction.

**Not walking through each other** was a non-negotiable the old sim did not even
attempt. Candidate positions are tested against every other body as well as
props, and if nothing is clear they stand. My first attempt paused 0.8 s then
went through anyway — which is walking through somebody politely, and showed up
as 0.25 m overlaps. Passing is a real lateral manoeuvre now, biased right so
head-on meetings resolve, with a re-plan after 2.5 s so nobody wedges.

**It also makes the corner work both ways.** `ct/traffic.ts` already braked for
anybody in the road, but nothing was ever in the road — the queue's "a car
turning through the crossing while a pedestrian is on it" was dormant code. It
is live now, which is why `scripts/corner-traffic.mjs` gained a
`clearJunction()` wait and why its two-car check asserts **separation** (8.4 m
against the 3.0 m the concentric arcs predict) rather than speed: speed can no
longer tell "yielded to the other car" from "yielded to a pedestrian".

Facing follows the actual direction of travel now — it was `atan2(0, dir)`, which
only knew ±z and was wrong the moment somebody turned the corner.

**The world did not move:** textures and structure **IDENTICAL** at 422 and 1097
against my base. The network builds no meshes and draws no `rnd()` at build time,
which GOTCHAS §2 requires or every tree height and parked car downstream shifts.

## Done — the second wave (faces, jitter, the frozen pair, the arch, the gap rule)

Full reasoning is in each commit; this is the index and the parts worth carrying
forward.

**A face read as three colours** (`649519892`). The head is 10 texels across and
carried 3 lightened + 4 true skin + 3 darkened. The file already had the rule and
had not applied it here — the torso's own comment says *"narrow 2 px rim lighting,
not wide bands"* on a body 14 wide, and the head is narrower and was getting 3.
Now 1 texel each side at a third of the alpha. `scripts/faces.mjs` measures the
cheek row on every skin tone, because these are alpha overlays and a band that is
subtle on a mid tone is not on a dark one.

**A pedestrian jittered** (`78a8b6a57`). Two roots, one shared: **per-frame
decisions with no memory.** The avoidance re-chose its passing side every frame
from an ordered list, and the sprite re-rounded its heading to one of 8 sectors
every frame. 67 travel reversals in 60 s became 1. Fixed by carrying state — a
committed offset and sector hysteresis. Note "lower id yields" **starved the
block** (id 0 gave way to all five others and completed no long trips); the
tie-break alternates by pair parity instead.

**Two citizens froze in the carriageway** (`d09751a37`). A *different* root, worth
keeping separate: the sim could refuse an illegal position but never resolve one.
Took ct/fp.ts's mechanism rather than inventing a second — minimum-translation
escape with the citizen's own 0.28 footprint, eased not snapped, and after 1.2 s
of getting nowhere, back to the last node it legally stood on.

**The wheel arch, three passes and a revert.** Worth reading in full if you touch
the fleet, because the ending is a proportion, not a drawing:

- attempt one stepped it and produced a black bar UNDER the tyre (its steps
  topped out at y=0.59; the tyre's top is 0.68) and buried the wheel by moving it
  inboard — the flank is opaque, so a tyre tucked inside it is simply not there
- reverted (`eeb554780`) on the user's own reasoning: a clipping wheel that reads as
  a wheel beats a modelled one that reads as a bar
- then the real term (`522e27d26`): the radius was a fixed **10 texels**, and a
  texel is not a length here — the canvas is 96 wide however long the body is, so
  the same line gave 0.94 m on a sedan and 0.63 m on the pickup, against a 0.68 m
  tyre. Stated in metres now and converted per axis.
- **the remaining limit is geometric:** the panel is 0.50 m tall and the tyre is
  0.68 m, so an arch clearing the tyre needs ~85% of the panel height. It cannot
  be drawn well until either the wheel shrinks or the beltline rises. See *For
  the desk* below.

**Cars stop their nose short, not their centre** (`1e0f6755a`). `blockedAt()`
reports distance along the path, and the path carries the vehicle's CENTRE — so a
car whose centre was 2.5 m away had its bumper in you. It settled into a 1.87 m/s
creep (= `sqrt(2·3.5·0.5)`, which is how it was found) and then ct/fp.ts's new
depenetration pushed the player three metres down the road and the path cleared.
**Two correct behaviours composing into a car that shoves pedestrians.** Fix is
one term: `room = block - halfLen - STOP_GAP`.

**The dangerous-gap rule** (`7148e296d`, `04f08feaa`). `ct/gap.ts` holds it once and
both parked draws use it. Three things learned: the trap MOVES with the draw (the
0.49 m slot I measured was gone a few commits later because new modules consume
`rnd()` first); the check has to run at the END of the build, because half the
things a car can trap you against are registered later and some never go through
`ctx.obstacle` at all; and **six of this world's colliders move — they are the
citizens**, so a pedestrian passing a parked car forms a transient corridor that
is not a defect. The probe samples twice and keeps only static boxes.

**People, for everyone else** (`157d8601a`, `dcc02711d`). `notes/CITIZEN-STYLE.md`
plus `citizenSprite(look, opts)` — a ready-to-add billboarding mesh with the
8-angle atlas, hysteresis and standing-vs-walking wired. Four cardboard people
came from one missing document; F, G and C can each swap a plane for one call, and
F's `room.person()` wraps this rather than competing with it.

## Done — the third wave (a person in one call, three cars, and a verdict)

- **`citizenSprite(look, opts?)`** (`dcc02711`) — the priority item, because
  three builders were each about to draw their own flat person. Returns
  `{ mesh, update, setFacing, setWalking }` with the 8-angle atlas, the
  billboard turn, the mirrored back half and the view hysteresis already wired.
  F wrapped it as `room.person()` at the kit level and G's four interiors now go
  through that, so the cardboard-people problem is closed at the source.
- **`notes/CITIZEN-STYLE.md`** (`157d8601`) — the missing page that caused four
  hand-drawn people. Leads with *if you need a person, CALL THE ATLAS*, and
  carries the contact sheet, every `Look` field, and the traps.
- **Three cars that are not just parked** (`e09bbf32`) — `hood`, `wheelsOff`,
  `jack`, `blocks` on `makeCar`, answering `BLOCKED-C` item 2. API and the
  warnings C needs are in `notes/H-carstate.md`.
- **Audit finding D ruled on** (`86c1c0d2`) — *"parking varies but never
  re-rolls"*: closed, because not re-rolling is the feature. Details and the
  measurement in `notes/H-parking-verdict.md`.
- **`corner-traffic` was measuring the machine** (`fcb00b46`) — three checks in
  it were timing thresholds wearing behaviour's clothes.
- **The arch's rows-per-metre literal** (`8d4d2939`) — `ARCH_H * 40` where the
  40 is `20 rows / 0.50 m panel`. Harmless today, a trap the moment anyone
  raises the beltline, which is the fix I recommend.

### The design rule the variants are built on

**With no `state`, `makeCar` builds exactly the meshes it always did, in the
same order.** three.js burns four `Math.random()` calls per object in
`generateUUID`, so one extra mesh re-grains every unseeded texture painted after
it and the world fingerprint moves. A lot full of jacked cars must not be able
to change the pigeons. Proven with a **control run**: textures and structure
identical, `tints`/`places` drifting 3 and 4 against unchanged code that drifts
3. Without the control, "4 differ" means nothing.

## A pattern in my own probes, named because it cost four fixes

`feet-check`, `side-walk` (twice) and `jitter` each **failed for lack of samples
rather than for a defect**. Same shape every time: a threshold written when the
world behaved differently, still passing until the world got BETTER. The jitter
probe wants two citizens in a tight lane, and they meet less often now precisely
because the graph works — they route the whole block and stop for errands instead
of ping-ponging one lane.

**Assert the invariant; report the sample count separately.** All four now
distinguish a real failure (exit 1) from an inconclusive run (exit 2), and wait
for coverage rather than judging on whatever one sweep found. A check that fails
half the time is a check people learn to skip, which is worse than not having it.

## A second pattern, and it is worse than the first one

The pattern above is about probes failing for lack of samples. This one is
about probes that **cannot fail at all**, which is the failure you never see.

Five separate instances, all mine, all found by deliberately breaking the world:

1. **A guard behind a crash is not a guard.** `cartex.mjs` printed a clean
   "no vehicle found" message that was unreachable — with nothing matched, the
   page-side loop hit `truck.children` and threw first, so it died on a raw
   Node trace. `citizen-sheet.mjs` was the same shape: its empty-sheet check
   tested the finished data URL, but a missing affordance means `img.src = ''`,
   whose `onload` never fires, so the evaluate hung instead.
2. **Colour is stored LINEAR.** `material.color.r` on a `#3a4a63` body reads
   0.067 — *darker* than the "this must be dark" threshold of 0.22 that
   `carstate.mjs` used to prove the engine bay is not body-coloured. It would
   have passed the exact bug it was written for. Read `getHexString()` for sRGB.
3. **Do not infer what you can ask for.** The same probe derived the body colour
   as "the commonest flat colour on the car" and got `#101114` — the tyre black
   off the four wheels. `makeCar` publishes `userData.body` now.
4. **A filter must not be the thing under test.** Gating corner-traffic's runs
   on "did it come out heading east" would make the check that it comes out
   heading east vacuous. `v.held` — the sim's own record of giving way — is
   independent, so `ct/traffic.ts` publishes it.
5. **`exit=$?` after a pipe reports `grep`'s status.** It made three separate
   failure-watches on this project look like passes. Redirect to a file and read
   node's own status.

**Never cite your own commit until it is on mainline.** `10006a2ab` measured the
project's dead-citation backlog as not shrinking, because it is a LEAK rather
than a backlog: a builder rebases on nearly every turn, each rebase rewrites
their commits, and any note pointing at a pre-rebase sha1 dies silently. 21 of
my 59 citations were dead this way before I repaired them, and repairing is not
the fix — the next note re-opens it.

The rule that closes it costs nothing: **cite hashes that are already merged.**
Other builders' landed commits are stable; your own un-merged ones are not. Mine
have stayed at 2 unreachable across every commit since the repair, and those two
are live-integrate build stamps, labelled as such. The check, worth re-running
after any run of note-writing:

```bash
for h in $(grep -ohE '\b[0-9a-f]{7,10}\b' notes/H-*.md notes/BLOCKED-H.md | sort -u); do
  git cat-file -e "$h^{commit}" 2>/dev/null || continue          # skip fingerprints
  git merge-base --is-ancestor "$h" add-stick-and-city98 || echo "dead: $h"
done
```

`git cat-file -e` alone is NOT that check — it passes for anything in your own
object store, including the commits your rebases orphaned, which is how I
published "every citation resolves" about notes that were broken for everyone
else. And verify any remap by `git patch-id`, not by subject: mine were 19 of 19
identical, but two commits can share a subject line.

**That verification cannot be repeated, and the date is the point.** It was run
while the orphaned commits still existed in this worktree's object store. Git
has since started warning that there are too many unreachable loose objects and
suggesting `git prune`; `0b1dd7bb9` puts it exactly — after a prune the mapping
TABLE survives and the ability to check it does not. So "19 of 19 identical by
patch-id" is a result with a shelf life: recorded here because it was true when
taken and nobody will be able to re-derive it. If you need to trust the remaps
and the objects are gone, the fallback is the subject lines plus the fact that
each landed twin is the same author's next commit of the same work.

**And both fp captures must come from the same KIND of server** (`GOTCHAS.md`
§31, `bff2f6a0`). A dev capture against a preview capture reports ~612 of 954
textures changed on a world nobody touched: `scenedump` seeds `Math.random` so
paint is reproducible, and dev burns 28 more draws at module-init than the
bundle does before the first canvas exists, so every texture after that gets a
different slice of the sequence.

Every fingerprint in this note is **dev to dev** — `SHOT_URL` was
`http://localhost:4187/` on both sides every time, and that port serves `/src/`
and `/@vite/client`, so it is a dev server. Checked rather than assumed, because
three commits here rest on a `textures IDENTICAL` line: the additive `CarState`
design, the `BELT` derivation, and the arch's rows-per-metre. A crossed capture
would have voided all three, and it would have failed LOUD (612 textures), not
quietly — which is the one merciful thing about it.

And one for the paint layer specifically: **PNG bytes cannot prove anything
about a car texture.** `bodySideTex` ends in `dither(...)`, unseeded
`Math.random()`, so two runs of identical code differ (GOTCHAS §1). I hashed
before and after, saw a difference, and nearly reported my own change as the
cause — the control run of unchanged code differed too. Use the structural
fingerprint.

## A third pattern: the stopwatch. Swept, and here is where it was

Found three times before I stopped waiting to be bitten and audited all sixteen.
**A distance covered in a fixed time is not a behaviour**, and every instance
failed on a sound world before it ever caught a defect:

| where | was | failed at | why it is not a clock |
|---|---|---|---|
| `corner-traffic` continuity | `maxStep < 0.75` m | 0.75 m under load | 0.15 s at 8.5 m/s is 1.28 m of legal travel |
| `corner-traffic` "carried on east" | `finalX > 20`, then `> 12` | 11.6 m | how far it gets depends how long it yielded |
| `corner-traffic` window | fixed 22 s | 245 frames not 417 | starved frames advance sim time at half rate |
| `crowd-walk` west lane | `> 14`, then `> 9` m in 6 s | 8.6 m | two clean runs cover 20.8 and 15.2 m |
| `side-walk` × 4 hikes | `> 26` m in 11 s | two of four | six samples span 28.4–36.4 m |

The replacement is the same each time: **sample while the input is held and
assert the longest STALL.** Being held for a beat is the give-way working;
being held for four seconds is the lane blocked — and that is true whatever the
total distance. Keep a distance floor if you like, but set it to separate
"moving" from "went nowhere" (12 m, not 26), not to encode a typical run.

**Where it does NOT apply, checked rather than assumed:**

- `crowd-net`'s `maxTravel.every(d => d > 8)` is the same shape but observed
  minimum is 31.8 m — four times the line — and it is backed by
  `stillWorst < 30`, which is the stall version of the same question. Left.
- `jitter` counts defects, not distance: 0 reversals over three runs against
  thresholds of 12 and 2. Left.
- `feet-check`, `faces`, `gaps`, `park-repro`, `carstate`, `cartex`, `kerb`,
  `truck`, `citizen-sheet`, `side-night` have no time term at all.

One result from the sweep is worth keeping on its own: **the crowd never seals a
lane; a car does.** I could not make `crowd-walk`'s stall check fire with
citizens alone — not with 40–60 s errand dwells, not with the give-way disabled,
not with a 1.30 m body radius — but parking a car across the north walk gives a
7.5 s stall immediately. That is why the citizen guard measures the GAP beside a
stopped body and the hike guard measures the player's progress.

## Checked against D's glowing-graffiti signature (`4955621e`, `e91df374`)

`props.ts` grades the world down after dark and skips anything its `isGlass`
test catches — `m.transparent && !(m.alphaTest > 0)`. A transparent decal with
no alphaTest is glass by that test, is never offered to the dimmer, and glows at
midnight. D found three in the alley and then 158 more across the world:
**vice 78, props 67, lot 13, street 0.**

**Those counts are grouped by `userData.mod`, and none of my modules stamp one**
— so my area is not in that sweep at all, in either column. Measured separately,
at 23:00, and this is the only record of it:

| | |
|---|---|
| vehicle materials matching the signature | **0** |
| my tree billboards and pit decals | 11 found, **0** matching |
| my four side-street trees | `graded: true`, luminance **0.045** |
| citizen sprites | 12 materials, all `graded: true`, luminance **0.003** |

The `noLight` materials on the fleet — glass, tyres, engine bay, bed liner —
cannot trip D's other criterion either ("neither graded nor selfLit and brighter
than 0.5"): they are deliberately skipped AND all far darker than 0.5.

**Two planes did come back at luminance 1.0 at midnight and they are not mine.**
They sit at x 603 and x 680 — the interior offset region — and are potted plants
in somebody's room, correctly outside the street dimmer's scope. My throwaway
filter said `x > 10`, which is the side street AND every interior in the world.
Third time attribution has nearly produced a false report from this desk; see
the ownership-stamp ask in `notes/BLOCKED-H.md`.

## Probes, and what each is for

| | |
|---|---|
| `crowd-net.mjs [s]` | routing, crossings only, no overlap, errand variety, nobody frozen or lingering in the road |
| `jitter.mjs [s]` | side flips, view flips, travel reversals — a motion bug a still cannot show |
| `crowd-walk.mjs` | the politeness rules about the player, and the 2 m lane |
| `feet-check.mjs` | the painted toe against the direction of travel, both mirror columns |
| `feet.mjs [n]` | all 8 facing sectors of one citizen, standing and walking |
| `faces.mjs` | the cheek row of every skin tone, hood and cap included |
| `corner-traffic.mjs [shots]` | the junction: arcs, lean, steer, two-at-once, yielding, parked cars |
| `side-walk.mjs` | both side-street walks, the bodega door, parked-car clearance |
| `gaps.mjs [--all]` | corridors in the trap band; asserts on parked vehicles only |
| `truck.mjs [shots\|fleet]` · `kerb.mjs` · `cartex.mjs` | the fleet by eye, and its painted textures |
| `citizen-sheet.mjs` | regenerates CITIZEN-STYLE.md's contact sheet |
| `carstate.mjs` | the three not-just-parked cars: hood up, on a jack, up on blocks |
| `park-repro.mjs` | parking is identical across two independent loads — see below |

**If you are judging the fleet's wheels or arches, use `kerb.mjs`.** The desk's
screenshot audit (`0e10244c`) found that `pl-P12`, the shot the wheel arches were
judged on, is *"a car roof at point-blank — no arch visible"*. An arch is 3 texels
tall on a 0.5 m panel: from above or from a metre away it is not in frame at all.

```bash
SHOT_URL=http://localhost:4187/ node scripts/kerb.mjs <tag>   # side-on, eye level, from the kerb
SHOT_URL=http://localhost:4187/ node scripts/cartex.mjs       # the painted texture itself
```

`kerb.mjs` stands where the user said to judge from — at the kerb beside a parked
car, eye level, square to the flank — and does all three parked cars. `cartex.mjs`
is the one that actually settled the arch after two failed attempts: it dumps the
flank texture upscaled, which is where the ziggurat of stacked treads was finally
visible. **A render can hide a paint fault that the texture makes obvious.**

Current state, judged from `kerb.mjs`: both wheels read as circles with hubcaps,
most of the tyre showing, and a dark arch hugging the top of each. It is a modest
crescent rather than a pronounced flare, and that is the geometric limit written up
under *For the desk* — the tyre is 0.68 m against a 0.50 m panel, so there is no
room for more without changing the fleet's proportions.
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
4. **TWO DECISIONS THAT ARE NOT MINE**, both flagged rather than assumed:
   · **The fleet's wheel/body proportion.** A correctly-sized 0.68 m tyre against
     a 0.50 m body panel is why the wheel arch cannot be drawn well — it needs
     ~85% of the panel height to clear the tyre. Raising the beltline (a 1997
     sedan's is ~1.1 m; this fleet's is 0.84, i.e. deliberately squat) or
     shrinking the wheels fixes it and changes the whole fleet's stance.
   · **Traffic density.** `maxActive = 1` in ct/traffic.ts is an earlier
     deliberate choice, not a limitation — the junction is provably safe for two,
     since the routes are disjoint. One number.
5. **`OWNERSHIP.md` needs four lines.** `ct/traffic.ts`, `ct/sidestreet.ts` and
   `ct/crowd-net.ts` are all mine and unlisted; `ct/cars.ts` still reads `= B`
   though the queue transferred it. `ct/citizens.ts` moved to me with the feet
   item and is still marked DESK.
5. **Two things on the side street are blocked on B, not on me** — flagged
   rather than drive-by edited:
   · **LAMPS.** The bishop-crook geometry is inline in `ct/props.ts` and the
     lamplight registry `lampHeads` is private to it. A lamp built from my
     module would be a dark post that lights nothing, which is worse than none.
     It needs props.ts to expose a lamp factory. **The side street is still
     unlit after dark.**
   · **CATCH BASINS.** `ct/tex-ground.ts` puts them at the two junction low
     points where the gutters run to. More of them means deciding where the side
     street's pan drains, which is that module's business.

## Queue state

**Empty.** Every item in `## Now` and `## Next` is done and committed — the
checkboxes are the desk's to tick. In order: the crowd split, the corner
junction, the side street's furniture, the truck (three items), the profile
feet, and the pedestrian network. The whole of the original brief —
*"cars turn the corner … details extend out that way … pedestrians also go out
that way and have more complicated paths"* — is now in.

The two side-street items above (lamps, catch basins) are the only outstanding
work I found, and both are in builder B's files. Item 1 was routed to B.

**What is left in my ownership is three rulings, not work** — the wheel/body
proportion, traffic density, and `ctx.obstacle` recording no owner. All three
are in `notes/BLOCKED-H.md` with the numbers behind them, along with three gaps
in tools that are not mine. Nothing there is waiting on a builder.

For the path-graph item, note that the crowd is currently a **1-D ping-pong**:
each person owns a `home` lane on the x axis and walks `dir` along z between
`-L + 4` and `10`. Turning the corner means that `home`-lane-plus-z model has to
become a graph position, and `clearAt` is the only part of the steering that
generalises unchanged.
