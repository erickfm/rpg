# w54 — item 140, the prompt churning while you turn at the 301 doorway

*"still feels weird to look around at the door frame to my room. idk what
changed but it seems like a recent change. not on click behavior or anything.
its just from looking around."*

**Handed back. Reproduced, root-caused and measured; the fix is written and
NOT landed, because the constraint set the item states is unsatisfiable and the
call is the desk's, not mine.**

Port used: **4185** (proved free — `curl` returned `000`; 4186 was already
serving someone else). Shut down at the end of the session.

---

## Root cause, one line

**Item 85 split the near tier in two and inserted `bestLooked` *between the
halves*, so a spot you are standing at now loses the prompt to anything inside
`reach` (6 m) the moment your crosshair crosses it.**

`git show 426eb7646 -- src/proto/fp.ts`:

```
-  return bestNear ?? bestLooked;
+  return bestNearLooked ?? bestLooked ?? bestNearOnly;
```

Before item 85, anything you were **touching** beat anything you were merely
aimed at, so **the prompt could not change while you stood still and turned**.
END TWO — *"i dont want sit on bed and watch tv to be the main option if im
facing the door"* — only ever needed `bestNearLooked` above `bestNearOnly`, i.e.
aim deciding **among the spots you are touching**. Moving `bestLooked` above
`bestNearOnly` was a second, unrequested change, and it is the one he felt.

The desk's suspicion of item 85 was **right**. Its prescription (*"the fix is
hysteresis or a dead-band on tier changes"*) was **wrong** — see below.

---

## Reproduced, with counts

New instrument, `scripts/probes/w54-turn-stability.mjs`: stand still on each
standable cell of flat 301, sweep yaw through 360°, and count **how many times
the prompt CHANGES**. One is perfect; three or more from a standing start is the
complaint. A count, so it transfers to his machine — no frame times here.

**Mainline today:**

```
        4 8 2 6 0 4 8
z -17.4   # # # # 4 # #
z -17.0   # # 3 4 4 # #
z -16.6   3 4 4 4 1 2 2
z -16.2   3 3 4 1 1 6 #
z -15.8   # # # # # 6 #
z -15.4   # # # # # 3 #

mean changes per turn   3.26      worst cell   6
cells with >= 3 changes  14 of 19  (74%)
```

The concrete case, from `scripts/probes/w54-doorway-yaw.mjs` — standing 0.5 m
inside his own door, **inside its touch circle**, one full turn:

```
  -108° … 189°  (300° wide)  close the door
   192° … 219°  ( 30° wide)  sit on the bed and watch TV
   222° … 249°  ( 30° wide)  sleep until morning
```

Turning past the bed hands him **`sleep until morning`, a spot 2.13 m away
across the room**, while he is stood 0.50 m from the door.

---

## The desk's prescription is wrong, and the measurement says so

*"The fix is hysteresis or a dead-band on tier changes."*

**No.** The bands above are **30° wide** and there are **zero A→B→A reversals**
at any station. Nothing is flickering — the resolver is settling on a genuinely
different spot for a third of the turn. A dead-band would have added lag to a
wrong answer instead of correcting it.

---

## Why no static rule can satisfy both ends — this is the finding

Two poses must disagree, and they are almost the same measurement:

| | touched spot | aimed-at spot | must win |
|---|---|---|---|
| **(A)** item 140, at the doorway | door, **d 0.50**, offAxis ~150° | `sleep`, **d 2.13**, offAxis ~0° | the **touched** one |
| **(B)** item 85, beside the bed | bed, **d 0.59**, offAxis ~21° | door, **d 1.80**, offAxis ~0° | the **aimed** one |

The touched distances (0.50 / 0.59) and both aimed candidates (2.13 / 1.80 at
offAxis ~0) are near enough to swap under any threshold. **No ordering and no
static key over distance-and-angle can return opposite answers here.** Tried and
measured, not argued:

- **strict reorder** (`nearLooked ?? nearOnly ?? looked`) — buys (A), sells (B)
- **merged tier ranked by distance** — buys (A), sells (B)
- **merged tier ranked by offAxis** — buys (B), sells (A)
- **ratio threshold** (aimed/touched > K) — needs K in (3.05, 4.31): a constant
  fitted to two samples, which is the habit BUILDER-BRIEF §8 exists to stop

The one variable that separates them widely is the **offAxis of the touched
spot** — ~150° against ~21°, i.e. *behind you* versus *just off your aim*. I
implemented that as a fourth tier (sign of the forward dot product, no new
constant) on the reasoning that the aimed tier exists so you can *look past* a
near thing at a far one, and there is nothing to look past when the thing is
behind your shoulder.

