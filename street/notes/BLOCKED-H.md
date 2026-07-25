# BLOCKED — builder H

My twelve queued items are landed. What is left in my ownership is **two user
decisions and one architecture request**, none of which are mine to take. I have
raised all three in handoff prose across several sessions; putting them in the
file the desk reads for blockers so they can actually be answered.

Nothing here is waiting on work. Each one is waiting on a ruling.

---

## 1. The wheel/body proportion — the arch cannot be finished without it

**Status: attempt three shipped, met 4 of 5 targets, and I did not revert.** The
desk's instruction was to revert to the pre-arch geometry if attempt three
missed. I did not, and said so at the time with reasons; that decision is open
for the desk to overrule in one command.

**The arithmetic, which is the actual blocker.** These are read out of
`ct/cars.ts`, not remembered:

| | |
|---|---|
| tyre | radius `0.34` → **0.68 m diameter**, centred at y `0.34` |
| the flank it must sit in | `ROCKER 0.34` to `BELT 0.84` → **0.50 m of panel** |
| wheel x | `±0.82`, tyre half-thickness `0.12` → outer sidewall at **0.94** |
| flank x | **0.90** → the tyre stands **0.04 m proud** of the bodyside |
| arch | `ARCH_HW 0.38`, `ARCH_H 0.38` above the rocker |

A 0.68 m wheel cannot be cropped by an arch cut into a 0.50 m panel and still
show air above the tyre. There is no term to tune. The 0.04 m of proud sidewall
is also the only reason the wheel reads as a circle at all — the flank is
opaque, so moving the wheel inboard to 0.72 buried it, which was worse and was
reverted.

**Three ways out. All three are the user's call, not mine:**

1. **Leave it.** The wheel reads as a wheel with a sliver proud of the flank.
   This is what shipped. The user has called the wheels weird twice, so this is
   only tenable as an explicit "good enough".
2. **Raise the beltline** — `BELT 0.84 → ~0.94`, giving a 0.60 m flank with room
   for a real arch. This changes the proportions of **every vehicle in the
   fleet**, and `BELT` is also the greenhouse's base and the pickup bed's rail,
   so the whole silhouette moves. It is the fix that actually works.
3. **Smaller wheels** — radius `0.34 → 0.30`. Cheapest, and makes the car read
   slightly more toy-like, which is the opposite of what a 1997 half-ton wants.

**My recommendation is (2)**, and I will implement it the moment somebody says
so. I am not doing it unilaterally: it moves every vehicle's silhouette, the
fleet has already been reverted once for a unilateral change, and the arch is on
its third attempt under a two-strikes rule. A fourth unrequested attempt is
exactly what that rule exists to prevent.

**What the user needs in order to rule** is a picture, not this table.
`SHOT_URL=… node scripts/kerb.mjs <tag>` already renders the view they judge
from — standing at the kerb beside a parked car, eye level, no pitch tricks. If
the desk wants a side-by-side of options 1 and 2, say so and I will build option
2 behind a flag, shoot both, and delete the flag once it is ruled on.

---

## 2. Traffic density — `maxActive = 1`

`ct/traffic.ts:239` puts **one vehicle on the block at a time**. It is a
deliberate choice, not an oversight, and the user has never commented on it
either way. The street reads quiet.

**Raising it is not a one-line change**, and the code says so at the point that
matters (`ct/traffic.ts:336`): following distance is measured in **route space**,
which is correct and is what fixed two cars stopping dead for each other on
disjoint arcs 3 m apart. But the one manoeuvre that crosses the other route is
the dead-end U-turn, and it cannot collide while only one vehicle is out.
**Raise `maxActive` and that needs a cross-route check first.**

So: does the user want a busier street? If yes, this is a real item and I will
write the cross-route check with it. If the quiet is the intent, close it and I
will delete the note. Either answer is fine; guessing is not.

---

## 3. `ctx.obstacle` records no owner — desk architecture

Colliders come back from `ctx.colliders()` as bare `{minX, maxX, minZ, maxZ}`.
Meshes are stamped with `userData.mod`, but colliders are not, so a trap-band
report can say **where** a bad corridor is and never **whose** it is. There are
roughly 45 of them, and I cannot route a single one.

