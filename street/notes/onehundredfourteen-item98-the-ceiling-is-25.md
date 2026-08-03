# Item 98 — the look cone's ceiling is 25°, both numbers, and the one thing it cost

Queue worker **onehundredfourteen**, 2026-08-03. **Fifth claim on this row and
the first that changed `src/proto/fp.ts`.** Everything below is measured on the
**built bundle** (`vite preview`, port **4482**, checked free with `ss -ltn` and
bound with `--strictPort`), **before and after, with the same instrument on the
same tree** — the before-runs were taken by reverting `fp.ts` to `HEAD~1`,
rebuilding, measuring, and restoring.

Read `notes/ninetytwo-item98-the-plateau-is-the-clamp.md` if you want the
history. Its finding — *the clamp IS the binding constraint below 4 m* — is what
made this a one-line change, and it reproduced here digit for digit before I
touched anything.

---

## What changed

`src/proto/fp.ts`, `lookTolerance`. One line, plus two exports.

```ts
-  return Math.min(0.26, Math.max(0.20, raw));               // ~11.5° … ~15°
+  return Math.min(LOOK_CEILING, Math.max(LOOK_FLOOR, raw)); // ~11.5° … 25.0°
```

`LOOK_CEILING = 25 * Math.PI / 180` and `LOOK_FLOOR = 0.20` are now **exported**
rather than bare literals on the return line. That is ninetytwo's "FOR THE DESK"
item 3 and it is not cosmetic: **two workers read `atan2(r, d)` — the value
BEFORE the clamp — as this function's output**, and one inverted the row's premise
on the strength of it. The stale docstring that fed that mistake (*"31° at 2 m"*,
which is `raw`) is corrected in place.

**Nothing else moved.** Not `REACH_MARGIN`, not `TOUCH_MARGIN`, not the aim-tier
reach, not the predicate's form. Every one of those was prescribed by some
revision of this row and every one was withdrawn; I resurrected none of them.
**The floor stayed at 0.20 rad on purpose** — it governs small, distant spots,
where nobody has complained in either direction and where the measured edge
already tracks `raw` to within a degree. The user's decision was about the
ceiling.

---

## THE TWO NUMBERS THE ROW ASKED FOR

### 1. The dead ring — 2.70 m → **1.02 m**

`scripts/probes/w114-item98-deadring-width.mjs`, new, committed.

**A definition, because the row never had one.** A spot declares a radius `r`.
Inside `r + TOUCH_MARGIN` you get it aim-free. Outside that you must be aimed at
it, and the aimed test is an *angle*, so the lateral half-width it covers is
`d · tan(edge)`. When that is **less than the spot's own `r`** you can stand
inside the circle the world says the door occupies and be offered nothing:

> **DEAD RING** = the contiguous run of `d` outward from `r + TOUCH_MARGIN` where
> `d · tan(measuredEdge(d)) < r`.

Subject `"enter No. 227"`, r = 1.05, chosen the way eightynine chose it — by
measuring that it is **isolated** (no other spot within 8 m), so the prompt cannot
confuse *not a candidate* with *outranked*.

| | ceiling 14.90° | ceiling 25.00° |
|---|---|---|
| dead ring | 1.20 – 3.90 m | 1.20 – 2.20 m |
| **width** | **2.70 m** | **1.00 m** |
| distances covering less than `r` | 31 of 33 | 11 of 16 |

**Five runs after: 1.00, 1.00, 1.00, 1.10, 1.00 — mean 1.02 m, spread 0.10 m**,
which is one distance step of the sweep. Outer edge 2.20 m in four runs, 2.30 in
one.

**It is the number theory predicts, which is the check on the check.** The ring
ends where `d · tan(ceiling) = r`, i.e. at `r / tan(25°) = 2.25 m`. Measured
2.20–2.30. The prediction was written down before the sweep ran.

*Why the probe refuses rather than reports:* the oracle is shown to say **yes**
(standing on the subject) and **no** (3 m away, aimed 180° off) before anything is
believed; the sweep must contain **both signs** or the ring's outer edge is
outside the sweep and any width would be a lower bound, not a measurement; and the
population floor is **derived** from the world's own `r + TOUCH_MARGIN`, read off
`__ct`, not typed. My first cut of it reported **3.30 m where the ring is 1.00 m**
— past the ring the measured lateral sits within ±0.05 m of `r` while the 1°
angular step is worth up to 0.083 m, so "dead" and "live" alternate on
quantisation. That is why the ring is the *contiguous* run from the touch circle
and why the quantisation floor is printed on every run.

