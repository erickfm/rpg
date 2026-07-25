## audit/seams — lane audit: nothing impassable, and the baseline is the finding

Queue `## Now` (new top item). Base `a7d228d5`.
Report: `notes/lane-audit.md`. Instrument: `scripts/lane3.mjs`.

Touched:   notes/lane-audit.md (new), notes/audit-seams.md, scripts/lane3.mjs
           **nothing under street/src/**

### Result

Measured against `__ct.colliders()` — the array `fp.ts` actually tests — so a gap
under 0.72 m means the player is physically stopped. **Nothing on the block is
impassable and nothing is urgent.** Tightest point anywhere: **0.89 m**.

**The finding that matters is the baseline, not the instances:**

> **The clear lane is 1.70 m, not 2.00 m, before anyone puts anything on it.**
> Every building's collider is registered at `FACE − 0.3` — 0.30 m inside its own
> facade. 15 % of the sacred 2 m is consumed by collision corresponding to no
> geometry, everywhere, permanently.

That is the **same 0.30 m inset** behind interior finding 18 (six of nine door
triggers inside solid). **One fix closes both**, and it is worth more than every
instance below combined — give it back and every figure gains 0.30 m.

| clear | walk | at | pinched between | owner |
|---|---|---|---|---|
| **0.89** | west | z −92.9 | park wall/hedge ∣ lamp post | E + B |
| **0.90** | west | z −71.4 | park wall/hedge ∣ tree trunk | E + B |
| 0.95 ×6 | both | every lamp | building wall ∣ lamp post | B |
| 0.96 ×4 | both | every tree | building wall ∣ tree trunk | B |
| **1.01 over 1.8 m** | east | z −34.1 | **car-lot A-board** ∣ wall | `ct/lot.ts` |
| 1.11 | east | z −5.9 | shopfront projection ∣ wall | D |

Rows 3–4 are the block's **normal** condition, not encroachment. Rows 1–2 are the
park, only 0.06 m worse than normal. **Row 5 is the one new object genuinely
making things worse** — the A-board sits hard against the kerb and holds the lane
at 1.01 m for 1.8 m, the longest sustained pinch on the block.

**The park's bin — the object in the user's report — is not the constraint.** It
has a collider and 0.26 m of it is on the walk, but it stands where the park has
railings rather than wall, so it leaves **1.74 m**: wider than a normal stretch
of building. It looks like it is in the lane and measurably is not.

### Permanent test: yes, and it is cheap

The lane is a **global invariant violated by local edits** — five builders added
furniture today and none can see the others' work. An audit tells you about the
day it ran; this needs a test.

For **A** (`scripts/**`):
- **No new export needed** — `__ct.colliders()` is already exposed at
  `crosstown.ts:508`. That is what makes it a two-second check.
- Assert **min static gap ≥ 0.80 m**, warn under 1.00 m. Today passes at 0.89.
- **Also assert the baseline** (kerb-to-wall, currently 1.70 m) — that catches a
  regression in the inset itself, which no per-object check would see.
- **Sample the collider list twice and drop movers.** Citizens carry a ±0.25 m
  box and walk the lane; my first run produced **six spurious URGENT hits** that
  evaporated on a second sample.
- Lift `scripts/lane3.mjs`; ~2 s, no screenshots.

Desk judgement call: at the current inset, six lamps and four trees sit
permanently at 0.95 m, so a ≥ 1.00 m assert fails on landing against furniture
nobody wants moved. Either assert 0.80 now and tighten later, **or fix the inset
first and assert 1.00 immediately — I would do the latter.**

### Two false-positive classes, recorded because they will bite the test too

1. **Moving colliders.** Six of 164 are citizens and traffic. Sampled once, a
   pedestrian near the kerb reads as a 0.75 m URGENT pinch.
2. **Walk-based probing does not work here.** My first instrument walked the
   player across the lane; warping to the building face puts them *inside* the
   wall, so face-outward numbers are meaningless. Calibrating on empty pavement
   is what exposed it — the numbers looked plausible (a recurring "0.41 m") and
   were an artifact. Deleted rather than shipped.

Left:      Colliders only — overhangs without colliders (bunting, fascias,
           stallrisers, sign boards) cannot narrow the lane but can look like
           they do, and the user's complaint was partly visual. Separate job.
           Sampled every 0.10 m along the run.
