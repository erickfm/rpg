# onehundredone / item 130 — every drop is a fall now, and the stairs risk was never real

**DONE.** The item said `[VERIFY STATE] — this may already be satisfied`. **It
was not.** `fp.ts` gated the step-off fall on `heldByTop`, which is true only on
a collider carrying a `maxY` — **the pickup's five tops and the sedan's two, and
nothing else in the world** (`probes/w50-tops.mjs`). Every kerb, stoop, stair and
storey change was still an instant snap. Measured before touching anything: the
0.140 m kerb lost **0.148 m in one 40 ms frame against a 0.091 m gravity bound.**

The user, 2026-08-02: *"i think just make all drops falls then we can work back
from there."* (`FEATURE-REQUESTS.md:2715`.)

---

## What I changed

**`src/proto/fp.ts`** — the gate is now the drop height alone, against a named
constant:

```ts
const FALL_MIN_DROP = 0;                       // ← THE ONE NUMBER TO TURN
...
const dropped = this.support - gy;
if (dropped > FALL_MIN_DROP && walked <= this.run * dt + 1e-3) this.airY += dropped;
```

`heldByTop` is deleted. `sit()` and `stand()` used to clear it; they now **re-base
`support`** off `groundY` at the new position instead — sitting MOVES you to the
pose and standing moves you again by up to the 1.4 m search ring, so a stale
`support` is a fall out of a chair the moment the terrain can start one. That is
the one non-obvious consequence of removing the flag and it is checked below.

The teleport guard (`walked <= run*dt`) is unchanged and now carries far more
weight: **it is the only thing left between a warp and a fabricated fall**, and
every warp in the world lands on terrain the picker answers for.

**`scripts/stepoff-walk.mjs`** — case 6 flipped. See "saying so out loud" below.

---

## ⚠ THE DESK'S FLAGGED RISK CANNOT HAPPEN — and the reason was already written down

The ruling came with one engineering worry: *"Flagged the stairs as the risk: a
staircase is a sequence of small drops and could become a bouncing descent."*

**A staircase is not a sequence of drops to this code. It is a ramp.**
`ct/civic.ts:98`, which has been there the whole time:

> *"the picker does not know about treads. It walks you up a smooth ramp at the
> flight's own gradient and the drawn steps ride within half a riser of it.
> Answer with tread tops instead and the camera jolts a whole riser at every
> nosing."*

`ct/apartment.ts` is its model and does the same, and floor height in this world
comes from a picker and never from colliders (GOTCHAS §7). So there are no
risers to fall down anywhere. **Walked, not argued** — climbed the walk-up on
foot to storey 1.35 m and walked back down it, 3 runs:

| | before | after |
|---|---|---|
| descended | 1.371 m | 1.354 m |
| **bounces (rise > 0.09 m)** | **0** | **0** |
| biggest mid-descent rise | 0.000 m | 0.000 m |

There is also **no bounce mechanism to have**: `airY` is only ever added to and
is clamped at 0 with `vy` zeroed on contact. Nothing restores upward velocity.

---

## What it actually does — walked, 3 runs each, `probes/w101-descend-walk.mjs`

| | before | after |
|---|---|---|
| **kerb, biggest single-frame drop** | **0.148 m** (bound 0.091) → INSTANT | **0.086 m** (bound 0.131) → **FALLS** |
| kerb, frames off the floor | 0.0% | 12.4% |
| ramp descent, frames off the floor | 0.0% | 23.8% |
| level road, frames off the floor | 0.0% | **0.0%** |
| level road, head-bob peak-to-peak | 0.090 m | **0.090 m** |
| jump while walking (held) | 0.531 m | 0.537 m |
| jump while walking DOWNHILL (held) | 0.531 m | 0.534 m |
| **tapped jumps landing, downhill, out of 10** | **5** | **4** |

**The kerb falls. Level ground, head bob and the jump are untouched.** The only
cost I can measure is the last row: one tapped jump in ten, on a slope, and the
before figure of 5/10 shows most of that loss is the 90 ms tap against the
world's own cadence rather than this change.

I expected worse and said so in the code. `airY === 0` gates both head bob and
the jump (`fp.ts:647`), and at a threshold of 0 a slope drops the floor every
frame — so I predicted permanent airtime downhill. **It does not happen:** the
walk-up ramp leaves you airborne on 24% of frames, not 100%, because gravity
clears each frame's few centimetres before the next one arrives.

---

## Saying so out loud — the change detector fired exactly as designed

`stepoff-walk.mjs` case 6 pinned the kerb as an instant snap, and its author
wrote down why in the file header:

> *"a change detector, not an endorsement: if someone later decides terrain
> drops should fall too, this case fails and makes them say so out loud instead
> of changing the feel of every pavement in the world silently."*

It went red on my first build, with a message ending *"if this is deliberate,
say so and update this case."* **This is the saying-so.** Case 6 now requires the
kerb to be inside the same per-frame gravity bound cases 1–5 use — it is no
longer a special case at all — and it is still a detector, pointed the other way:
anyone raising `FALL_MIN_DROP` above a kerb's height turns it red in turn.

