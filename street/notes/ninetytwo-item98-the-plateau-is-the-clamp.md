# Item 98 — the "two regimes" are ONE predicate with a CLAMP on it

Queue worker **ninetytwo**, 2026-08-03. **Fourth release. `src/proto/fp.ts`
UNTOUCHED.** Measured on the built bundle (4480) and a dev server (4483).

Read `notes/eightynine-item98-the-cap-is-not-looktolerance.md` first. This does
the one thing it asked for — *"Re-run and confirm the 15° plateau"* — and the
plateau reproduces exactly. **Then it identifies what the plateau is, and the
answer reverses that note's conclusion.**

---

## 1. The plateau reproduces, digit for digit

`w89-item98-what-bounds-the-ring.mjs`, re-run on my own build:

```
 1.50  16°   2.00  15°   2.50  15°   3.00  15°   3.50  15°
 4.00  15°   4.50  13°   5.00  12°   5.50  11°
```

Identical to eightynine's table. **§2 of that note is sound as a measurement.**
Its *interpretation* is not.

## 2. `lookTolerance` NEVER RETURNS 35°. It is clamped at 14.90°.

`fp.ts:816`, the last line of the function:

```ts
return Math.min(0.26, Math.max(0.20, raw));      // ~11.5° … ~15°
```

**0.26 rad = 14.90°.** The function cannot return 35.0°, or 27.7°, or 71.6°, for
any `r` and `d` whatsoever.

eightynine's comparison column — *"lookTolerance(1.05, d) = 35.0, 27.7, 22.8,
19.3, 16.7, 14.7, 13.1, 11.9, 10.8"* — is `atan2(r, max(0.35, d))`. That is
**`raw`, from line 781**, the value *before* line 816 clamps it. My probe prints
both columns and `raw` matches that note's numbers to the decimal.

**This is BUILDER-BRIEF §8 exactly** — *"a second hand-typed copy of a number is
the single most expensive habit in this codebase"* — and it has now cost this row
a release and inverted its premise.

## 3. Which model explains the measurements? Not a threshold I picked — a comparison.

`scripts/probes/w92-item98-the-plateau-is-the-clamp.mjs` imports `fp.ts` **in the
page** (dev server; a built preview 404s on `/src/proto/fp.ts`) and calls the
real function, so nothing is retyped. Residuals against the same 9 cone
distances:

| model | mean residual | worst |
|---|---|---|
| **REAL `lookTolerance`** (with the clamp) | **0.28°** | **1.10°** |
| `raw = atan2(r, d)` — what the note compared against | 5.14° | 18.99° |

The sweep reports the largest **integer** degree still offered, so anything under
~1° is the instrument's own resolution and cannot separate two models. **18.99°
is not that.** 8 of the 11 distances sit exactly on the 14.90° ceiling.

> **`lookTolerance` IS the binding constraint below 4 m.** There are not two
> regimes. There is one predicate, pinned at its own ceiling for every `d ≤ 3.5`,
> and released from it only past 4 m where `raw` finally falls under 14.90°.

## 4. What this does and does NOT license

**Corrects:** eightynine's *"the binding constraint is NOT lookTolerance … not
even close to binding"*, and its stated reason for refusing — *"capping would
leave the 1.5–4 m band exactly as it is, because lookTolerance does not bind
there"*. It does bind there. It is the only thing binding there.

**Does NOT license the row's instruction.** *"Cap the aim-tier REACH"* is a
different quantity from the tolerance — `reach` is the 6 m distance ceiling, and
`fp.ts:994` records that cap already being tried and rejected. Nothing measured
here says reach is wrong. **The row's remedy is still unsupported; only its
premise about `lookTolerance` is vindicated.**

**And eightysix is still right that the corridor never pinches.** A constant
14.90° half-angle means lateral half-width GROWS with distance (0.40 m at 1.5 m,
0.93 m at 3.5 m) — the opposite of "pinches shut as you arrive". So the user's
dead ring is still not explained by the cone's *shape*; it is explained by the
cone being **uniformly narrow up close**, which is what the 2026 tightening from
35.5° to 15° deliberately did on his other complaint (*"i select stuff without
even looking at it"*).

**That is the real tension this row has never stated: the two user complaints
pull in opposite directions on the same constant.** 35.5° gave "I select things
without looking"; 15° gives "the door is dead until I line up". Whoever takes
this next is choosing a point between two of his own quotes, not fixing a bug —
and should say so to the desk rather than tuning silently.

## 5. The one anomaly I did NOT resolve

At `offAxis = 0` the spot is offered at 3.50 m, **dead at 4.00 m**, and offered
again at 4.50 m. Non-monotonic, and `lookTolerance` cannot do that (at offAxis 0
the tolerance term passes for any positive `r`). This is the same shape as
eightynine's unexplained ±0 contradiction (§5 of its note). **It is one point and
it is real in two independent runs.** Candidate: `canSee` — GOTCHAS 88, a spot
blocked by its own geometry. **Not chased; I am out of budget, not out of leads.**

---

## FOR THE DESK

1. **REWRITE THE ROW. It currently contradicts itself in one paragraph** — *"the
   desk's own prescription is WITHDRAWN … Do not implement it"* and *"THE OPEN
   DECISION IS NOW MADE … CAP THE AIM-TIER REACH"*. Four workers have now read
   that and four have refused. It cannot be actioned as written by anybody.
2. **The decision this row actually needs is the USER'S, not a builder's.** It is
   a trade between two things he asked for in his own words (§4). Ship him the
   two numbers — 35.5° gave median off-axis 10.8°, 15° gives 5.2° — and ask.
3. **`lookTolerance`'s clamp is undocumented at the call site.** Line 816's
   `// ~11.5° … ~15°` is the only mention, and two workers computed `atan2`
   without it. Worth exporting the ceiling as a named constant so no probe can
   retype it. One line; not mine to take.
4. **Unresolved:** the d = 4.00 m null at offAxis 0 (§5).
5. **⚠ THIS ROW IS A LIVELOCK AND IT WILL BURN EVERY BUILDER YOU SPAWN.**
   Measured just now: I released 98, called `claim.sh` again, and **got 98 back**
   — three times running. It is the top **actionable** row, so every builder that
   asks receives it, reads four accumulated refusals, and refuses again.
   The next row up, **207, is `TODO — ⚠ BLOCKED ON 198`**, and `claim.sh` matches
   a bare `| TODO |`, so it is skipped rather than offered. That is correct
   behaviour for a blocked row, but it means **98 is the permanent head of the
   queue and nothing below it can ever be reached.**
   `grep -c '| TODO'` reports **34**, which is why this is invisible from the
   desk: 34 items look available and exactly one is reachable.
   **Fix it at the row, not at the builder** — supersede 98 with something
   actionable, or unblock 198/207. I did not supersede it myself: authoring a
   replacement for the project's most contested row is a larger unilateral act
   than any of the four workers who refused to touch `fp.ts`, and the decision
   §4 describes is the user's to make, not a builder's.
