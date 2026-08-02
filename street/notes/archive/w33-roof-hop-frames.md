# w33 — item 69: the pickup roof hop, settled by counting frames

**Root cause in one line: a hop is decided by how many RENDERED FRAMES clear
`maxY - TOP_EPS`, not by vertical margin — and nobody had measured either that
or the horizontal standoff the player actually has to cross.**

Port used: **4185** (`npx vite preview`, proved free with `curl` first). Verified
on the BUILT bundle throughout.

---

## Who was right

Three builders measured this and got three answers. The honest scoreboard:

| | claim | verdict |
|---|---|---|
| w21 | built and walked the route, mutation-tested red twice | **right** — it does climb |
| w22 | 27 escapes under throttle x2/x3/x4 | **right** — it does climb |
| w29 | 0.53 is on the wrong side of a cliff; 21 mm is not a margin | **right about the mechanism, wrong about the pickup's frame count** |
| desk | "clears by 21 mm at the dt clamp" | **wrong quantity entirely**, as w29 said |

w29 is the one who found the real rule and deserves the credit for it: `blocked()`
pads a tier by `RADIUS` until your feet clear `maxY - TOP_EPS`, so a hop must
cross ground *horizontally* while it is high, and at the dt clamp that is a whole
number of 0.165 m steps. Its arithmetic for the **sedan** is exactly right.

Where its table is wrong is the pickup. It says rise 0.53 gets **2** frames. It
gets **3**. The sedan's roof comes off a Float32 bounding box (1.46 stored as
1.4600000381) which pushes the threshold 38 nm the wrong way and costs a whole
frame; the pickup's heights are exact doubles and `f4` lands on the threshold
*exactly*, counting only because the comparison is `>=`. So w29's "it wins the
tie by luck" is right in spirit and its "2 frames" is right for the car it was
holding, not for this one.

**None of them was measuring the thing that actually breaks it** — see below.

## What I measured

`scripts/probes/w33-roof-frames.mjs` climbs the route for real and records every
rendered frame: feet height, x, z, dt. Frames above the threshold are **counted
directly**, not inferred from where the player ended up.

At the shipped `roofY` 1.50, throttle x8 (median frame ~65-100 ms, well past the
0.05 s clamp): **3 frames above threshold, 0.495 m of travel**, and it landed
20/20. So w21 and w22 were reporting a real result, and it is deterministic —
IEEE 754 is not a coin flip.

Then the mutation that settles it: **raising `roofY` by 100 nanometres took the
climb from 4/4 to 0/4** (frames 3 → 2, travel 0.495 → 0.330 against RADIUS 0.36).
The shipped hop cleared by *exactly zero*.

## The finding nobody had, and the reason 1.455 was not enough

My first fix was `roofY` 1.455 — four frames, threshold centred in its band. The
rewritten check then failed it, and it was right to.

**`blocked()` refuses the whole step, so the player is not left touching the
RADIUS pad — he is left up to a full frame short of it.** Measured in the running
world he is held **0.515 m** off the roof face, not 0.36. Where he ends up
depends on where along the bed he walked, so the crossing needs **four** frames,
not three, and 1.455's four frames were a spare of exactly zero all over again.

This is also the user-facing defect, and it is worse than "fragile": running the
new rule against the **shipped** 1.50 gives `spare -1` and the hop **does not
land**. On the published artifact, whether you can get on that roof depends on
where you happened to be standing when you jumped.

## The fix

`PICKUP_CAB.roofY` 1.50 → **1.415** (`src/proto/ct/cars.ts:148`).

Rise 0.445, needing `airY >= 0.365`, which catches f3 f4 f5 f6 f7 — **five
frames, 0.825 m of travel** against a 0.515 m standoff. 0.365 sits 0.025 above f8
and 0.025 below f3: as far from both band edges as the band allows, so it is not
a value that a rounding change can flip.

The property bought is **dropped-frame headroom** — the hop still lands if the
engine loses a frame outright. That is what "not marginal" has to mean here.

