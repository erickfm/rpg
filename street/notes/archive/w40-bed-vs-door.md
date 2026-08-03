# w40 — item 85: the bed beating the door in flat 301 (fp.ts `pickSpot`)

Port used: **4188** (proved free with `curl` → `000` before starting; dev
server shut down at the end).

## Root cause, in one line

The bed seat and the door spot in flat 301 stand **1.27 m apart** while their
aim-free touch circles reach **0.85 m** and **1.10 m**, so the circles overlap
across nearly all the standable floor between them — and inside that overlap
both spots are `near`, `pickSpot`'s near tier ranked by **distance alone**, and
the bed is simply the closer one.

## The item's premise was right, and there was a third offender it did not name

The item's diagnosis held up — unusually, given the record. `fa5c32e01` did give
the near tier an outright win, and that is what the user is now hitting from the
other side. Reproduced from his own position before changing anything
(`scripts/probes/w40-301-grid.mjs`): **10 of 19 standable cells around the bed
offered the bed while the player faced the door.**

What the item did not mention is that **the bed seat is not the only offender**.
`scripts/probes/w40-301-who.mjs` prints the tier arithmetic per cell and turns up
a third spot, **"sleep until morning"** (r 0.75), winning at **174° off-axis**
over a door that is squarely aimed at 2.0 m away. A fix confined to the two
spots the item names would have left the complaint half-standing.

## What changed

`src/proto/fp.ts`, `pickSpot()` — two tiers become three:

```
tier 1  STANDING IN IT, OR TOUCHING AND AIMED AT   ranked by distance
tier 2  AIMED AT                                   ranked by screen centre, distance breaks ties
tier 3  TOUCHING, AIMED AWAY                       ranked by distance
```

The facing gate is the **existing `looked` flag** — the same `lookTolerance`
cone the rest of the resolver already uses — not a new angle constant that could
drift away from it. Ordering *within* each tier is untouched.

`RADIUS` (the player's own collision capsule, 0.36 m, imported from the top of
the same file) is what makes tier 1 hold: if a spot's centre is inside your own
body, no heading points away from it and the spot is unbeatable.

## The thing I got wrong first, and the check that caught it

My first cut rested tier 1 on the existing `d < 1e-4` degenerate-offAxis clause,
reasoning that a spot you stand ON has `offAxis` 0 by construction, so it is
always `looked`, so it is always tier 1.

**That reasoning is false in the world.** The rig's `unstick` nudges you off the
exact point: warping onto the 301 door's own stand-point lands you **0.060 m**
away, not 1e-4, so the clause never fires. Measured cost of that version:

| | before item 85 | aim-outright (rejected) | shipped |
|---|---|---|---|
| `w9-reach-repro.mjs` | PASS | **FAIL** | PASS |
| `seats-walk.mjs` | 115/219 | **69/219** | **103/219** |
| 301 cells offering the bed while facing the door | 10/19 | 0/19 | **3/19** |

Those 46 seats are the wrong-bench bug `seats-walk` exists for, shipped once
already at `098269aa`. `seats-walk` stations the player at **yaw 0** and never
faces the seat, so with aim outranking a spot you are standing on, a seat across
the room took the press — *"sat at 678.43,-2.77 but the seat is at 678.41,-0.17"*.

**The 3 cells that still offer the bed while facing the door are the cells where
the bed's centre is inside the player's own capsule** — i.e. standing on the bed
itself, where "sit on the bed" is the right answer and `seats-walk` asserts
exactly that for every other seat in the world. That is the residue I chose, and
it is the price of not re-opening the wrong-bench bug.

## What I walked

`scripts/w40-bed-vs-door.mjs` (new check, registered in `checks.mjs` and with two
`canfail` cases). It **walks**: in from the doorway to the bed by holding `W`
through real collision, then **out again facing the door reading the prompt every
stride**, then back in facing the bed, then w9's doorway pose. Headings are
driven with the arrow keys, which reach `rig.yaw` through the same line the mouse
does (`fp.ts:427-429`). Warping is used only to enter flat 301 and to reach
station 3's stand-point — travel, not the subject. Every wait ends on world state
(position, yaw, prompt), never on a wall-clock guess.

It pins **both ends and the band between them**:

- **END TWO** *"i dont want sit on bed and watch tv to be the main option if im
  facing the door to leave"* — walking out facing the door, the door is offered
  at every stride (3 strides sampled inside 0.36–0.85 m of the bed).
- **AIM** — the same band walked facing the bed offers the bed at every stride
  (4 strides). Without this, END TWO is satisfiable by breaking the bed seat.
- **END ONE(a)** *"i dont want to be so far from the bed…"* — at 1.31 m, facing
  away, the bed is not offered. The distance is asserted **first**, so the
  absence cannot be satisfied by never having left the doorway (GOTCHAS 71).
- **END ONE(b)** — standing on the door's stand-point facing the bed, the door
  still wins. This is w9's repro, and it is what goes red if anyone makes
  `looked` dominant outright.

Both offers are also required to **fire**, not merely be named: held `E`
(`down` → 90 ms → `up`) flips the door close→open and seats the player on the bed.

## Red and green, both watched

- `w40-bed-vs-door.mjs` green, **exit 0**, immediately before the mutations —
  without that, a case against an already-failing check self-certifies on any
  non-zero exit (GOTCHAS 72).
