# w107 — item 278, the hand on the umbrella

Worker **onehundredseven**. Port **4188**. Measured on the **BUILT BUNDLE**.
`src/proto/ct/citizens.ts` and `src/proto/ct/crowd.ts`.

> Item 271's own handoff, on what it could not reach: *"both arms still hang at
> the sides, so nobody appears to be holding the thing."*

---

## What changed

**`Look.holdUp` — optional, defaults false.** That matters more than the pose
does: ten interiors, the hermit and the crowd all call `citizenAtlas`, and every
one of them inherits every field on `Look`. Omit it and this function paints
exactly what it painted before. It is a **pose, not a prop** — nothing about an
umbrella is drawn in `ct/citizens.ts`, and a figure carrying a box would use the
same field.

**The gate is one expression: `c.umb.visible`.** The row asked for the pose to be
derived from the umbrella's own open-ness rather than from a second condition
that can drift, and that line — computed immediately above — **is** the
umbrella's open-ness. The rain hysteresis, the storm ramp and the 0.02 floor are
all already inside it, so there is nothing here to tune and nothing to keep in
step.

**A second bake and a map swap.** Arms live in the atlas and an atlas is baked
once, so a pose that changes with the weather has to be a second bake. One extra
160 × 128 canvas per walker — the same price the construction loop already pays
for the first. **No `rnd()` draw is added:** `citizenAtlas` takes all its colour
from the `Look` and never touches the shared LCG, so the stream's order
(GOTCHAS §2) does not move and nothing built after the crowd is re-grained.

---

## Two things the SHEET caught that reasoning did not

The row says to verify by looking. Both of these were invisible in a street
frame and obvious the moment the sprite sheet was printed at 6×
(`scripts/probes/w107-sheet.mjs`).

### 1. Row 7 read as a SALUTE

The grip row is **derived**: `ct/crowd.ts` hangs the hem `UMB_CLEAR = 0.30 m`
above the crown and paints the grip `UMB_GRIP 30 − UMB_HEM 17 = 13` sheet rows
below it at `1.14/38 = 0.03 m` a row, so the grip sits `0.39 − 0.30 = 0.09 m`
**below the crown** — 3 frame rows at this plane's 0.0297 m — and the shaft is
in front of frame rows **−2 … 11**.

Row 7 is on that shaft and it is **level with the temple**. The fist landed in
the hair, dark on dark, and the forearm crossed the cheek:
`shots/w107-sheet-salute.png` is the wrong gesture drawn correctly.

**Row 3 is still on the shaft and is above the crown** (the skull starts at row
8, the hair and any cap at row 4), so the fist closes against the sky where it
is legible.

### 2. One eased sweep puts the forearm across the FACE

Shoulder → centre in a single interpolation crosses the head whatever the
easing, because the hand is inboard of the shoulder and the head is in between.
Squaring `t` moved the elbow and changed nothing about that.

**Two segments instead:** the upper arm goes straight up **outside** the head's
silhouette to the crown, and only the forearm turns in, above everything. That
is also what the limb actually does.

**And the raised arm is drawn LAST**, after the head, hair, cap and hood — arms
come before the head in this function, so the limb would otherwise vanish behind
the skull and the fist would lose its bottom row.

---

## The four constraints the row said must survive — all do

| | |
|---|---|
| billboard, not a sixth painted view | untouched — nothing in `ct/crowd.ts`'s umbrella drawing changed |
| colours indexed, **never** `rnd()` | no random draw added anywhere; `UMB_CANOPY` untouched |
| rows are fractions of `UMB_PX` | untouched |
| px/m matched to the citizen | untouched — `UMB_M`/`UMB_PX` not touched, still 33.3 vs 33.7 |

**Cited, not imported.** `UMB_GRIP`, `UMB_HEM` and `UMB_M` are quoted in
`HOLD_ROW`'s comment because `ct/crowd.ts:3` imports `ct/citizens.ts`, so
importing back closes a cycle and GOTCHAS §28 drops a cycled module from the
**built bundle only**. The probe measures the fist against the world instead.

---

## How it was proved

