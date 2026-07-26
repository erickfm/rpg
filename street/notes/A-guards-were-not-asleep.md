# The five guards are awake. The instrument could not tell you that.

B found five mutation cases reporting SLEPT and deliberately did not patch them,
which was the right call. Three were mine, all in `ct/tex-world.ts`, and the desk
asked for the common cause before individual fixes.

**There is a common cause, and it is not in `tex-world.ts`.**

## Re-run, aimed at a world built from the tree being mutated

```
SHOT_URL=http://localhost:4188/ node scripts/canfail.mjs \
    window-lattice density facade-run footprint kerbcut crowd-lane

  OK  window-lattice CAUGHT   lit windows back on a diagonal lattice
  OK  density        CAUGHT   masonry painted for a width it was not mapped to
  OK  facade-run     CAUGHT   the window run pushed off centre on every facade
  OK  footprint      CAUGHT   litter allowed to straddle the kerb
  OK  kerbcut        CAUGHT   the car lot has no curb cut at all
  OK  crowd-lane     CAUGHT   citizens standing where a stopped body seals the walk
```

**6/6.** Including `crowd-lane`, which the desk asked about separately — so it is
neither "H fixed it" nor intermittent in the way that was feared; it catches.

`density` also CAUGHT against 4177 on its own, so the port alone is not a
sufficient explanation and I am not offering it as one.

## The answer to B's honest question is a third one

B named two possibilities — the check regressed, or the world changed so the
mutation no longer produces a defect. Both want work. There is a third, and it
wants none:

> **the run never measured the mutated world at all.**

`canfail` mutates source, runs `npm run build`, and then measures whatever
`SHOT_URL` serves. **It never checked that those are the same thing.** If the
server is serving another tree — or a stale bundle — the world under test never
had the mutation, every case passes, and every case is scored SLEPT.

This is documented *inside `canfail.mjs`* by an earlier author who lost a round
to it: `0/3 SLEPT` against 4177, `3/3 CAUGHT` against their own port, and

> "a red sends somebody to rewrite a check that works. I was one step from
> doing exactly that."

Measured now: **4177 serves `4ea126341+`; my tree is `4c653d050`.** A false RED
is the expensive direction, because the rewrite it provokes is how a guard that
did work stops working.

**I have not touched any of the five checks.** Rewriting six demonstrably
working guards on the strength of a report the instrument could not substantiate
is the one action guaranteed to make things worse.

## The structural half — the real fix, and it is mine

### 1. `SLEPT` is now provable, or it is not reported

`canfail` compares the entry bundle it BUILT against the one the server SERVES —
Vite content-hashes it, so this is a string compare costing nothing — and
mechanises B's two questions instead of leaving them to the reader:

| verdict | meaning | what it wants |
|---|---|---|
| `NOT-RUN` | served bundle ≠ our bundle | nothing was measured; aim it and re-run |
| `INERT` | our bundle unchanged by the mutation | the mutation compiles to identical bytes, so it cannot produce a defect — **the CASE is wrong**, retarget it |
| `SLEPT` | the world demonstrably changed and the check still passed | **a real sleeping guard** |

A whole-run wrong-world now exits 3 before scoring anything, rather than
producing a screenful of false reds. On a dev server it says so and does not
pretend to have proved what HMR gives by construction.

### 2. Nobody would have learned this from a green board

`checks.mjs` only runs canfail cases under `--selftest`, and **`land.sh` did not
run `checks.mjs` at all** — the merge train typechecks and nothing more. So a
guard could stop guarding and every dashboard stayed green.

canfail now writes `.canfail-last.json` on a full run, and `land.sh` reports it
on every land:

```
GUARDS: 41/43 caught their mutation  (3 h ago, build 4c653d050)
  ASLEEP: demo-one — these guard nothing right now
  STALE — older than a day. cd street && node scripts/canfail.mjs
```

Never run there, and it says so loudly rather than silently.

**It reports rather than gates, and that is a judgement.** canfail is a build and
a browser per case — minutes each — and a merge train that takes an hour is a
merge train nobody runs. Gating on it would make the train the thing that gets
bypassed, and a bypassed gate guards less than a loud report.

**One honest limit:** the stamp is per-worktree and gitignored, because ten
builders committing the same file is the `LEDGER.md` conflict all over again. So
`land.sh` reports the stamp in the worktree it runs from. If the desk wants a
board-level number, that wants a stamp per builder collected at land, and I would
rather be asked for it than invent the format.

## What I would want checked next

The five were reported from a real run and I cannot see the environment it ran
in, so I am not claiming B measured carelessly — I am claiming the instrument
could not distinguish the cases, and now it can. **If they report SLEPT again
after this change, that is a real finding and I will take it.**