- `canfail.mjs w40-near-outright w40-looked-dominant` → **2/2 CAUGHT**, every
  mutated file restored byte-for-byte. One case per end of the knob, because
  either complaint can be "fixed" by reintroducing the other and a single case
  would certify half a guard.

## Blast radius

`scripts/probes/w40-resolver-map.mjs` imports the world's **own** `/src/proto/fp.ts`
into the page and calls the real `pickSpot` over 281 stations × 3 stand-offs ×
8 positions × 8 headings = **53,952 poses**, before and after.

- 21.5% of poses resolve differently, but **9,126 of those are same-label index
  swaps** among the casino's ~70 identical "sit at the slot" spots — invisible to
  the player.
- **4.60% change the prompt text**, all in the same direction: the thing you are
  aimed at now beats the thing you are merely standing near.
- **0 poses lost their offer entirely**; 0 gained one.
- **Spots winnable from at least one pose: 259 before, 259 after. None became
  unreachable.**

(Those figures are for the aim-outright cut; the shipped version is strictly more
conservative, so its diff is a subset.)

## Other verification

- `npx tsc --noEmit` — clean.
- `scripts/A-verify-301-door.mjs` — exit 0, door opens and closes from **both**
  the room side and the landing.
- `scripts/D-look-selects.mjs` — 12 pass, 0 fail, 1 pre-existing skip.
- `scripts/D-confirmed-prompts.mjs` — 15/15 pass.
- `scripts/w9-reach-repro.mjs` — PASS.
- `npm run fp before` → change → `npm run fp after` → `npm run fpdiff`:
  **textures, structure and tints all IDENTICAL** (1461 textures, 8324 objects);
  `places` differs on **2** meshes, both with a partner within 5 cm — pigeons
  drifting, under the 4–6 noise floor. The world did not move.
- `node scripts/bugsweep.mjs` — 96 shots, **0 STATION MISS, 0 COVERAGE**, exit 0.

## Found and NOT fixed

- **`scripts/w40-227-frame.mjs` — w9's stated justification for the outright near
  tier does not reproduce.** Its note defends the tier with *"a door you were
  STANDING IN stopped being offered because something across the street was
  nearer the centre of the screen — measured, at the No. 227 frame"*. Measured
  today from that frame, at 0.00 m and at the 1.15 m facade-cushion stand-off,
  across 16 headings: **`enter No. 227` is the only candidate in every pose** —
  nothing near, nothing looked, no competitor at all. The tier is still right,
  but for the flat-301 reason, not that one. Worth a row only if someone leans on
  that sentence again.
- **THE 12 SEATS I DID NOT GET BACK — the one thing on this item I would put in
  front of the user before the desk closes it.** `seats-walk` goes 115 → 103,
  and every one of the 12 is the same shape: the check stations the player at
  **yaw 0**, `standableNear` happens to pick a point with the seat *behind* them,
  and something else is squarely in front. Seven read

  > `no "sit down" prompt from the one standable point (600.78,1.14); got "[E] order fries — $0.99"`

  which is the new rule working as asked — you are facing the counter, so you
  are offered the counter. **Five are sharper and I am not comfortable with
  them:**

  > `sat at 599.46,-1.22 but the seat is at 598.9,1.68`

  i.e. `[E]` seated the player at a booth **2.95 m away** because they were
  aimed at it while 0.54 m from a stool. That is defensible by the same
  principle (`D-look-selects` deliberately validates selecting a bench by gaze
  at 3 m and 5 m), but "press E beside a stool, get teleported across the
  diner" is close enough to the wrong-bench bug `seats-walk` was written for
  that **it should be a user call, not mine.**

  I did NOT loosen `seats-walk` to make them pass, and I did not invent a
  distance ratio to special-case them — every shape I could find that recovers
  these 12 also re-opens item 85 (a "looked candidate must not be much further
  than the touched one" rule with any threshold over ~1.1 m puts the bed back at
  the cell 0.45 m from it). If the user dislikes the teleport, the honest fix is
  in the DINER's seat/approach geometry, not another swing of this knob.

- **`seats-walk.mjs`'s pre-existing failures.** Baseline on this checkout is
  **115/219** before I touched anything; the ~104 failures are not mine and I did
  not classify them. Flagging so the number is not read as new breakage.
- **`seats-walk.mjs` stations the player at `yaw 0` and never faces the seat**
  (`await warp(stand.x, stand.z, 0, 0)`). That is why it is so sensitive to any
  aim-vs-proximity change, and it means it cannot currently distinguish "the
  right seat was offered" from "the seat that happened to lie along -z was
  offered". Not mine to change — it is not named by this item — but it is the
  single biggest reason this item was hard to verify.
- **`REACH_MARGIN = 0.6` is still cited in `int-hotel.ts:176`, `int-jail.ts:122`,
  `int-casino.ts:257`** for landing clearances, though the real aim-free margin
  has been `TOUCH_MARGIN = 0.15` since 26 Jul. w9 flagged this too; still stale.

## Derivation

Everything the fix and the check compare against is **imported, not retyped**:
`RADIUS` and `TOUCH_MARGIN` come from `fp.ts` itself (the check pulls
`/src/proto/fp.ts` into the page), the resolver differ calls the world's own
`pickSpot` rather than a model of it, and the room's two spots are read from
`__ct.spots()`. A hand-typed `0.36` in the check would have kept passing after
someone changed the player's capsule.
