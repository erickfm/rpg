# BLOCKED — builder E

**Blocked on: the live integration world has stopped rebuilding, so the park
cannot be verified by the auditor or seen by the user.**

Not a fault in my work, and nothing in my tree is waiting. The park pass is
finished, landed and green. The problem is that the world everyone would check
it in is frozen.

## The measurement

| | |
|---|---|
| `:5177` is serving | `d07fd0272`, stamped **17:24**, titled *live: rpg-alley* |
| mainline is at | `9f64737f6` — it has moved eight times since |
| checked again at | 17:46, then **18:13**. Still `d07fd0272`, ~50 minutes stale |

`d07fd0272` does **not** contain `4fa317a1e`, the bench-facing fix: `facingIn`
appears five times in mainline's `park.ts` and **zero** times in the served
build. `shrubRun` and `clump` appear in both, so it carries some of the
afternoon's work and not the last of it.

**A stall, not a drop.** `live-integrate.sh` drops a builder only when the
merged tree fails to typecheck (`check()` at line 86), and `feat/civic`
typechecks clean — `npx tsc --noEmit` is green and `npm run build` exits 0.

**This is not hypothetical and it has now cost real work.** The desk reported
four park items live off that frozen build. Three were genuinely closed and I
could have wasted the afternoon re-fixing them. The fourth — the shelter roof
— was genuinely still broken, and the stall is exactly what made the two
indistinguishable without measuring each one from scratch.

## Why this blocks

The desk's instruction was *"tell me when you want it verified. I will have the
auditor walk it before it counts as done."* An auditor walking `:5177` right now
walks a 22-minute-old park:

- benches facing **out** of the park, fixed at 17:24
- the shelter's previous roof
- the churchyard coping and the park's bark still flat colour

They would file faults that are already closed, and I would have no way to
distinguish that from a genuine miss. **Two things this session were reported as
broken after being fixed, and one ledger row was rejected on that basis** — so
this is not hypothetical, it is the same failure a third time.

## What would unblock it

Any of:

1. restart `live-integrate.sh` (not my file, and not something I should restart
   under other builders without the desk saying so);
2. have the auditor walk a preview of `add-stick-and-city98` directly rather
   than `:5177`;
3. tell me to hold until the integration world catches up.

## The audit can go ahead WITHOUT unblocking this

Option 2 needs nothing restarted. **`feat/civic` is fully merged into mainline
— zero commits ahead — so mainline IS the park.** Build it and walk it:

```
git checkout add-stick-and-city98      # 9f64737f6 or later
cd street && npm run build && npx vite preview --port <yours>
```

**But do not verify it by grepping for identifiers, which is what I did and
what let a broken shelter be reported as done.** `BufferGeometry` appearing
twice in `park.ts` says a single-mesh roof exists; it says nothing about
whether that roof touches its posts. It did not — by 0.20 m, all four. The
checks below make the claim the identifiers only implied, and each one exits
non-zero on failure and reports what it examined, so a green cannot mean it
looked at nothing:

```
cd street
SHOT_URL=<your preview> node scripts/E-shelter.mjs      # posts identical, eaves below plate
SHOT_URL=<your preview> node scripts/E-benchface.mjs    # 9/9 face into the park
SHOT_URL=<your preview> node scripts/E-overlap.mjs      # 0 across 151 park meshes
SHOT_URL=<your preview> node scripts/E-weedspread.mjs   # clump count, spacing, size spread
SHOT_URL=<your preview> node scripts/E-park-walk.mjs    # the 2 m lane, and the loop
```

## Meanwhile

**Check the served stamp against mainline before reading any review frame.**
One command separates *"not fixed"* from *"not deployed"*, and today that
distinction has cost credibility in both directions — three items reported
live that were closed, and one reported live that really was.

My tree: park pass complete and re-verified by measurement rather than by
identifier. Nothing uncommitted, nothing unlanded.

_Builder E, 2026-07-25 18:20._
