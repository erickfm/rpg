# item 115 — the library layout, measured and RELEASED un-built

Worker ninetyfour, 2026-08-03. **I did not change the room.** This note is the
diagnosis the row was missing (`[DIAGNOSIS LOST]`), re-derived from the user's
words up, so whoever takes it next starts with numbers instead of taste.

> *"library is crowded in some areas and spacious in others. try a different
> layout thanks."* — 2026-08-02, `FEATURE-REQUESTS.md:2625`

**Why released rather than finished:** this is a room-level relayout of a
1,981-line file, and every candidate move (stack spacing, the issue desk, the
reading tables) changes aisles, seat reach and trap gaps — all of which the
project requires to be proven **by walking**, not by looking. I had the budget to
measure it properly or to move things carelessly, not to do both. The library is
the most-reported room in the game (this is at least the sixth request against
it); a half-verified relayout here would be worse than none.

**The measurement is committed and reusable** — `2877a7660`.

## He is right, and here is the number

`scripts/probes/w94-library-density.mjs`, on the built bundle, port 4507.
Room is **20 × 22 m (440 m²)** holding **26 colliders / 62.4 m² of footprint**.

Furniture occupancy by zone, 4 × 4, z down the page (north/back at top,
entrance at the bottom):

```
z -11.0 |  19%  20%  13%  15%     back    — the five stacks, evenly dense
z  -5.5 |  22%  16%   6%  12%     stacks
z   0.0 |  15%  47%  15%   0%     middle  — BOTH EXTREMES, SIDE BY SIDE
z   5.5 |   6%   3%   6%   7%     entrance— effectively empty
```

**Emptiest zone 0%, densest 47%, spread 47 points, sd 10.6.**

That middle row *is* the complaint, in one line: a **47% zone directly beside a
0% zone**. "Crowded in some areas and spacious in others" is not a mood — it is
a 47-point spread across four zones of one room.

The second half of it is the whole **entrance third of the room**: z 5.5 → 11,
roughly 20 × 8 m = 160 m², averaging **5.5% occupancy**. It holds one reading
table and the card catalogue. Over a third of the floor is doing nothing.

## What makes the lumps

`scripts/probes/w94-library-colliders.mjs`. Local coords, room centre = (0,0),
x east, z south:

| footprint | w × d | at | what it is |
|---|---|---|---|
| 9.1 m² | 3.3 × 2.75 | (−3.5, **4.26**) | **the 47% hot spot** |
| 6.5 m² | 5.0 × 1.3 | (−4.0, 0.6) | the issue desk + returns U (`:871`) |
| 4.6 m² ×5 | 0.6 × 7.7 | cx **−7.6, −5.45, −3.3, −1.15, +1.0**, all cz −5.85 | the five stack runs |
| 3.5 m² | 1.06 × 3.3 | (3.6, 4.0) | |
| 3.2 m² | 0.6 × 5.28 | (−9.68, 0) | magazine case, west wall |
| 2.8 m² | 0.24 × 11.6 | (6.99, −5.2) | the gallery/stair wall, z −11 → 0.6 |
| 2.5 m² | 2.5 × 1.0 | (5.8, 9.3) | the reading table (`:1005`) |
| 1.4 m² | 0.7 × 2.0 | (−9.65, 8.4) | the card catalogue |

**The stacks are on a 2.15 m pitch and are 0.6 m deep, so every aisle between
them is exactly 1.55 m.** That is comfortably over `gap.ts`'s 0.95 m `PASSABLE`,
so **the stacks are NOT a trap and must not be "fixed" by widening them again** —
the room has already had one spacing pass (*"things feel cramped in the library.
spread things out"*) and four trap-gap fixes. The desk's own row says it: this
asks for a LAYOUT, not another widening. **The stacks are fine; their placement
is the problem.** All five are crammed into the back half while the front third
is bare.

**10 seats** are registered, at local (4.9/5.5/6.1/6.7, 8.5), (2.6, 4.0),
(2.6, 5.05), (−4.0, −0.35), (−2.4, −0.35), (−5.6, 1.55), (−4.0, 1.55). **None is
in the stacks half.**

## The shape of the fix, for whoever takes it

Not prescribed — the user said *"try a different layout"*, which is an invitation
to design. But the constraints are now known:

1. **Move stacks south, do not thin them.** Two of the five runs relocated into
   the dead entrance third would cut the back-half density and give the front
   something to be. Keep the 2.15 m pitch; it is already correct.
2. **The 9.1 m² object at (−3.5, 4.26) is the single densest thing in the room**
   and sits next to the emptiest zone. Identify it in source before moving it —
   I did not, and guessing is what this project keeps paying for.
3. **The gallery wall at x 6.99 stops at z 0.6**, which is why the east-middle
   zone reads 0%. Anything placed there must not block the stair.

## Coordination the row asked for

- **158 is DONE** — the raked newspaper stand at the west wall is already gone
  (`notes/eightyseven-item158-library-stand.md`), so the layout plan starts from
  a room with one fewer object than the row assumes.
- **157** (the library PC gains a diegetic screen you sit at) — the seat in front
  of it must survive any relayout. Two of the ten seats sit at (2.6, 4.0) and
  (2.6, 5.05); check which are the terminals before moving anything near them.

## Instrument faults — one caused, one inherited

1. **Mine, caught by a suspicious-zero guard.** `__ct.seats()` entries carry
   their coordinates on **`.pose`** (`crosstown.ts:358`), not on the seat. My
   first filter tested `s.x`, which is `undefined`, so every comparison was false
   and it reported **"0 seats"** for a room that makes three `ctx.seat` calls and
   that eightyseven measured green at 219/219. It printed *"(none — suspicious,
   this room has three seat registrations in source)"* rather than a confident
   zero, and that is the only reason I looked. **Fixed; the answer is 10.**
   GOTCHAS 34 in miniature — write the floor before you trust the count.
2. **My clearance percentage overstates and I refused to quote it as the
   finding.** 26.9% of free floor reads "crowded" at the 0.475 m threshold, but
   *any* object drags an apron of sub-threshold cells around itself, so a
   perfectly-spaced room would score too. It is useful for SHAPE — the plan view
   shows the stack comb instantly — and worthless as a level. The 4 × 4 zone
   occupancy has no apron artifact, so that is the number in this note.
3. **Inherited, and it blocks the check the row implies.**
   `scripts/interiors-walk.mjs` cannot run against `vite preview` (it imports
   `ct/doors.ts`, which 404s), so the walk this item needs must be run on a
   **dev** server — in direct conflict with the verify-on-the-bundle rule
   (GOTCHAS 28). Already raised by eightyseven and already queued as part of
   **item 246**; noting it because whoever takes 115 will hit it immediately.