### 2. The median off-axis angle at selection — **0.1° → 0.0°**, and the tail improved

`scripts/D-offer-rate.mjs`, the instrument that produced the figures the user was
shown. One run each, ~270 stations:

| | 14.90° | 25.00° |
|---|---|---|
| something offered at all | 54 of 271 (20%) | 45 of 270 (17%) |
| **median off-axis of the winner** | **0.1°** | **0.0°** |
| 90th percentile | 135.0° | **89.9°** |
| worst | 180.0° | **153.8°** |
| offered while **> 15°** off aim | 31% | **20%** |
| offered while **> 25°** off aim | 31% | **18%** |
| walk: offers per 10 m | 0.28 over 216.2 m | 0.28 over 215.9 m |

**The direction of that tail is the opposite of what the row feared, and the
mechanism is plain.** The winners more than 15° off his aim were never the cone —
they are the aim-free proximity tier, which ignores facing by design. Widening the
*aimed* tier lets a well-aimed candidate exist in more poses, and a well-aimed
candidate **outranks** a merely-near one. So the sloppy winners get displaced
rather than joined.

**Caveat, stated because it is one run each:** 54 offers against 45 is a small
sample and I would not defend the 20%→17% "offered at all" difference. The
31%→20% shift in the >15° share is nine samples wide and is the figure I would
re-measure first if anyone wants to lean on it.

**And do not read the row's "5.2°" as this tree's before-number.** Measured here
on the 14.90° build the median is **0.1°**. The row's *quote* survived; its
*number* had rotted — BUILDER-BRIEF §6b happening on the row that wrote §6b.

---

## The plateau moved exactly as far as the ceiling did

`scripts/probes/w89-item98-what-bounds-the-ring.mjs`, eightynine's sweep, re-run
unmodified. Largest off-axis still offered, at 1°:

```
  d       1.5   2.0   2.5   3.0   3.5   4.0   4.5   5.0   5.5
  14.90°   16    15    15    15    15    15    13    12    11
  25.00°   26    25    23    19    17    15    13    12    11
```

- **The plateau is at the ceiling, wherever the ceiling is** — flat at 15 from 1.5
  to 4.0 m, flat at 25 from 1.5 to 2.2 m and then released to track `raw`.
  ninetytwo's model confirmed on a *second value of the constant*, which is more
  than fitting: it predicted where the plateau would end before it was moved.
- **Past 4 m the two builds are identical — 13, 12, 11.** The far corridor
  `D-look-selects` exists to protect did not move by one degree, because out there
  `raw` is already under both ceilings and the clamp is not in play.

---

## ⚠ WHAT IT COST, MEASURED, NOT WAVED AT

`scripts/w40-bed-vs-door.mjs` — the guard holding *"i dont want sit on bed and
watch tv to be the main option if im facing the door to leave"*.

**Five runs on each build, same session, same port:**

| | 14.90° | 25.00° |
|---|---|---|
| `w40-bed-vs-door` | **5 / 5 green** | **3 / 5 green** |

Both failures are the same assertion, *"the offered door actually acted"*, reading
`sit on the bed and watch TV` at the fire station. **This is real. It is not the
instrument, and I checked that first and was wrong.**

**What it is not.** `turnTo()` discards its return value at that call site, so a
turn that never landed would read exactly like this. `w114-item98-fire-turn.mjs`
re-runs that sequence with the same real key input and prints what the check does
not: **12 of 12 turns landed, worst yaw error 2.17°.** Hypothesis dead.

**Where the fire station actually is, which nobody had looked at.** The same probe
prints its geometry: **d(bed) 0.58–0.66 m, d(door) 1.78–1.83 m, 0.31–0.41 m off
the bed→door line.** That is *behind* the bed — the door's own touch circle
reaches 1.10 m, so the station is outside the overlap the check's own prose
describes. It gets there because the inward band walk leaves the player facing the
**bed**, and `walkUntil` then holds W straight into it; 0.55 m is reached by being
pushed off the bed, not by walking out. Its `ok:false` is discarded too.

**And from back there the bed is nearly on the line to the door.** With
|PB| 0.62, |PD| 1.81, |BD| 1.27 the cosine rule puts the bed **23–26°** off the
aim — **straddling the new ceiling**. That is why it is a coin-flip rather than a
clean break:

