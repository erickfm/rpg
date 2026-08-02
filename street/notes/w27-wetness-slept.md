# w27 — why `wetness` SLEPT in canfail, and why it no longer can

Queue item 55. Port **4194** (`vite preview`, built bundle). Shut down at the
end of the session.

## Root cause, one line

Drying is `wetness -= dt / dryFor` (`ct/props.ts:1925`) and `dt` is clamped at
0.05 s (`src/main.ts:107`), so the street dries in **simulated** time — while
`wetness.mjs` sampled it on seven waits of 2000 ms of **wall clock**, which buy
far less simulated time on a loaded box.

## Which of the two the item asked about: neither, exactly

The item asked whether "the needle misses or the guard genuinely does not care".

- **The needle does not miss.** `const dryFor = 48 * (1 + soak * 1.5) * (1 +
  nightNow * 1.1);` is present and unique at `props.ts:1924`, and the mutation
  changes bytes (200975 → 200977) and changes the world by 200x.
- **The guard cares — but only when it has time to look.** It is not a static
  blindness; it is a race. That is a third answer and it is why five re-runs
  disagreed with each other.

**canfail is the loaded case by construction** — a full `npm run build` plus a
browser for every one of 45 cases — so it is the one place this defect appears
and an idle re-run can never reproduce it. That is exactly why the previous pass
could record the flakiness and not explain it.

## The 2x2 that settled it (`CPU_THROTTLE=20`, a knob `wetness.mjs` now carries)

| at x20 | pristine world | mutated world (dryFor 200x faster) |
|---|---|---|
| **old guard** | **FAIL** `the rain actually stopped` — a false red on a healthy world | FAIL, *same* clock artifact; both mutation-sensitive verdicts said **OK** |
| **new guard** | all OK | **FAIL** on both mutation-sensitive verdicts |

Under load the old guard's colour was **uncorrelated with the mutation in both
directions**: red on a healthy world for a clock reason, green on the mutation.
canfail scoring it CAUGHT was as meaningless as scoring it SLEPT.

## What changed — `scripts/wetness.mjs`, and a stale comment in `scripts/canfail.mjs`

1. **The ladder is 7 x 60 rendered frames, not 7 x 2000 ms.** A frame is worth
   between ~1/60 s and the 0.05 s clamp, so the time base is uncertain by about
   3x — and the mutation moves the rate by 200x, leaving nearly two orders of
   margin. Unlike milliseconds it cannot be truncated to nothing. Side effect:
   the false `the rain actually stopped` red is gone too, because the rain now
   gets its simulated time whatever the frame rate.

2. **`streetStillWet` was a sleeping verdict *inside* the guard.** It read
   `last.broad !== wet.broad || last.strip !== wet.strip` — "the surfaces differ
   from the storm", i.e. a test that the street **changed**. A street that
   flashes bone dry changes *more* than one that stays wet, so its own failure
   mode satisfied it. I watched it print `OK the street is still wet` three
   times over `road 3c3c3c gutter 3c3c3c`, the ungraded base colour.
   It now states the user's actual request — *"make wetness last a lil after it
   stops"* — against the world's published `scene.userData.wetness`
   (`props.ts:1010`), bounded by `N * DT_CLAMP / DRY_FOR_MIN`: the most any
   healthy world can shed in the window, whatever the frame rate. **Derived from
   the drying law, not picked.** Real world sheds 0.109 of an allowed 0.4375 — a
   4x margin; the mutated world sheds everything.

3. `read()` now reports `wetness`, so the numbers behind the verdicts are in the
   log instead of being inferred from two hex strings.

4. `canfail.mjs`: the note saying the cause was unknown and belonged to whoever
   owned `props.ts` is replaced with what it actually was, generalised — **any
   guard measuring a rate on a wall-clock wait will sleep here and nowhere
   else.** No behaviour change in `canfail.mjs`; the case was always sound.

## Acceptance

Full end-to-end run, `SHOT_URL=http://localhost:4194/ node scripts/canfail.mjs`:

```
45/45 checks caught their mutation
every mutated file restored byte-for-byte
```

`.canfail-last.json` (gitignored, so quoted here):

```json
{ "build": "1350a41b9", "url": "http://localhost:4194/",
  "caught": 45, "total": 45, "asleep": [], "unprovable": [] }
```

Plus five consecutive single-case runs, all CAUGHT (the prior record was 3 of 5),
and the x20 matrix above.

## Found and NOT fixed — for the desk to queue

1. **`gutterHolds` is thinner than it looks.** `samples[3].strip !==
   samples[3].broad` compares a *gutter* material's colour to a *road*
   material's. It only detects the mutation because both converge on the same
   ungraded `3c3c3c` when bone dry — a coincidence of the grade, not a statement
   about drying rates. It survives here because `streetStillWet` now carries the
   real load, but it deserves rewriting as "the gutter is still wetter than the
   crown at a stated wetness", and I did not do it: it is beyond this item and I
   would rather it were queued than smuggled in.

2. **`DT_CLAMP` (0.05, `main.ts:107`) is now hand-copied into a second probe** —
   `wetness.mjs` as well as `jump-walk.mjs` (item 50) — along with
   `DRY_FOR_MIN` (48, `props.ts:1924`). All cited by line per BUILDER-BRIEF §8.
   **Two copies is the point at which this should be hoisted** into a shared
   export; it touches `main.ts`, `props.ts` and `fp.ts`, which neither item
   names.

3. **This is the same root cause as queue item 50** (`jump-walk.mjs`'s fixed
   1100 ms window). Two independent instruments, same fault, found the same
   night. `grep -rln 'waitForTimeout' scripts/` is the shortlist of the rest —
   **any script that measures a rate, a peak, or a settled value on a wall-clock
   wait is exposed**, and the exposure is invisible on an idle machine. Worth a
   sweep as its own item; x8 is not enough throttle to expose it, use x20–x40.