**It can fail.** Reverted `fp.ts` to its parent and re-ran: **exit 1**, case 6
red, *"lost 0.148 m in one 40.2 ms frame, against a gravity bound of 0.091 m."*

I also **clamped the bound's `dt` to `main.ts:107`'s 0.05**, because the physics
never integrates a longer step however long the wall clock says the frame took.
Without it a 57 ms frame bought a 0.136 m bound instead of the true 0.113 m —
a 15% margin on a check that ought to have 30%. **Cases 1–5 still use raw dt**;
they pass by a wide enough margin that it has never mattered, but it is the same
latent hole and it is now written down in the file rather than left to be
rediscovered.

---

## THE NUMBER TO WORK BACK FROM — this is the deliverable, not the code

*"then we can work back from there"* is an invitation to tune, so here is what
to tune with. Both measured, by walking:

| | |
|---|---|
| the walk-up ramp — **the steepest slope you can walk** | **0.040 m** lost per frame |
| the kerb — **the shallowest discrete step in the world** | **0.140 m** |

**Any `FALL_MIN_DROP` strictly between 0.040 and 0.140 makes every real step
fall while leaving every slope underfoot** — no airtime on ramps, no tapped-jump
loss, kerbs still eased. 0.06 is the middle of that gap. **I did not set it
there.** He asked for 0 first, it is his feel to judge, and the whole point of
the named constant is that trying 0.06 is a one-character edit.

---

## Verification

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run test` | 17/17 |
| `node scripts/health.mjs` (built bundle, `:4191`) | `WORLD OK`, **exit 0** |
| **`npm run stepoff`** | **6/6**, including the flipped case 6. Reverted: **exit 1**, case 6 red |
| `scripts/jump-walk.mjs` | **all green** — 7 spots, every apex in band, every one lands on the floor it left, including *"the apartment stairs"* standing mid-ramp |
| `probes/w101-stand-up-is-not-a-fall.mjs` | 14 seats sat in, **0 stood up into a fall**, 0 trapped |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, no new console errors |

Everything on the **built bundle** (`vite preview`, port **4191**, proved free
with `ss -ltn`).

---

## ⚠ FOUR INSTRUMENT FAULTS, ALL MINE, ALL CAUGHT

BUILDER-BRIEF §7 says half of all "defects" here are the instrument. In this item
it was four out of four, and the last two nearly became filed bugs.

1. **Hunting for a descent by scanning `groundAt` found five candidates and not
   one could be walked.** The picker answers for every point in R² including
   void (`lib/floors.mjs`), so a coordinate it names is not a place a body can
   go. The first cut reported *"descended −0.005 m"* and I nearly wrote that up
   as a finding. Replaced by the walk-up ramp, located from the published
   `scene.userData.spawn` and **climbed on foot**.
2. **Head bob measured as "direction changes over 0.008 m" returned 0.000 on a
   world where bob demonstrably works** — the ground's own slope swamps the
   per-frame delta. Now measured as the ENVELOPE of eye-height above its own
   floor, which is 0.090 m peak-to-peak in both worlds.
3. **"4 seats stood up into a fall" — they had never stood up.** Their settled
   eye was 1.050 m, a *seated* height, so the "0.345 m peak" was the sit-down
   transition still in the trace. **The only reason I caught it is that the
   unchanged world printed the identical four rows.** A regression probe that
   says the same thing before and after is measuring something else.
4. **"3 seats where neither E nor Escape got the player up"** — a trapped
   player, the most serious thing this project ships (§11). **False, twice
   over.** The wait was too short (280 ms; by hand at 700 ms the same seat
   stands on the first E), *and* the probe pressed Escape-then-E
   unconditionally: **Escape had already stood the player up and the following
   E sat him back down.** Driven by hand the state alternates on every press,
   which is the shape that gave it away. A probe that presses a toggle twice
   and reads the end state has measured the parity of its own key count. All
   six are correctly reported as modal seats now, and **no §11 bug was filed.**

---

## FOUND AND NOT FIXED — for the desk

1. **`stepoff-walk.mjs` cases 1–5 compute their gravity bound on raw wall-clock
   `dt`, not the clamped 0.05 the physics uses.** Same hole I closed in case 6.
   They pass with a wide margin today so it is not urgent, but it is a bound
   that quietly loosens on a slow frame. One line each.
2. **Landing on a surface still pops the camera up before it settles** — the
   mirror of this whole family, pre-existing, filed by w50 and still open.
   `standTop` credits a top within `TOP_EPS` and the leftover `airY` is added on
   top of the new floor. The symmetric fix is one line but it re-times every
   climb, so it wants its own item and its own `w21-roof-climb` run.
3. **A terrain step of 0.99 m exists at around (−12, −10.75)** and one of
   2.547 m at (200, −10.5) — found by `probes/w101-drop-census.mjs`, which
   buckets every adjacent-sample drop in the world. They now fall rather than
   snap, which is an improvement, but a 2.5 m unguarded drop is worth a look on
   its own terms. The census also confirms **1,654 kerb-height steps** — this
   change touches all of them, which is why it wanted walking rather than
   reasoning about.
4. **I did not touch `main.ts`'s dt clamp or the gravity constant.** The user's
   separate *"make gravity a tiny bit stronger"* ask is already landed at 14.
