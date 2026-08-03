# item 115 — the library relayout, built and walked

Worker ninetyeight, 2026-08-03. Port **4540**. Commits `92a988a2a` (the room)
and `14da82777` (the walk). Verified on the **built bundle**, not dev.

> *"library is crowded in some areas and spacious in others. try a different
> layout thanks."* — 2026-08-02, `FEATURE-REQUESTS.md:2625`

Worker ninetyfour measured this room and released it un-built
(`notes/ninetyfour-item115-library-layout-scoping.md`, commit `2877a7660`). That
note is why this took one session instead of three — I started with numbers.
**Its measurements all reproduced exactly** in my tree: spread 47 points,
sd 10.6, 26 colliders, 10 seats.

---

## The result

`scripts/probes/w94-library-density.mjs` (ninetyfour's), built bundle, port 4540:

| | before | after |
|---|---|---|
| zone occupancy spread | **47 points** | **23 points** |
| sd across the 16 zones | **10.6** | **5.6** |
| densest zone | **47 %** | **23 %** |
| entrance row (z 5.5→11) | 6 / 3 / 6 / 7 % | **23 / 19 / 6 / 7 %** |
| the 47 % zone (x −5..0, z 0..5.5) | 47 % | **16 %** |
| colliders / footprint | 26 / 62.4 m² | 31 / 57.4 m² |

```
before                          after
z -11 | 19  20  13  15          z -11 | 14  15  10  15
z  -5 | 22  16   6  12          z  -5 | 20  14   5  12
z   0 | 15  47  15   0          z   0 | 13  16  15   0
z   5 |  6   3   6   7          z   5 | 23  19   6   7
```

**I did not chase this metric to zero and it cannot go there.** A 4 × 4 grid on
a 20 × 22 m room gives zones of 27.5 m²; the issue desk's collider alone is
9.1 m², so whichever zone holds it reads ~33 % no matter where it stands. Moving
a lump to sit on a grid line would have improved the number and changed nothing
for the player, so I did not do it. The number that mattered was getting the
*two* big objects out of *one* zone and giving the empty third something to be.

---

## Two root causes, both "a constant that was right stopped being right"

### 1. The desk was dodging a building that is not there any more

`DESK_Z = D/2 − 5.8`. The comment above it says why: at the older `D/2 − 2.5`
*"the desk stood inside the vestibule"*. **The vestibule was deleted on
2026-07-25** — the same file, 400 lines up, records the user's *"get rid of this
weird internal structure inside the library"* and notes that its piers *"carried
colliders across the room at z = 6.80. Those go with them."*

So for a week the circulation desk has been parked 3.3 m out into the reading
floor to clear a structure that no longer exists — and it landed in the same
zone as the long reading table, which is the entire 47 %. This is the exact
fault the file already documents two hundred lines further down, about the
reading table and the gallery: *"a constant that was right stopped being right
because a DIFFERENT constant moved, which is why nothing flagged it: both
numbers were correct when written."* Third occurrence in this one file.

Now `D/2 − 2.6`, and west from 6.5 to 5.0 so the counter is not standing in the
2.5 m door opening. The entrance hall gets the desk, the catalogue and the
noticeboard on the west and the terminals and the stair on the east; the hall
behind is one continuous floor from the desk to the stacks.

### 2. The stack block had no way through it

Five runs, 7.7 m long, unbroken from the back wall to the reading floor — the
only way between them was round the ends, so reaching a bay meant committing to
a 7.7 m walk down a 1.55 m slot and coming back the same way.

**The aisles were never the problem and I did not touch them.** 1.55 m against
`gap.ts`'s `PASSABLE` 0.95 is not a trap, the room has already had one spacing
pass and four trap-gap fixes, and the file records what happened the last time
the runs were long: median clear aisle 2.10 m, the narrowest of all ten
interiors, *because the floor had been cut into strips*. Widening again would
have undone the fix that shortened them — ninetyfour flagged this and was right.

Instead each run splits into two banks around a **1.70 m cross aisle** at
mid-depth, which is what real stack ranges do. `STACK_PITCH` is now a named
constant and the aisle and cross-aisle widths **derive** from it, so they cannot
drift apart.

### And two constants that were correct by coincidence

Both would have been stranded on open floor by the desk move, and neither is a
number anyone would have thought to check:

- the returns trolley's `TR_Z = 4.2` — which is *exactly*
  `(DESK_Z + BACK_Z) / 2`, the desk collider's own centre, at the desk's old z;
- the bin's `(−0.9, 5.5)` — *exactly* `(DESK_X + 2.6, DESK_Z + 0.3)`.

Both now derived. BUILDER-BRIEF §8, and both reproduce the old value to the
digit, which is how I know the derivation is the right one.

---

## Walked, because a screenshot cannot prove a floor

`scripts/probes/w98-library-relayout-walk.mjs`, built bundle, **5 runs**:

```
cross     5/5 pass  spread 0.62 m  [2.71, 2.45, 2.46, 2.09, 2.53]
blocked   5/5 pass  spread 0.05 m  [-8.29, -8.31, -8.26, -8.26, -8.26]
aisle     5/5 pass  spread 0.66 m  [-9.08, -9.13, -9.02, -9.63, -9.68]
entry     5/5 pass  spread 0.55 m  [-0.62, -0.07, -0.13, -0.18, -0.24]
counter   5/5 pass  spread 0.00 m  [9.22, 9.22, 9.22, 9.22, 9.22]
seats     10 registered, 0 inside a collider
aisles    cross 1.70 m, longitudinal 1.55 m, both > PASSABLE 0.95
```

`counter` coming to rest at **9.22 m with a spread of 0.00** is the desk move's
best single number: `VISITOR_Z` is `DESK_Z + 0.75` = 9.15, so walking in at the
doors and holding W brings you to the serving position within a capsule radius,
every time.

**Both signs.** `blocked` walks the same eastward line down the *centre of a
bank* and must be stopped — without it, `cross` would pass just as green on a
world with no colliders. And `--selftest` seals the cross aisle on the live
collider array (`colliders()` is live by reference — GOTCHAS 74) and confirms
the verdict goes red: **CAUGHT**, the walk resting at x −8.26 instead of 2.71.

Clean: `tsc --noEmit`, `npm run build`, `health.mjs` exit 0, `bugsweep.mjs`
**0 STATION MISS / 0 COVERAGE** over 12 rooms and 3 sites, `npm run sweep`
0/0. No new console errors — the four warnings are pre-existing (hotel
`NO BUILDING NAME`, THREE.Clock, Canvas2D, GL ReadPixels).

Looked at, personally: `shots/w98-library-cross-aisle.png` and
`shots/w98-library-hall.png`, plus bugsweep's three. The cross aisle reads
instantly as a library — bay ends capped both sides, books down its length. The
hall view shows the entrance flanked by desk and terminals with open floor
between, where the desk used to sit in the middle of that view cutting it in half.

---

## Corrections to the record

**1. ninetyfour's two largest objects are labelled the wrong way round.** Its
table names the 6.5 m² `5.0 × 1.3 at (−4.0, 0.6)` as *"the issue desk + returns
U (`:871`)"* and the 9.1 m² `3.3 × 2.75 at (−3.5, 4.26)` only as *"the 47 % hot
spot"*. It is the other way about, and its own note says *"identify it in source
before moving it — I did not, and guessing is what this project keeps paying
for."* Verified in source:

- `:871` `solid(DESK_X, (DESK_Z + BACK_Z)/2 + 0.06, DESK_W + 0.1, RETURN_D + 0.75)`
  with `DESK_X = −3.5, DESK_Z = 5.2` → **(−3.5, 4.26), 3.3 × 2.75 = the 9.1 m²
  issue desk**, i.e. the hot spot itself.
- `:1560` `solid(RT_X, RT_Z, RT_LEN + 0.2, RT_D + 0.2)` with
  `RT_X = −4.0, RT_Z = 0.6` → **(−4.0, 0.6), 5.0 × 1.3 = the 6.5 m² reading
  table**.

Nothing downstream was harmed — the numbers were right, only the names — but
the fix took a different shape once the hot spot turned out to be the desk.

**2. The 0 % zone is a STAIRCASE, and the "47 beside a 0" framing overstates
it.** Zone (x 5..10, z 0..5.5) is 27.5 m², of which the flight
(`GALLERY_X0..X1` 6.90–9.90 × `GALLERY_Z1..STAIR_Z0` 0.60–5.40) is 14.4 m² —
**52 % of the zone is stairs**. A ramp is drawn by the room's `floor()` picker
and carries no collider, so the probe scores a flight of stairs as empty floor.
It is not fillable and **must not be filled**; anything put there blocks the
stair the user asked for by name. It still reads 0 % after this change and
always will.

I deliberately did **not** "fix" the probe to exclude it. Adjusting the
instrument to flatter my own result is the move BUILDER-BRIEF §7 forbids, and
the reading is only misleading if nobody says so — so it is said here and in the
commit message instead.

---

## Not done, precisely enough to queue

- **`w94-library-density.mjs` counts a wall-hugging shelf the same as an island
  table.** A 0.52 m `wallRun` costs no usable floor but adds to its zone exactly
  like a table in the middle of the room. This is why I stopped short of adding
  the west-wall shelving I had planned between the magazine case (z −2.64..2.64)
  and the card catalogue (z 7.4..9.4): ~4.7 m of blank west wall that *should*
  have casework on it, which the current metric would score as making the room
  more crowded. Worth a follow-up — either a metric that weights perimeter
  differently, or just the shelving with the metric regression explained.
- **`scripts/interiors-walk.mjs` still cannot run against `vite preview`** (it
  imports `ct/doors.ts`, which 404s). Inherited; already raised by eightyseven
  and ninetyfour and already inside **item 246**. My probe drives through
  `__ct` only, so it was not blocked by this — but the generic harness still is.
- **The stacks lost 8.5 m of shelf run** (5 runs × 1.70 m) to buy the cross
  aisle. Offsetable on the west wall per the first bullet if anyone minds.
