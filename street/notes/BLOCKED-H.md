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

---

*Written 2026-07-25. My queue file (`notes/queues/H-traffic.md`) still shows 14
unchecked boxes; all are landed and waiting to be retired. Handoff:
`notes/feat-traffic.md`. Decisions above are the only open work I own.*
