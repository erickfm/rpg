# Item 98 — the corridor the item asks for is ALREADY WHAT THE CODE DOES

Worker eightysix, 2026-08-03. **Released to TODO. No change made to `src/proto/fp.ts`.**
Read `notes/w60-deadring-predicate.md` first — this continues it and does not repeat it.

## Why I released rather than implemented

`fp.ts` is the world's selection resolver — every door, seat and machine — and
**both prescriptions this row has carried are wrong.** Worker sixty disproved the
first. I disproved the second, and then found that the change itself is
unnecessary. Implementing anything here before that is settled would be churn on
the most dangerous file in the tree.

## 1. The row's NEW prescription is contradicted inside the file

The row now says, in bold: *"THE OPEN DECISION IS NOW MADE … **CAP THE AIM-TIER
REACH**."*

`fp.ts:994–1002` is a previous author recording that they tried exactly that:

> *"UNCHANGED: looking still reaches as far as it ever did. **I briefly added a
> clause here capping `looked` at `s.r + REACH_MARGIN`, which collapses the aimed
> reach back onto the proximity radius and would have killed selection at 3 and
> 5 m** — the half of the feature he asked for by name and that `D-look-selects`
> exists to hold. **Narrowing the AIM-FREE pass is the job; narrowing the aimed
> one is the opposite of the job.**"*

That is the row's instruction, already tried, already rejected, with the check
that would catch it named. It should not be re-issued without answering it.

## 2. The corridor the item wants ALREADY EXISTS — measured

The item's premise is that the predicate is a **cone**, and *"a cone pinches shut
as you arrive, which is the dead ring."* The current predicate is

```ts
offAxis < lookTolerance(s.r, d)        // fp.ts:1005
lookTolerance = (r, d) => Math.atan2(r, Math.max(0.35, d))     // fp.ts:780
```

`offAxis < atan2(r, d)` is algebraically identical to `d * tan(offAxis) < r` —
**a corridor of constant half-width `r`**, which is the very thing the item asks
to be introduced. Evaluated (`r = 1.05`):

```
  d=0.20  cone=71.6 deg  lateral=0.600      d=2.00  cone=27.7 deg  lateral=1.050
  d=0.35  cone=71.6 deg  lateral=1.050      d=3.00  cone=19.3 deg  lateral=1.050
  d=0.60  cone=60.3 deg  lateral=1.050      d=3.85  cone=15.3 deg  lateral=1.050
  d=1.00  cone=46.4 deg  lateral=1.050      d=6.00  cone= 9.9 deg  lateral=1.050
```

**The lateral tolerance is exactly `r` at every distance from 0.35 m to the 6 m
reach.** It does not pinch. The only place it narrows is *inside* 0.35 m, where
`Math.max` holds the angle constant and the corridor tapers to 0.60 m — and that
is tier-1/`near` territory anyway, which does not consult aim.

## 3. …and that is also why the current code is SAFE where sixty's fix was not

`atan2(r, max(0.35, d))` is **always less than 90°** — 71.6° at r = 1.05, 83.3°
even at r = 3. So `offAxis < lookTolerance(...)` **cannot** pass anything in the
rear hemisphere, by construction. That is precisely the guard sixty had to add
back by hand to `d*sin(offAxis) < r`.

So swapping the current expression for the item's prescribed one would replace a
**bounded, front-only corridor** with an **unbounded double-ended cylinder**, and
gain nothing, because the corridor is what it already had. Sixty's `ahead > 0`
repair would restore safety but still leaves the change with no benefit to buy.

## 4. So what IS the dead ring? A hypothesis, labelled as one.

The item's own measurement is the best clue in the row, and it argues against its
own diagnosis:

> *"the dead ring's outer edge does not move with radius (3.84–3.89 m for
> r = 1.05 … 1.80)"*

**A corridor's width is `r`, so anything caused by this predicate MUST move with
`r`.** An r-independent boundary at ~3.85 m is therefore not the cone and not the
aim tier. It is also not `reach`, which is **6** — the only call site is
`crosstown.ts:2006`, `pickSpot(SPOTS, view, 6, canSee, …)`.

That leaves the fourth argument, **`canSee`**, as the obvious next place to look
— an occlusion test would be radius-independent, and GOTCHAS 88 already records
`canSee` stopping its ray `dist − 0.35` short and silently refusing a spot. **I
did not measure this and am not asserting it.** It is where I would start.

## What the next builder should do

1. **Do not change the predicate on the strength of this row.** Re-measure the
   dead ring first and find out what actually bounds it at ~3.85 m.
2. If it is `canSee`, this item is in the wrong file entirely.
3. If a reach cap is still wanted afterwards, it has to answer `fp.ts:994`
   and `D-look-selects` explicitly, not silently.
4. `w40-bed-vs-door.mjs`'s failing assertion is downstream of all of the above
   and should not be touched until the cause is known.

## Status

Released with `./scripts/claim.sh --release 98 eightysix`. **`src/proto/fp.ts` is
untouched.** The three numbered findings above are the whole of the work, and
they change what the item is.
