# FIVE mutation cases now SLEEP — two of them mine, three A's

Found by running the full suite on current mainline as a regression pass, not by
looking for it. **This is a degradation, and it is recent:** the same suite was
43/43 earlier today and 42/43 two rounds ago.

```
  38/43 checks caught their mutation      (every mutated file restored byte-for-byte)

  FAIL window-lattice  SLEPT   lit windows back on a diagonal lattice      A
  FAIL density         SLEPT   masonry painted for a width it was not      A
                               mapped to
  FAIL facade-run      SLEPT   the window run pushed off centre on         A
                               every facade
  FAIL footprint       SLEPT   litter allowed to straddle the kerb         B  <- mine
  FAIL kerbcut         SLEPT   the car lot has no curb cut at all          B  <- mine
```

**SLEPT is not the same as a stale needle.** The quotations still match and every
file came back byte-for-byte; canfail says so on the same run. The mutations were
APPLIED and the checks passed anyway. A check that has stopped detecting is
indistinguishable from a passing one — that is GOTCHAS 27, and it is the entire
reason this suite exists.

## Why this is worse than five red rows

Every one of these guards a CONFIRMED user request:

- `window-lattice` — the diagonal lattice the user reported himself
- `facade-run` — "chopped off at points", the fencepost the user photographed
- `footprint` — "trash cannot be clipping through stuff like this"
- `kerbcut` — the lot's driveway, which he has raised twice

So four confirmations are currently resting on checks that no longer detect the
thing they confirm. Nobody would learn this from a green board; `checks.mjs` does
not run canfail and `land.sh` does not gate on it.

## What I have NOT done, and why

I have not touched any of the five. Three are A's, in A's files, guarding A's
checks. The two that are mine — `footprint` and `kerbcut` — I found with maybe
ten minutes of context left, and a guard repaired in a hurry is how you get a
check that passes without checking, which is the exact fault being reported.

**They need real diagnosis, not a nudge.** For each, the honest question is which
of two things happened, and they want opposite fixes:

- the CHECK regressed and no longer sees a defect it used to, or
- the WORLD changed so the mutation no longer produces a defect at all, in which
  case the CASE is wrong and wants retargeting

I got that distinction wrong once today already — I told D their door needed
`ctx.lit()` when the door was already registered — so I am not going to guess at
five of them on the way out the door.

## Suggested order for whoever picks this up

1. `footprint` and `kerbcut` (mine, `ct/props.ts` / `ct/tex-ground.ts`)
2. A's three, which all target `ct/tex-world.ts` and may share one cause — three
   failing together in one module is more likely one change than three
3. re-run `node scripts/canfail.mjs` after each; the suite was 43/43 today, so
   that is the number to get back to

`crowd-lane`, which slept two rounds ago and which I routed to H, is NOT in this
list — so either H has fixed it or it is intermittent. Worth knowing which.