| | |
|---|---|
| `scripts/probes/w107-umbrella-hand.mjs` | **10/10, five runs, zero spread** |
| `npx tsc --noEmit` | clean |
| `node scripts/health.mjs` | `WORLD OK`, exit 0 |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE** |
| `node scripts/crowd-walk.mjs` | **all crowd checks pass**, tightest gap past a stopped citizen 1.92 m |
| `node scripts/people-walk.mjs` | 35 atlas figures, **no hand-drawn people anywhere** |

### I watched it fail, including the pass that would have lied

| mutation | result |
|---|---|
| **A** — bake `texUp` with `holdUp: false` | **9/10**. **Nine of the ten assertions still passed on a world where nobody has a hand up** — the flag flips, the map swaps, the UVs animate, and the pose does not exist. Only the texel count caught it (`36 vs 36`). |
| **B** — write the view onto `c.tex` while the mesh wears `c.texUp` | **9/10**, `1 distinct UV state over 8 samples` — a walker frozen on whatever way he faced when the rain started |

Mutation A is the whole reason section 4 exists, and it is worth stating
plainly: **every behavioural assertion I wrote first would have passed a world
with no pose in it.** `holding` is a boolean this code sets and reads. The only
check that can fail on a bodged pose is the one that counts opaque texels above
the crown on the sheet the mesh is **actually wearing** — 51 holding against 36
hanging.

---

## Two instrument faults of my own, both in the same family

Recording these because §7 says half of all "defects" here are the instrument,
and both of mine reported a fault in a world that was fine.

1. **I drove the weather by writing `scene.userData.rainHeavy`.** That is the
   OUTPUT — `updateRain` recomputes it every frame from the hour and the storm
   schedule, so the assignment is gone before the next tick. It reported *"0
   walkers with umbrellas in rain"*. Weather is `__ct.clock(h, 0)`, and **it
   never rains indoors while you are indoors**: `updateRain` gates on
   `px < 100` and the spawn is at x = 198 (GOTCHAS §79b, for the third time in
   this file's history).
2. **I counted frames at an easing storm.** A fixed `waitPainted(40)` after
   snapping to a dry hour read six canopies still up and called it a failure of
   the pose; the pose was right and the sky was still emptying. It polls now.
   GOTCHAS §30.
3. **The sheet probe grabbed the first 160 × 128 texture in the scene.** The
   interiors and the hermit paint citizens too, so the first match was somebody
   standing in a shop — it printed both arms hanging while six walkers outside
   had their hands up. It now matches the mesh to a **holding walker's
   position**. Item 271's note records the identical mistake in its own
   umbrella finder; I made it anyway.

---

## My own verdict on the frames

- **`shots/w107-umb-after-2.5m-2.png` is the one I would show him.** A woman in
  green under a green umbrella, side on, against a brick wall: the arm goes up
  clear of her head and the fist closes on the shaft. It reads, without being
  told, as somebody holding an umbrella.
- `shots/w107-sheet-holding.png` — all ten frames. The arm is outside the head
  on the way up and over it on the way in, on every view and both walk frames.
- `shots/w107-sheet-salute.png` — kept deliberately. It is what row 7 looked
  like, and it is the argument for why the row moved.
- `shots/w107-umb-after-4m-0.png` — **honest reservation.** At 4 m with the
  library's dark doorway behind him, the arm does not read: dark blue on dark
  brown, which is item 271's own "two dark silhouettes fuse" fault happening to
  the backdrop. The pose is correct in that frame and you cannot see it. **A
  raised arm is 3 texels; against a dark ground it will disappear.** If the user
  reports it still looks wrong, that is where to look — and the fix would be a
  rim on the raised limb, not a bigger arm.

## Found and NOT fixed — for the desk

1. **The raised arm is jacket-coloured against a jacket-coloured torso** for the
   rows below the shoulder. It only separates once it clears the head. A one-
   texel rim light down the raised limb would make it read at distance and
   against dark backdrops; it is a change to `ct/citizens.ts`'s shading and I did
   not make it without a frame from the user asking for it.
2. Item 271's second open finding still stands and I did not touch it: **the
   canopy tops out around 2.5 m** and nothing has swept the block's soffits for
   anything hung lower.
