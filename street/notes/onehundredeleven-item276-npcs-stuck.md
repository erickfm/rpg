# onehundredeleven / item 276 — "npcs still get stuck." MEASURED. NOTHING CHANGED.

**The item said measure, report and STOP. I have changed no world code.** All
figures re-measured today on build `1ed8deb09`, port 4672, built bundle under
`vite preview`.

---

## The four answers the row asked for

| the question | the answer |
|---|---|
| **pinned or parked?** | **PARKED. 0 PINNED in 810 s across 4 runs** — 144 stationary episodes, every one with an errand timer running |
| **is it item 269's stretch?** | **Yes, it is 269's bench** — collider `x 5.070…5.731  z −35.920…−34.080`, envelope edge **6.091**, identical to 265/269 |
| **lane width there** | **1.15 m**, re-measured today by `scripts/laneaudit.mjs`, independently of me. **The desk's number has NOT rotted** |
| **stop, if it is 269** | **Stopped.** Reopening 269 is the user's call, and nothing here pre-empts it |

## A citizen standing still is authored behaviour, and it is common

`ct/crowd.ts:637` — the errand timers:

```
window: [5, 12]     stop and look in
door:   [4,  8]     hesitate in a doorway
bench:  [12, 25]    wait for the 42
corner: [1.5, 4]    pause at the kerb
none:   [0.5, 2.5]
```

Measured, four runs, episodes of ≥ 2 s without moving:

| run | window | episodes | PARKED | **PINNED** | longest | max jam anywhere |
|---|---|---|---|---|---|---|
| 1 | 90 s | — | — | — | — | 0.03 |
| 2 | 240 s | 58 | 57 | **0** | 11.7 s | 0.05 |
| 3 | 300 s | 54 | 54 | **0** | 19.4 s | 0.05 |
| 4 | 180 s | 33 | 33 | **0** | — | 0.05 |

`JAM_GIVE_UP` is **2.0 s** (`ct/crowd.ts:564`). **The highest jam value seen
anywhere in 810 s was 0.05** — nobody came within 2.5% of the give-up threshold.

**So a frame containing two motionless citizens is expected, not a defect.**
Six walkers produce a stationary episode roughly every 4 seconds of world time,
lasting up to 19.4 s. **A screenshot cannot distinguish this from a pin** — which
is exactly why the row was right to ask for the distinction rather than assume
it, and `__ct.walkers()` publishes it (`wait` = errand timer, `jam` = blocked).

## ⚠ THE CAVEAT THAT LIMITS ALL OF THE ABOVE — read before quoting "0 pinned"

**Only 6.9% of crowd samples were north of the bench node.** The crowd's z
distribution over 180 s: min −109.0, p25 −92.6, **median −84.2**, p75 −65.3.
The bus stop is at **z −35**.

Correspondingly, **the 1.15 m pinch was entered once per run** — 4 of 3,732
samples, 4 of 6,138, 6 of 4,458.

**So "0 pinned at the bus stop" is a zero measured over a stretch the crowd
barely visits.** It is not proof that a citizen cannot pin there. What it does
establish: **when they did go through, they went through** — no jam, no stall,
out the other side. The player cannot, and they can.

## Finding A — the player is stopped by furniture the crowd walks through

```
bench maxX            5.731
player radius       + 0.360   (__ct.playerRadius(), read from the world)
                    ───────
furniture envelope    6.091

the crowd's east lane  EAST_X = ROAD_HALF + IN = 6.00   (measured: 583–820
                                samples/run at exactly x 6.00)
                    ->  the lane is 0.091 m INSIDE the envelope
```

**The crowd's main east walking lane is the same 9 cm inside the bench envelope
that stops the player dead** (item 265: `x ≤ 6.05 stopped 0/5, x ≥ 6.10 clear
5/5`). Citizens walk it without stopping; the player cannot. Worth having in
front of the user when he decides 269, because it says the pinch is a
**player-collision** problem specifically, not a world-geometry problem the
crowd also suffers.

## Finding B — the "wait for the 42" errand stands people 1.6 m from the bench

**`ct/crowd-net.ts:196` puts the `e-bench` node at z = −36.6. The bench is at
z = −35.0**, confirmed from the world (collider centre **−35.000**) and from
`ct/props.ts:2806` (`BENCH_Z = -35.0`).