The cab is 85 mm lower. I looked at it side-on before and after
(`scripts/probes/w33-pickup-profile.mjs`, `shots/w33-pickup-side{,-BEFORE}.png`;
`shots/` is gitignored, so regenerate rather than look for them in a diff). **My
verdict: the change is barely perceptible from street level and the truck reads
exactly as it did.** The greenhouse is now 0.575 m beltline-to-roof against a
real pickup's 0.55-0.65 — 1.50 was the tall one.

## The acceptance rule, rewritten

`scripts/w21-roof-climb.mjs` §8 replaces the 21 mm vertical bar. A vertical
margin of 21 mm and one of 0 mm buy the identical number of frames; the old bar
could not tell them apart, which is the whole reason this item existed.

Every number in the new rule is **measured in this world, none typed into the
script** — the standoff the player is held at, the distance a walk covers in one
frame, and the frames spent above `maxY - TOP_EPS`. It reads no constant out of
`fp.ts`, so it still fails correctly if the jump, `RADIUS` or `TOP_EPS` is
retuned.

> **frames available must exceed frames needed by at least one.**

It runs under CPU throttle x8, because the clamp is the worst case and an idle
headless browser never reaches it: unthrottled this hop gets 7-8 frames where the
clamp gives 5.

**Mutation-tested, bytes confirmed changed (md5 before/after):**

| `roofY` | frames avail | needed | spare | check |
|---|---|---|---|---|
| 1.50 (shipped) | 3 | 4 | −1 | **FAIL**, exit 1, and 8b: did not land |
| 1.470 | 3 | 4 | −1 | **FAIL**, exit 1, and 8b: did not land |
| **1.415** | **5** | **4** | **+1** | **PASS**, exit 0 |

`8b` asserts the throttled hop *actually landed*, so the rule cannot pass by
failing its own arithmetic in a compensating direction.

## Results

- **20/20 at CPU throttle x8** and **20/20 unthrottled** (`w33-roof-frames.mjs 20 8`, `20 1`), 0 reps lost.
- Frames above threshold: 5 at the clamp, 7-8 unthrottled. Standoff 0.515 m needs 4.
- `scripts/w21-roof-climb.mjs` **PASS** exit 0 — route, flank still solid, all four roof exits, and the margin rule.
- `scripts/bugsweep.mjs` **0 STATION MISS**, exit 0.
- `scripts/w29-sedan-climb.mjs` **PASS** (sedan untouched), `scripts/jump-walk.mjs` **PASS**, apex 0.475 confirming the clamp.
- `npx tsc --noEmit` clean.

## Found and NOT fixed — for the desk to queue

1. **`src/proto/crosstown.ts` carries two comment blocks that my change has made
   false, and I did not touch it because item 69 does not name that file**
   (BUILDER-BRIEF §9). No functional dependency — it imports `PICKUP_CAB.roofY`
   — but they are load-bearing prose that the next reader will trust:
   - **lines ~725-737**: the step table still says `cab roof 1.50 │ 0.53 │
     +0.021` and asserts *"THE ROOF HOP CLEARS BY 21 mm on the engine's worst
     possible frame"*. Both numbers and the whole framing are now wrong.
   - **lines ~915-923**: w29's *"THE PICKUP'S ROOF HOP IS THE SAME 0.53 AND WINS
     THAT TIE BY LUCK"*. True when written; the tie no longer exists.

   A one-line queue item pointing at both ranges is enough.

2. **The bed-floor → rail step has the same zero-spare shape and no check.**
   Rise 0.47 → 4 frames available; a 0.515-class standoff needs 4. Spare 0. It
   has succeeded in every run I did (~60 climbs), so it is not broken, but it is
   one retune away from being the next item 69. `PICKUP_BED.railY` was named in
   my item and I deliberately left it alone: raising the rail fixes step B by
   breaking step A, and lowering the roof fixed B without touching A.

