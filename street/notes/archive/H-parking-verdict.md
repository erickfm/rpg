# Audit finding D, "parking varies but never re-rolls" — verdict: not a defect

**Asked for in `notes/BLOCKED-B.md` item 2** and again in
`notes/B-ground-report.md`: *"the seed lives in `ct/rng.ts` and the parking draw
in `ct/cars.ts`, neither of which is mine. Desk's call and someone else's file."*
The draw is mine, so here is the ruling with the measurement behind it.

**Verdict: close it. "Never re-rolls" is the feature, not the fault — and
changing it would break the project's main verification tool.**

## The two halves, separately

**"Parking varies" — already true, and already guarded.** Kerbside cars draw a
z offset off the seeded stream and a class from `PARK_CLASS`, giving different
kerb gaps and yaws. `scripts/parking.mjs` (not mine) already checks the
distribution side: that perfect parking still happens, that the row never comes
out machined, that the draw can never exceed the guards.

**"Never re-rolls" — true, deliberate, and load-bearing.** Measured, not
assumed: `scripts/park-repro.mjs` opens the world in two independent browser
contexts and compares every stationary car. **24 cars, byte-identical to five
decimal places.**

## Why acting on it would be a real regression

The seeded stream is what makes `npm run fp before` → change → `npm run fp
after` → `npm run fpdiff` mean anything, and that loop is how this project
proves a change did not move the world. `CLAUDE.md` requires it. `GOTCHAS.md`
§1 and §2 exist because of it.

If parking re-rolled per load, then **every fingerprint taken downstream of the
parking draw would differ on every run**, for reasons with nothing to do with
the change under test. Parking sits early in the build, and three.js burns four
`Math.random()` calls per object in `generateUUID`, so re-rolling it re-grains
the unseeded paint of much of what follows. The diff would still print numbers.
They would just stop being evidence. That is the worst kind of regression —
it does not break the world, it breaks the ability to tell whether the world
is broken.

I watched exactly that happen while testing this: swapping the draw's `rnd()`
for `Math.random()` moved cars up to **0.97 m between two loads of the same
build**, and the fingerprint that follows them moves with it.

## If the user does want a different street each playthrough

That is a legitimate thing to want, and it is **not** what this finding asks
for. The shape that does not cost the toolchain is a **world seed that is fixed
by default and overridable** — `?seed=` or similar — so an ordinary load and
every probe stay reproducible, and only a deliberately seeded session differs.

That is `ct/rng.ts`, which is not mine, and it changes the meaning of every
fingerprint file already in `shots/`. **Desk's call, and a user decision about
what the world is, not a bug fix.** I have not touched it.

## What landed

`scripts/park-repro.mjs` — the missing half of the guard. Two independent
loads, every stationary car compared by identity it carries rather than by
where it is. Exit 1 FAIL, exit 2 INCONCLUSIVE, and both were watched:

| break | result |
|---|---|
| parking draw uses unseeded `Math.random()` | `2 FAIL` … *"cars are somewhere else on the second load"*, exit 1 |
| `makeCar` stops stamping `userData.body` | `INCONCLUSIVE — found 0 and 0`, exit 2 |
| restored | pass, exit 0 |

Reading node's *own* exit status, not a pipeline's — `exit=$?` after a pipe
reports `grep`'s status, which had already made two earlier failure-watches on
this project look like passes.

## Two things for the desk, in other people's files

1. **`scripts/parking.mjs` prints `FAIL` and exits 0.** Its checks are
   `console.log(cond ? 'OK  ' : 'FAIL')` with no `process.exit(1)`, so a real
   regression in the parking distribution is invisible to anything that reads
   exit codes. Not my file; worth a one-line fix by whoever owns it.
2. **`scripts/fpdiff.mjs` crashes with a raw `TypeError` when given no
   arguments** — which is what `npm run fpdiff` does. It should say "give me
   two fingerprints".
