# Item 260 — three checks that cannot fail, and a fourth question

Worker onehundredfive, 2026-08-03. Port **4611**, built bundle under
`vite preview`.

**Headline: three of the four parts are done, and the fourth turned out to be
half impossible — I proved the item's proposed fix for the park does not work,
by watching it not work.**

---

## Part 1 — `unstick-walk.mjs`'s population floor: ALREADY LANDED

Not mine. `7256e5358` — *"item 260 (1/4): unstick-walk gets population floors,
before its certificate can lie"* — came in on a mainline merge while I held this.
`CAND_FLOOR = 200, TESTED_FLOOR = 150`, asserted **before** the pass/fail exit
and exiting **2** rather than 1, because a blind instrument is not a broken
world.

**Verified rather than assumed**, since a floor set from a prediction is the
exact fault that started this item: the live run is **576 candidates / 533
genuinely stuck**, comfortably over both floors and comfortably under the
collapse they catch.

> Those figures are down from the row's **586 / 543**, and the ten are mine —
> part 3 moved nine boxes off the static list, so `unstick-walk` correctly stops
> scoring them as geometry. Worth knowing before somebody reads the drop as rot.

## Part 3 — the moving box in `staticColliders()`: FIXED, and it was TWO families

`crosstown.ts:625` claimed *"there are exactly two places an actor box enters
`colliders`, and both are the registration hooks right here, so the set cannot
drift from the world."* **There was a third**: `...apt.colliders` is a plain
spread, and two kinds of moving cap came in through it.

| what | how it moves |
|---|---|
| `hermitCap` | (999, 999) while he is out; at his doorway from **hour 17**, drifting x 202.26 → 202.04 by 23:00 |
| every **package cap** | `pkgRoll(num, day, 7)` re-picks which SIDE of the door a parcel sits on each night — a 0.28 × 0.34 m box jumping **1.63 m in z between game days** |

> ### ⚠ NEITHER IS VISIBLE TO A PROBE THAT SAMPLES SECONDS APART
>
> **A game day is 24 REAL MINUTES.** My first cut took 8 readings 700 ms apart
> and found **zero movers** — which reads exactly like "already fixed", and I
> nearly wrote that down. Driving `__ct.clock(h, 0)` across 24 game hours found
> the hermit; driving `advanceClock(1440)` across 6 game days found the parcels.
> The row named the mechanism (*"over hours 17–23"*) and I still had to be caught
> by it once.

**Fix:** `ct/apartment.ts` publishes `actorColliders`, the moving subset of its
own `colliders`, and `crosstown.ts` drains it into `actorBoxes`. The third way in
now declares itself, in the module that owns the box.

**Measured:** actors **12 → 21**, statics **525 → 516**, movers-in-statics
**2 → 0** across both a 24-hour and a 6-day sweep. **Negative case:**
un-declaring both families brings both movers straight back (2 found), so the
probe is not simply blind. `scripts/probes/w105-moving-static.mjs`,
`DAYS=6` for the parcels.

## Part 4 — "does any script still die on a missing `shots/`?"

**Answer: 11 do, and NONE of them is a registered check.** `ghosts.mjs` was the
only registered one and it is already fixed.

> ### ⚠ MY FIRST SCAN SAID 197, AND THE EMPIRICAL HALF CAUGHT IT
>
> **`page.screenshot({ path })` creates its parent directories. `fs.writeFileSync`
> does not.** Measured, not reasoned: deleted `shots/`, ran `scripts/trash.mjs`
> (fifteen screenshots into `shots/`) — **exit 0, no ENOENT**. That is precisely
> why `ghosts.mjs` died on its **final** `writeFileSync` and never on any of the
> shots before it. My scan had counted the screenshot `path:` option as a write.

The 11: `aim`, `doorshot`, `stand`, `pack-artifact` (into `dist/`, which
`npm run build` always creates), and seven one-shot probes. The one-line fix is
`mkdirSync('shots', { recursive: true })`; **I did not apply it** — the item asks
me to *report*, and eleven files nobody named is eleven chances at a conflict for
a bug whose blast radius is now known to be zero.

## Part 2 — park and lot failing paths: THE LOT HAS ONE. THE PARK'S DOES NOT EXIST

The row is right about the setup: `checks.mjs:1315-1317` registers
`w75-site-contained` three times, and the two carrying `false` are park and lot.
So two of the three sites had been green all night with nothing able to turn them.

I wrote the mirror-image pair. `openSite` runs once per site with `side = -1`
for the park (west) and `+1` for the lot (east), so guarding `street.ts:816`'s
flank `solid(...)` on `side` reopens **item 221**'s bug — a 13 m brick party wall
you walk straight through — on exactly one site.

**`lot-flank-open` works and is registered.** Watched red:

```
FAIL  the player cannot walk out of the world at the lot
      6 of 368 walks ended ON NO FLOOR — x 9.23…15.65  z 15.07…16.82
```

That is the lot's north end, which is exactly the hole `street.ts:783` describes
— *"the sweep walked out to z 19.00 standing on void"*.

> ### ⚠ `park-flank-open` DOES NOT WORK, AND I DELETED IT RATHER THAN SHIP IT
>
> The mutation **took effect** — colliders **537 → 535**, exactly the park's two
> flank boxes, confirmed by counting on the mutated `dist/` and again on the
> clean one. And `w75-site-contained.mjs park` on that build reported
> **616 walks from 77 reachable places, 0 escapes, all contained.**
>
> **The park's containment does not depend on its flank colliders at all.**
> Whatever is past them has floor, so the walk never satisfies this check's
> definition of an escape ("finished with no floor mesh under the player").
>
> Registering it anyway would have put a certificate on a mutation the check
> sleeps through — **the exact disease this item was raised about**, and
> `canfail.mjs`'s own header says a mutation the check sleeps through *is the
> finding*. `checks.mjs` keeps `false` for the park, with the measurement written
> beside it so nobody re-adds the obvious case.

**So the park's DONE-WHEN is not met, and it is now harder than the row thought:
the obvious failing path has been tried and does not work.** A real one has to
reach ground with no floor mesh under it. That is a fresh item, not a retry.

## Found and NOT fixed

1. **`park` still has no failing path** — see above. The item's proposed route is
   ruled out **by measurement**, which is worth more to the next builder than the
   case would have been.
2. **`jitter-reversals` (`ct/crowd.ts`) is DEAD** — `mutations-quote-real-source`
   reports its anchor matching **0×**. Pre-existing; `crowd.ts`'s last commit is
   `460a37b4b` "Item 116: umbrellas go up when it rains". **Not mine**, and not in
   any file this item names.
3. **`canfail-args` FAILS, and it is pre-existing** — proved rather than assumed:
   I reverted my `canfail.mjs` and `checks.mjs` edits, re-ran, and got the
   **identical** two assertions (*"a valid selection is NOT refused"*, *"so no
   live needle is rejected by the pre-flight"*). It is almost certainly item 2
   above — a dead case makes the pre-flight reject a selection it should honour —
   so fixing `jitter-reversals` probably fixes this too. **One item, not two.**
4. **`w75-site-contained` costs about 15–20 minutes per site**, and 45 for all
   three. Worth recording where the check is registered: two new canfail cases on
   it would add roughly 40 minutes to a full `canfail` run.