3. **`road → bed floor` (rise 0.50) gets 3 frames and its 4th misses by 1 ULP**
   (`f7` = 0.419999999999999818 against a 0.42 threshold). It works, and
   `floorY` is item 1's shipped surface and not named in my item, so I left it.
   Worth knowing it is a 1-ULP miss and not a comfortable pass.

4. **The standoff is a general property of every tier in this world, not just
   this truck.** Anything reachable only by crossing `RADIUS` while airborne has
   an effective requirement of `RADIUS + one frame of walk`, i.e. **0.525 m at
   the clamp, not 0.36**. Whoever adds the next standable tier should be told
   that up front; `w33-roof-frames.mjs` will measure it for them.

## Reply to the desk's mid-item note (hatch route, tyre top, throttle x8)

**1. "A hatch route has a 91 mm worst-case margin against the pickup's 21 mm."**
That comparison is the exact bar this item removed — a vertical margin cannot
tell a hop that clears by 91 mm from one that clears by 0, because both buy a
whole number of frames. Converted to frames against the measured 0.515 m
standoff (4 needed), the desk's geometry and my fix agree, and there is no
conflict to resolve:

| leg | rise | frames | spare |
|---|---|---|---|
| hatch: pavement → bumper | 0.460 | 5 | +1 |
| hatch: bumper → spoiler | 0.450 | 5 | +1 |
| hatch: spoiler → roof | 0.390 | 6 | +2 |
| **pickup: rail → roof (mine, 1.415)** | **0.445** | **5** | **+1** |
| pickup: rail → roof (as shipped, 1.50) | 0.530 | 3 | −1 |

So the fix already lands the pickup in the hatch's class. **I did not need to
choose between a coin flip and abandoning the feature, and I did not tune a
test to get there** — the roof came down 85 mm.

**But the hatch route has a leg the desk should check before treating it as the
safe reference.** By the same arithmetic, `road (0.00) → bumper (0.60)` needs
`airY >= 0.52`, and **the clamped apex is 0.475 — zero frames, unreachable at
the dt clamp.** It only works entered from the 0.14 m pavement (5 frames). I
have not walked it, so this is arithmetic and not a measurement: it should be
run through `scripts/probes/w33-roof-frames.mjs`'s method before that route is
quoted as having headroom.

**2. "The tyre top is 0.6634, not 0.68."** Noted, and it does not touch item 69:
**none of my arithmetic uses a tyre height at all.** `grep` for `0.68`/`0.663`/
`tyre` across `w33-roof-frames.mjs`, `w21-roof-climb.mjs` and this note returns
nothing. The pickup route is pavement → bed floor → rail → roof; no wheel is on
it.

**3. "CPU throttle x8 is not achievable in this sandbox — the headless browser
dies under software WebGL."** **This was not my experience and I did not
substitute a lower rate.** x8 via `Emulation.setCPUThrottlingRate` ran to
completion twice at 20 reps, browser healthy, **20/20 landed both times**, with
median frame times of **68.8–115.2 ms** (against ~25 ms unthrottled).

The stronger point is that the multiplier is not the quantity that matters:
`main.ts:107` clamps `dt` at 0.05 s, so **every one of those frames is past the
clamp**, and past the clamp more throttling cannot change the physics — the sim
advances 50 ms per frame however long the frame took. x8 is simply a convenient
way to sit on the clamp; x4 or x12 would measure the same worst case. So the
DONE WHEN was met as written, and the figure I report is the one I achieved.

## Derived or copied?

The frame table in `cars.ts`'s comment is **copied with citations**
(`fp.ts:87` RADIUS, `fp.ts:98` TOP_EPS, `fp.ts:549-553` the integrator,
`main.ts:107` the dt clamp) rather than imported, because `TOP_EPS` and the
jump's v0/gravity are module locals and hoisting them means editing `fp.ts`,
which item 69 does not name. **The check does not depend on that copy** — it
measures all three quantities in the running world, so the comment can go stale
without the guard going blind. A follow-up to export the jump model would let
the comment be derived too, but nothing is currently at risk from its absence.
