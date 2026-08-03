# eightyseven / item 235 — the park mound goes to MND_H 0.570

**The user:** *"try to add some y diversity here. the height is **soooo** flat."*

**The change is one number.** `src/proto/ct/park.ts:796` — `MND_H` 0.485 → 0.570,
the dial item 172's builder measured, priced and offered. The desk took the
trade. Everything below is measured on the **built bundle** (`vite preview`,
port **4430**), stamped with the committed SHA `2bd63c476`.

---

## Every figure item 172 reported, re-swept

`scripts/probes/w83-park-relief.mjs`, 0.2 m grid, **24,311 of 24,311 samples**
over the 32 × 30 m site (population floor 10,000).

| | before 172 | item 172 shipped | **now (235)** |
|---|---|---|---|
| **RANGE** | 0.366 m | 0.568 m | **0.653 m** |
| **GRADE** | 1 in 9.4 | 1 in 9.4 | **1 in 8.0** ← the cost |
| **STEP** at the grass/path join | 0.3 mm | 0.0 mm | **0.0 mm** |
| **FLOOR** | 0.140 m | 0.057 m | **0.057 m** |
| mound height | 0.30 m | 0.485 m | **0.570 m** |
| canopy tops | 6.76–9.54, sd 0.97 | 5.77–10.73, sd 1.73 | **5.77–10.73, sd 1.733** |

**RANGE is +15% on item 172 and +78% on the park the user complained about.**
GRADE is the only figure that got worse, which is the trade the desk bought
explicitly. STEP and FLOOR are untouched — the hard constraint held.

The canopy figures are **unchanged by design**: this item moved ground, not
trees. What moved is what the trees *stand on* — `stands on` max 0.62 → **0.71 m**,
exactly the +0.085 the mound gained. The sd wobble 1.731 → 1.733 is the one
tree on the mound rising with it.

**The prediction was exact.** Item 172 priced `0.570 → 1 in 8.0, range 0.653 m`
and the sweep returned 1 in 8.0 and 0.653 m. That is the landform primitive
behaving linearly the way its comment claims.

## I trusted the instrument only after it earned it

`--selftest` **GREEN on all three grounds** before any number about the park was
believed — ramp reads 1 in 8.00, cliff reads 250 mm of step, and **flat reads
RANGE 0, GRADE infinite, STEP 0**. The negative case is the one that matters: a
probe that invents relief on level ground makes a fix look done.

Then the **baseline reproduced item 172's report exactly** on the unchanged
world — 0.568 m, 1 in 9.4, 0.0 mm, 0.057 m, canopy 5.77–10.73 sd 1.73. An
instrument that agrees with an independent prior measurement of the same world
is one whose *delta* I can believe.

## Walked, not screenshotted

`scripts/probes/w83-park-walk.mjs` — **25 legs, GREEN.**

- **All four approaches climb the crest:** north **+0.384** m, south **+0.535**,
  west **+0.552**, east **+0.349** (item 172: +0.329 / +0.388 / +0.470 / +0.302).
  Every one gained more than it did before, which is the whole point.
- **crest floor 0.710 m** (was 0.625).
- eye/floor drift **0.045 m** against a 0.060 tolerance — the player rides the
  ground, he does not float over it or sink through it.
- **step over grade 0.0000 m.** Nothing to trip on.
- 5 legs stopped against a **registered** prop, which the harness checks against
  `__ct.colliders()` before calling anything a fault. 0 console errors.

## The seat on the mound still works — checked, because the ground moved under it

`scripts/probes/E-seat-mound.mjs` exists precisely to be re-asked after a relief
change, and item 172 flagged this bench as found-and-not-fixed. **6 of 6 PASS:**
registered seat at −21.48,−84.20; floor under it **0.602 m** (0.51 before item
172); it is offered when you walk up; you sit; the camera followed the ground up
(1.77 over a 0.60 floor); **and you stand up clear of it.**

`bench()` derives `y0` from `parkY` — the world's own floor function — as the
**minimum of three points along its length**, so it rides terrain automatically
and no leg floats. Nothing had to be touched for the bench to follow the mound.

## Regression guard on the shared site builder

`Site.displace` serves the park, the lot and the jail. Both re-run:

- `SITE=lot` → **RANGE 0.000 m, 1 in Infinity — dead flat**, identical to 172.
- `SITE=jail` → RANGE 0.140 m and the **same pre-existing 0.14 m step at
  x 57.00 z −96.00**, the site boundary where the forecourt meets the roadway.
  Item 172 recorded it; it is unchanged and **not mine**.

## Shots I personally looked at

`shots/w83-park-{gate,inside,crest,oblique,dish}-w87-235.png` — 0% black, 0
console errors, SHA-stamped `2bd63c476`.

**My verdict.** The **crest** view is still the one that sells it: you are
plainly standing above the lawn, the ground falls away toward the gate, and you
read the church and the street over the fence line. No z-fighting on the grass.
The **oblique** view shows the bank climbing away from the path kerb clearly.

**The honest caveat: from the gate — the vantage the user actually
screenshotted — the gain is real but modest.** The crest is 6 m in and behind
the fence and the tree line, so most of the 85 mm lands where he is not standing
when he complains. The lawn does read as rising rather than flat. If he says
"still flat" from that spot, the answer is not another turn of this dial (see
below) — it is draping the loop.

## Suite

`npm run sweep` **96 shots, 0 STATION MISS, 0 COVERAGE**. `node scripts/health.mjs`
**WORLD OK, exit 0**, measuring build `2bd63c476`. `npx tsc --noEmit` **clean**.

## Found and not fixed

- **⚠ THIS DIAL IS NOW ALMOST OUT OF TRAVEL, and the next person will not see it
  coming.** Peak grade is `1.25 × MND_H / 5.7` = **0.125**, and the edge clamp
  `EDGE_G` is **0.13**. So **MND_H ≈ 0.593 is where the clamp stops being a
  no-op** and starts engaging across the field — flattening the *crest* rather
  than the rim, changing the landform's character while the headline numbers
  still look like they are improving. That is **derived arithmetic from
  `park.ts`'s own formula, not a sweep** — I did not turn the dial again to
  confirm it, because the item says not to chase more than the dial gives. It is
  written into the source comment so it cannot be missed.
- **The real ceiling is structural, and I agree with item 172 that draping the
  loop is the next move.** Relief must be zero where grass meets the level loop,
  so the run is confined to the **17.75 × 16.5 m field**, and a landform zero on
  a rectangle's boundary cannot exceed `grade × inradius` — near **1.0 m** at
  1 in 8, however it is shaped. We are at 0.653 of that. **Getting the rest
  needs the loop itself draped, which moves items 170 (benches) and 171 (the
  shelter).** The desk asked to be told if it is warranted: **it is, if the user
  says "still flat" from the gate again** — but it is a real piece of work, not a
  dial, and I did not start it under this row.
- The jail's 0.14 m boundary step, inherited and recorded above.
- Pre-existing red untouched: `[interior:hotel] NO BUILDING NAME`.

## Derived or copied

**Derived.** The only number I typed is `MND_H = 0.570`, which is the item's own
decision. Every figure in the tables above came from sweeping the world's floor
picker; the two comparison columns are quoted from
`notes/w83-item172-park-relief.md` and I **re-measured the "item 172 shipped"
column myself** on the unchanged world rather than trusting it. The 0.593 clamp
figure is derived from `park.ts`'s `1.25*h/(r1-r0)` and `EDGE_G`, both read from
the source, and is labelled as arithmetic.