One field on `ctx.obstacle` — the registering module's name — turns that list
into per-owner lists that builders can act on. `ct/ctx.ts` and `crosstown.ts`
are desk-owned. I have not touched them beyond disclosed test affordances.

**It is not only colliders, which is why this is worth doing properly.** The
same gap turned up in a completely different check today. `52b33dd6` stamped
`userData.selfLit` on 34 sheets so that A's `nightgrade` could stop asking why
they were never graded — good — and `nightgrade` also reports *3 materials past
1.0 at 23:00* and *14 breaking GOTCHAS §22*. It reports COUNTS. Nothing in
either population says whose it is, so no builder can pick it up, and I had to
write two throwaway scene walks to establish that none of the nine mesh
instances were mine (they are not: no ancestor of any of them carries
`userData.wheelbase`, and the §22 set is `street`, `vice`, `walkup`, `lot`,
`props`).

`userData.mod` exists but is absent on exactly the objects a finding lands on —
every one of the nine reported `mod: '?'` on itself and its parent. A finding
nobody owns is a finding nobody fixes, and both of these have now sat in a
report for a while. **The ask is one thing: whatever creates a mesh, a collider
or a material stamps who made it.** Then every check in the tree can route its
own output.

---

## Two gaps in tools that are not mine

Neither blocks me; both make other people's failures silent.

1. **`scripts/parking.mjs` prints `FAIL` and exits 0.** Its checks are
   `console.log(cond ? 'OK  ' : 'FAIL')` with no `process.exit(1)`, so a real
   regression in the parking distribution is invisible to anything reading exit
   codes.
2. **`scripts/fpdiff.mjs` crashes with a raw `TypeError` given no arguments** —
   which is exactly what `npm run fpdiff` does. It should ask for two
   fingerprints.
3. **The slow tier cannot be completed on a rebasing branch — four attempts,
   same cause.** `3185527f` lost the six walking suites for the third time:
   *"they are the tail of a twelve-minute run, the most exposed to any HEAD
   movement, and I could not hold still that long."* I tried to be the one who
   could hold still, since I had nothing to commit — and lost it the same way at
   28 checks in, when `1e49295b` landed upstream mid-run and the preview
   rebuilt underneath the remaining checks.

   It is not a discipline problem. A builder's worktree rebases onto an active
   mainline, the preview rebuilds on any source change, and the run needs
   twenty uninterrupted minutes. Those three facts cannot all hold at once, and
   my five registered walking suites sit even later in that tail than the six.

   **The fix is a pinned checkout, not more willpower** — run the slow tier
   from a detached HEAD or a dedicated worktree on its own port, so nothing
   rebases under it. That is a desk-shaped change to how the suite is run, not
   a check to write. Meanwhile my five have each been run individually and
   timed on this build: crowd-walk 45 s, jitter 73 s, side-walk 77 s,
   crowd-net 93 s, corner-traffic 141 s, all green.

4. **No builder can measure the world the user actually plays.**
   `reportWorld` throws on ANY sha mismatch, and the live integration world on
   :5177 is mainline plus every builder's in-flight work, so its stamp is never
   equal to any one checkout. The guard is right to refuse a build I did not
   mean to measure — but "verify my landed work in the integrated world" is a
   different, legitimate question, and there is no way to ask it. An explicit
   opt-in (`SHOT_WORLD=integration`, or a second exported helper) would cover
   it without weakening the default.

   I checked mine by hand instead, which is why this is a gap and not a
   blocker. In the :5177 build (`eeb9a3ab`): the three car variants all build
   without throwing (12 / 9 / 16 meshes), 24 cars are placed exactly as in my
   worktree, and all six walkers moved 2.25–5.67 m over four seconds. The only
   page error is Vite's HMR socket, which is `live-integrate.sh` rebuilding.

   One note on that check, because it nearly became a false report: my first
   pass read `moving: 0` walkers and looked like six frozen people. `walkers()`
   publishes **only x and z** — no velocity — so I had measured a field that
   does not exist. Ask the world what it publishes before believing a zero.

---

*Written 2026-07-25. My queue file (`notes/queues/H-traffic.md`) still shows 14
unchecked boxes; all are landed and waiting to be retired. Handoff:
`notes/feat-traffic.md`. Decisions above are the only open work I own.*
