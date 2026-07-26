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

### 1b. …and the proof that actually applies here

The bundle comparison only works against a **preview** server. Measured: both
4177 and 4188 serve `/src/main.ts` — they are **dev** servers, so that proof
would have been skipped exactly where the problem was reported, which would have
made it decoration.

A Vite dev server hands back the transformed module for any source path, so the
real proof is a hash compare on the file the case mutates:

```
GET http://localhost:4188/src/proto/ct/tex-world.ts     460 902 bytes
```

If the served module is byte-identical before and after the mutation, the server
never saw the edit and the case is `NOT-RUN`. Generic, one GET, no per-case
witness string to drift out of step with somebody's source — and it is checked
*before* spending a browser, because a case that cannot be scored should not cost
a minute to not score.

**My first version of this fix was itself broken**, and it is worth recording
because it is the same fault class: the entry-point pattern anchored the
extension to the closing quote, so it missed a dev server's
`/src/main.ts?t=1785047070979`, returned null, and — since "no entry" was fatal —
would have exited 3 against **every** dev server. canfail broken outright by the
change meant to make it trustworthy. Caught by running it against both ports
before believing it.

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

## The full suite: 42/43, and the sleeper is none of the five

```
42/43 checks caught their mutation
  FAIL wetness  SLEPT  the street bone dry on the last drop of rain
```

Every one of the five reported guards CAUGHT in the full run, and so did
`crowd-lane`. The single sleeper is **`wetness`, which was not on the list.**

**And `wetness` is FLAKY, not asleep.** Five identical invocations:

```
CAUGHT · CAUGHT · SLEPT · SLEPT · CAUGHT
```

That is the missing mechanism, and it explains a five-at-once report better than
sudden rot in one module: at roughly even odds per run, a 43-case suite lands a
cluster of SLEPTs, and a cluster in one module reads like a common cause because
that is what a common cause looks like.

Note the new verdicts did **not** fire here — the mutation demonstrably reached
the world — so by the stricter definition this is a true SLEPT. The instrument is
distinguishing correctly.

**I built a retry for it and took it out again.** Re-running the check against the
same mutated world does not stabilise it: when `wetness` sleeps it sleeps on the
retry too, so the non-determinism lives in the built world or the run rather than
the invocation. Shipping it would have put an unproven mechanism in the one tool
whose entire job is trustworthiness — the exact fault this file exists to catch.

> **ROUTE B** — `wetness` is flaky at about even odds. The case mutates
> `ct/props.ts` and the check is `wetness.mjs probe`. It wants its
> non-determinism removed, **not** a rewrite: the guard detects the defect fine
> when it runs at all.

## What I would want checked next

The five were reported from a real run and I cannot see the environment it ran
in, so I am not claiming B measured carelessly — I am claiming the instrument
could not distinguish the cases, and now it can. **If they report SLEPT again
after this change, that is a real finding and I will take it.**
