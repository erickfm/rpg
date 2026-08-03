# Item 207 — the block is CLEARED (198 landed). Released un-started, with the
# one piece that was safe to land.

Worker ninety, 2026-08-03. **Supersedes the blocking advice in
`notes/w64-207-blocked-on-198.md`: its condition is now met.**

## The headline: 198 has landed, so 207 is claimable

`w64-207-blocked-on-198.md` released this item because item 198 was
`DOING seventyone` and the two are the same steering computation from both ends.
**That is no longer true**, and it is worth stating loudly because the note
telling people to wait is still on disk and will otherwise keep parking this row:

- **No `| 198 |` row remains in `QUEUE.md`** — only `| 195 | SUPERSEDED by 198 |`.
- **The source says it landed, in past tense.** `ct/street.ts`, on `solid()`:
  *"Measured on the built bundle **before the fix**: 359 of the world's 508
  static player colliders were not in `citAvoid`… **IT IS NOW ONE FUNCTION**,
  not two that agree."*

So the obstacle set has already tripled. **The next holder does not need to wait
— they need to tune against the post-198 world**, which is what the old note
asked for.

## What I verified in source, first-hand

Both of the row's central claims are true, and I checked them rather than
inherit them:

1. **`ct/crowd.ts:614` — nothing can move a citizen backwards.**
   ```
   for (const off of [c.pick, want, want + 0.4*k, want - 0.8*k, 0,
                      want + 0.8*k, want - 0.4*k]) {
     const nt = t + step;                    // ← constant across all seven
     const nx  = A.x + dx*nt + rx*o2;
     const nz2 = A.z + dz*nt + rz*o2;
   ```
   `nt` does not depend on `off`. **Only the lateral offset varies**; every one
   of the seven candidates advances by the same `+ step` along the route. So
   *"back up and allow the car to pass"* is not a behaviour this file can
   express at any tuning — it needs a new candidate, not a new number.

2. **The `citAvoid` comment was stale and it really did mislead the desk.**
   It read *"trees, lamps, parked cars, and the moving cruiser's box"*, which
   parses as "moving traffic is not in here, except the cruiser" — and the
   desk's withdrawn Lead 1 was exactly that. **Fixed, and it is the only thing
   I landed on this item.**

## What I did NOT do, and why

Everything else: the backwards candidate, `escapeFrom` handling *beside* a box
as well as *inside* one, and a probe that makes the taxi **dwell** so the pin
reproduces at all (sixtynine measured max jam 0.03 s over 470 samples in
ordinary traffic — normal traffic is not a repro).

This is a crowd-steering change with four named ways to make the world worse — a
citizen shoved into the traffic lane, off the kerb, inside another citizen, or
oscillating — and the 2 m sidewalk lane is sacred. It has to be **walked**, not
screenshotted. I was too far into my session to start that and finish it
honestly, and a half-changed steering search is the failure mode this project
warns about most. Releasing rather than half-doing it, per BUILDER-BRIEF.

## For whoever takes it — do these in this order

1. **Re-measure `citAvoid` first.** It is post-198 now; anything in the older
   notes about the obstacle set is describing a world that no longer exists.
   ⚠ `__ct.citAvoid()` returns a **MAPPED COPY** (GOTCHAS 74) — you cannot plant
   a box through it.
2. **Build the dwell repro before touching steering.** Without it you cannot
   tell a fix from ordinary traffic, and you will not be able to prove either.
3. **`escapeFrom` returns `null` when you are outside a box**, so a citizen
   walled in *beside* a car is recorded as legal and `stuckT` resets — that is
   why the freeze persists instead of self-correcting.
4. Only then add the backwards candidate at `crowd.ts:614`.

## One process note the desk should have

`notes/w64-207-blocked-on-198.md` is a correct note whose **precondition
expired**, and nothing on disk marks it stale — I nearly re-released this item on
the strength of it before checking 198 myself. A released-because-blocked note
needs its blocking condition re-tested when the row is next claimed, not
re-read. Cheap fix: this note sits beside it and says so.

## Verification

- typecheck **clean**. The only change is a doc comment; no behaviour touched.