**It measured worse and I threw it away.** Mean changes per turn **2.74** (vs
3.26 mainline, 1.42 for the plain reorder), worst cell still 6, unstable cells
8/19 — **and `w40-bed-vs-door` was still red**. The reason is exactly on-topic:
the test introduces a **new ±90° boundary that the player crosses twice per
turn**, so it adds swaps to the very motion the item is about. Reported because
it is the kind of idea the next person will also have.

---

## The candidate fix, held at `notes/w54-item140-candidate.patch`

`return bestNearLooked ?? bestNearOnly ?? bestLooked` — keep item 85's fix on
top, put touching back above merely-aimed-at.

**Flat 301, turning:**

| | mainline | candidate |
|---|---|---|
| mean changes per turn | 3.26 | **1.42** |
| worst cell | 6 | **3** |
| cells with >= 3 changes | 14/19 | **2/19** |

The two residual cells **touch nothing at all**, so every candidate is an aimed
one and the prompt *should* follow the crosshair. The probe prints the touch
count beside each, so that stays evidenced rather than argued.

**Blast radius, whole world** (`scripts/probes/w40-resolver-map.mjs`, 281
stations × 3 offsets × 8 headings): 53,952 poses, 6,849 changed, of which
**5,078 are invisible same-label index swaps** (casino slots, diner booths);
**1,771 (3.28%) change the prompt text**; **0 poses lost their offer** and **no
spot became unreachable**.

### Why it is NOT landed

`w40-bed-vs-door.mjs` goes red on **one** assertion — and *not* the band walk
that carries the user's END TWO quote, which stays green at every stride:

```
  ok    END TWO: walking out facing the door, the DOOR is offered at every stride
  ok    AIM: walking the SAME band facing the bed, the BED is offered at every stride
  FAIL  the offered door actually acted (sit on the bed and watch TV -> ...)
```

`scripts/probes/w54-firing-station.mjs` replicates that step's navigation and
locates it:

```
FIRING STATION  (198.36, -15.97)
  to bed    0.59 m   TOUCHING
  to door   1.80 m   not touching
  projection on the bed->door axis: -0.50 m of 1.27
  => the player is on the FAR SIDE of the bed, with the bed between him and the door
```

**The check logs this station as "the middle of the band" and it is 0.50 m
beyond the bed on the far side, outside the band entirely** — it walks forward
while still facing the bed at the end of the inward band walk, which carries it
through. That is a navigation bug in the check.

**But the pose is still arguably inside END TWO's words** (*"if im facing the
door to leave"*), so this is a judgement about what the user meant, and
BUILDER-BRIEF says the desk verifies and the builder does not confirm its own
work. Landing a change that turns a check the item named as a hard gate red
would be shipping a known regression against instruction, so I did not.

**To land it:** `git apply notes/w54-item140-candidate.patch`.

---

## Found and NOT fixed

1. **`w40-bed-vs-door.mjs`'s firing station is not where it says it is** — it
   claims "the middle of the band" and stands 0.50 m past the bed on the far
   side, because it walks forward while still facing the bed. Fixing its
   navigation would make it test what it claims **and** make the candidate
   green. **I did not touch it: the item names `fp.ts` only, and BUILDER-BRIEF
   §9 says a file the item does not name is a stop-and-report.** It also needs
   someone other than me to decide, since it is the check that judges my patch.

2. **The bed carries two independently aimable spots 1.52 m apart** —
   `sit on the bed and watch TV` (r 0.70) and `sleep until morning` (r 0.75).
   Panning across **one piece of furniture** from the doorway therefore yields
   **two different prompts** (the 192–219° and 222–249° bands above). Even with
   the candidate landed, that is two of the remaining changes per turn. This is
   an authoring question in `ct/apartment.ts`, not a resolver one, and that file
   is not named by this item.

3. **Item 85's tier comment in `fp.ts` describes tiers that the code no longer
   orders the way the prose implies** once anyone edits this again — the comment
   is excellent and long, and it is now the only record that `bestLooked` sitting
   in the middle was a deliberate-looking accident. The candidate patch rewrites
   it; mainline still has the old text.

## Derived vs copied

Every constant is **imported from the world's own `fp.ts`** at runtime by the
probes (`TOUCH_MARGIN`, `RADIUS`, `lookTolerance`) — nothing retyped. Spot
positions and radii come from `window.__ct.spots()`. The only hand-written
numbers in this note are measurements printed by the probes.

## Instruments added

- `scripts/probes/w54-turn-stability.mjs` — changes-per-360°-turn over a grid of
  flat 301, with the touch count for every unstable cell. **The metric that
  matches his words**; reusable for any future resolver change.
- `scripts/probes/w54-doorway-yaw.mjs` — the yaw→prompt table at one station,
  with run widths and A→B→A reversal counting.
- `scripts/probes/w54-firing-station.mjs` — locates `w40-bed-vs-door`'s firing
  station and says which side of the bed it is on.
