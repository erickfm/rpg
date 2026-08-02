# w29 — item 64: the roof-climb check is registered, and traffic is closed with a number

Port: **4188** (proved free, shut down at the end).

## (1) The check nothing ran

**Root cause, one line:** `scripts/w21-roof-climb.mjs` was the only proof the
climbing route works and appeared in no registry, so nothing re-ran it — and
when I read it, it could not have failed anyway.

Registered in `scripts/checks.mjs` on the **slow tier**, which is that file's own
documented home for walking suites (`npm run checks -- --slow  # include the
WALKING suites`) and already holds `spots-walk` and `lotwalk`. It walks five
full climbs, so it belongs there rather than in the seconds-long default tier.

**Three defects fixed in the script itself:**

1. **It printed `FAIL: route incomplete` and exited 0.** Survivable while nothing
   ran it; fatal the moment it is registered, because a check that always exits
   0 reports green forever. Same family as `scripts/health.mjs` (item 61) and
   `scripts/bugsweep.mjs` (item 62 — I fixed that one too).
2. **It was tautological.** Every `check()` asserted `feet === <box>.maxY`,
   reading its expectation out of the collider under test, so flattening a tier
   left the world wrong and the check green. I found this the hard way on my own
   copy of it while doing item 54 (`notes/w29-sedan-climb.md`), where the
   equivalent mutation passed. Each tier is now pinned against a **freshly built
   pickup** measured off its own drawn panels via `__ct.carVariant`, which goes
   through the same `makeCar` the street uses but touches no collider code.
3. **It only ever left the roof forwards**, over the hood. Three of the four ways
   down were guarded by nothing. Promoted the coverage from
   `scripts/probes/w21-roof-exit.mjs`, which proved it once and was then never
   run again.

### The trap in (3), which I walked into and which is worth recording

My first four-direction test warped to the roof's centre and **passed all four
directions — with `feet 0.00` at every one.** `warp` writes x and z but *not*
your height, so it put the player at street level **inside** the truck's box and
`unstick()` shoved them out sideways. "Did you get down off the roof" was
trivially true because they had never been up there.

It now **climbs for real before each direction** (up to four attempts, since the
roof hop clears by ~21 mm) and asserts `feet ≈ roof.maxY` before turning. A
direction it cannot reach prints `MISS ... direction untested` and fails the run
rather than scoring.

### Verified

- **PASS on dev:4188, exit 0**, all four exits genuinely from the roof — each
  one shows `3. CAB ROOF feet 1.500` immediately before it.
- **Mutation-tested with byte proof:** `PICKUP_CAB.roofY` → `1.85` in
  `crosstown.ts` (96994 → 97004 bytes) gives
  `FAIL: tier pickup-cab-roof stands at 1.85 — the truck has no panel at that
  height`, **exit 1**. **The old check would have expected 1.85 and passed** —
  that is the tautology, demonstrated. Reverted to 274969861 96994.
- `node --check` clean on both files; the registry's own "is it on disk" guard
  resolves `scripts/w21-roof-climb.mjs`.

## (2) Traffic and citizen colliders — MEASURED AND CLOSED

**`ct/traffic.ts` sets `maxY` nowhere** — confirmed, the string does not appear
in the file. Every moving vehicle and citizen box is a wall at every height,
which is the class the parked cars were in before item 29.

**It is inert, and here is the number.** The question is not "can I stand on a
bus" — it is the reverse: a full-height box sweeping through a standable tier's
footprint blocks a player standing there, and `unstick()` then shoves them off.
That is exactly w21's unreproduced STUCK on the cab roof.

`scripts/probes/w29-traffic-reach.mjs` samples **2400 frames** and reports, for
every standable tier, the closest any *moving* collider ever came. "Moving" is
derived — the box changed between frames — rather than taken from a tag,
because neither traffic nor citizens stamp one.

```
sampled 2400 frames, 520 colliders, 7 of them MOVED during the sample
moving colliders that carry a maxY (i.e. are standable): 0

  pickup-hood          0.778 m
  pickup-cab-roof      0.778 m
  pickup-bed-floor     0.778 m
  pickup-rail-left     0.778 m
  pickup-rail-right    0.969 m
  sedan-boot-lid       4.363 m
  sedan-trailer-deck   5.409 m

VERDICT: closest approach 0.778 m, against a RADIUS of 0.36 m.
```

**A 2.2× margin at the worst point in the world.** There is no height at which a
player can meet a moving box, so giving traffic a `maxY` today would add a
surface nobody can reach — the "collider nobody meets" this project forbids.
**Closed, not fixed**, deliberately.

**It also disproves w21's own hypothesis for the STUCK.** w21 guessed *"a
passing vehicle blocking at roof height for the length of the 1800 ms window"*.
Traffic never comes within 0.778 m of the roof and RADIUS is 0.36, so a passing
vehicle **cannot** have been what stopped that player. Whatever caused it, it
was not traffic, and the next person should not spend time there.

## Found and NOT fixed

1. **The STUCK's real cause is still unknown**, and is now known *not* to be
   traffic (above). The diagnostic w21 added is still in place, and w22's 27
   throttled exits plus my 4 were clean, so there is nothing to chase until it
   recurs.
2. **`scripts/probes/w21-roof-exit.mjs` is now redundant** with the promoted
   coverage in the registered check. Worth deleting so nobody maintains two.
3. **The check costs ~4 minutes** because each of the four directions re-climbs.
   If that is too slow for the slow tier, the honest saving is to test one
   direction per run in rotation, not to drop the climb — warping instead is the
   trap in (3).
4. **`jump-walk`'s hardcoded default port is still 4185** (w21 reported this
   too). Every run in this note passed `SHOT_URL` explicitly.
5. **`git stash` is shared across worktrees** — see `notes/w29-sedan-climb.md`
   §5. Fourth item running that this is worth saying; it deserves a GOTCHAS
   entry.

## Derived or copied?

**Derived.** Tier heights are cross-checked against a freshly built pickup's own
panels; "which colliders move" is measured, not tagged; the tier list comes from
`__ct.colliders()` by tag. The one value **cited** rather than imported is
`RADIUS = 0.36` in the traffic probe (`fp.ts:41`) — not exported to scripts, the
same citation w21 had to make. It is used only to interpret a gap of 0.778 m, so
the conclusion survives any plausible drift in it.