| walked fire station, 6 runs | 14.90° | 25.00° |
|---|---|---|
| did NOT offer the door | **0 / 6** | **3 / 6** |

**Everywhere else in that room, 25° is better, and by a wide margin.**
`w114-item98-fire-pose.mjs` warps to 180 poses — the whole contested band and a
±30° window of headings — so the heading is exactly what it claims to be:

| 90 poses each | 14.90° | 25.00° |
|---|---|---|
| **between** bed and door — *the pose he described, walking out to leave* | DOOR 61, bed 29 | **DOOR 71, bed 19** |
| **behind** the bed — the pose w40 fires from | DOOR 70, bed 18, none 2 | DOOR 72, bed 18, none 0 |

**Not one pose that named the door at 14.90° names the bed at 25.00°.** The ±20°
column flips wholesale to DOOR in the band between the two spots.

**So the trade, stated plainly, per the row's own instruction to say so rather
than trade silently:** in the band the user described — standing between the bed
and the door, leaving — the door wins in **10 more of 90 poses** than before. At
one pose *behind* the bed, 1.8 m from the door with the bed 24° off the aim line,
the bed now wins about half the time where it never did. **`w40` fires from that
second pose, and only from it.**

### What I did NOT do about it, and why

**I did not touch `w40-bed-vs-door.mjs`.** Moving its fire station to the station
its own label names (*"the middle of the band"*) would make it green, and I
believe that is the right fix — but a builder editing the guard that constrains
his own change is the exact move GOTCHAS 58 is about, and I am not the one who
should judge it. **The desk should queue it:** the walk that reaches the fire
station is entered facing the bed and should be entered facing the door, and
`walkUntil`'s `ok` and `turnTo`'s return should be asserted there as they are
elsewhere in the same file.

**I did not redesign the resolver.** The mechanism behind the flip is that tier 1
(`near && looked`) is ranked by **distance**, so a touched bed that is *barely*
inside the cone beats a door that is dead centre in it but not touched. Ranking
tier 1 by aim when `onIt` is false would fix it, and it would also put
`seats-walk`'s standing assertion at risk. **That is a design decision, not a
number the user chose**, and four workers before me were right to refuse to make
one unilaterally on this file.

**One thing I could not explain.** In the warped sweep the bed does *not* win from
behind at 25° even where it is inside the cone and touched — so something else
refuses it there, and my candidate is `canSee` failing through the bed's own
geometry (GOTCHAS 88). The walked player sometimes gets a line the warped one does
not. I did not chase it; it is the same unresolved thread as ninetytwo's §5.

---

## Also left alone

- **`crosstown.ts` is not named by this item** (BUILDER-BRIEF §9), so
  `LOOK_CEILING` is exported from `fp.ts` but **not published on `__ct`**.
  Queue it: one line, `lookCeiling: () => LOOK_CEILING`, beside `touchMargin()` at
  `crosstown.ts:1629`. My probes do not need it — they measure the edge and never
  predict it — but the next one will.
- **The `d = 4.00 m` null at `offAxis = 0`** reproduces on my tree (4 dead
  distances before, 5 after, both spanning 3.9–6 m) and is **unchanged by this
  item**. At `offAxis = 0` the tolerance term cannot fail, so it is not the
  ceiling. Still open, still `canSee`-shaped.

## The thing about this row worth recording

Four workers refused it and **every one was right to**. It carried four different
prescriptions at various times — cap the aim-tier reach, switch to
`d·sin(offAxis)`, widen the corridor, "the cone pinches shut" — and all four were
measured wrong before anyone implemented them. What unblocked it was not a better
diagnosis. It was **asking the user**, because the question was never *what is
broken* but *which of your two complaints do you want less of*. It became a
one-line change the moment it stopped being a judgement a builder was allowed to
make.

## Inherited state

`npx tsc --noEmit` clean. `node scripts/health.mjs` → **WORLD OK**, exit 0.
Console errors: **0** on every probe run above. Port **4482**.
Instruments left behind, all in `scripts/probes/`, all committed:

| file | question |
|---|---|
| `w114-item98-deadring-width.mjs` | how wide is the dead ring? both-signs self-test, derived floor, N runs |
| `w114-item98-fire-pose.mjs` | 180 warped poses: does the bed/door contest regress anywhere? |
| `w114-item98-fire-turn.mjs` | is `w40`'s fire station failing on the world or on its own turn? |
| `w114-run5-bedvsdoor.sh` | the row's "five runs" of the walk, one line per run |