The comment three lines up, `crowd-net.ts:138`, still asserts the stale value as
authoritative:

> *"Positions are the world's own — the bench is where ct/props.ts stands it
> (**BENCH_Z = -36.6**)"*

**Git settles it — this is drift, not intent:**

| commit | date | what it did |
|---|---|---|
| `7be0c2a82` | 07-24 | stood the bench at `BENCH_Z = -36.6` |
| `7c93e47ad` | 07-24 | added `e-bench` at −36.6, hand-copying that constant |
| `114675e62` | 07-24 | **moved the bench to −35.0** ("faces the road, sits at the kerb") — **and did not touch the net** |

`git merge-base --is-ancestor` confirms the net node predates the move.

**Consequence:** a citizen taking the bus-stop errand stands at (6.00, −36.6) —
**0.68 m south of the bench's south face**, i.e. on open pavement *beside* the
bench rather than at it — **motionless for 12–25 s, the longest wait in the
game.** That is a close match for the user's words: *"two citizens standing
motionless on the pavement beside the bus bench."*

**I am not claiming that is what he photographed.** The bench errand fired **0
times in 144 episodes**, and with 93% of crowd time spent south of there I
cannot separate "never fires" from "rarely visited". Under a uniform draw over
the 22 errand nodes (8 window, 7 door, 6 corner, 1 bench) 144 episodes would
give ~6.5 bench arrivals; observing 0 has p ≈ 0.1%. **But arrivals are
demonstrably not uniform** — corner took 46% of episodes against 27% of the
nodes — so this is suggestive, not conclusive.

This is **BUILDER-BRIEF §8**: a second hand-typed copy of a number, which drifted
the moment the original moved, with a comment that still names the original as
its source.

## What I did NOT do, and why

- **Nothing was changed.** Item 276 forbids widening the pavement, moving the
  bench and moving the shopfront, and 269 is the user's decision.
- **I did not fix Finding B either**, though it is a one-line change that touches
  none of those three things. `ct/crowd-net.ts` is **not named by this item**
  (BUILDER-BRIEF §9: a file the item does not name is a stop-and-report, not a
  silent edit). **It is cleanly separable from 269's architectural trade** — it
  moves a routing node, not the street — so it can be queued on its own.

## Suggested follow-up rows for the desk

1. **`ct/crowd-net.ts:196` — `e-bench` is 1.6 m from the bench it names.** Derive
   it from `props.ts`'s `BENCH_Z` rather than re-typing it, and fix the comment
   at `:138` that asserts −36.6. Done when: a citizen on the `bench` errand
   stands within the bench's own z span. **Independent of 269.**
2. **The bench errand may never fire.** 0 of 144 episodes. Establish whether
   `e-bench` is ever chosen as a destination before assuming row 1 fixes
   anything visible.
3. **The crowd lives in the south of the block** — median z −84.2, 6.9% north of
   −36.6. If the north end is meant to feel populated, it does not; and it means
   no measurement taken up there has meaningful exposure.

## Instruments (all read-only, all in `scripts/probes/`)

| | |
|---|---|
| `w111-npc-stranded.mjs [seconds]` | the watch: episodes, pinned/parked, pinch exposure, lane and z distributions |
| `w111-bench-node.mjs` | asks the route net where the bench is and whether `e-bench` is reachable |
| `w111-busstop-frame.mjs` | stands where he stood: `shots/w111-busstop-{north,bench}.png` |

**Two instrument faults found and fixed, both of which would have produced a
confident wrong answer:**

- **The warp silently did not take.** Run 2 was still in flat 301 at
  (198.60, −16.30) while run 1, byte-identical, landed on the pavement. The
  GOTCHAS 79b cull guard caught it and aborted with exit 3 rather than
  censusing an empty street. The probe now warps, waits for a **painted** frame,
  **checks where it actually stands**, and retries.
- **The first frame was shot facing the wrong way.** Forward is `(sin yaw, 0,
  −cos yaw)`, so `yaw 0` at z −42 looks *away* from a bench at z −35. Corrected
  to `yaw π`; the comment in the probe says so.
