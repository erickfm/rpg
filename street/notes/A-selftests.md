# Builder A — my own two checks had never been watched fail

Landed in **`8a34f98e`**, `scripts/density.mjs` + `scripts/nightgrade.mjs`.

`a84cf885` puts it exactly: *"a script that is gone does not fail, it just stops
being run."* I have made that argument at three other people's tools this week —
the bay camera, `masonry.mjs`, `seampairs.mjs` — and had not applied it to my
own. Both of these report **0**, and 0 is also what a check that has quietly
stopped working reports. `check-seethrough` has had a `--selftest` since the day
I wrote it. These two never did.

## `density --selftest`

Corrupts one masonry declaration at runtime — a stamp claims it was painted for
a width 40 % off the face it is on — and requires the check to go red.

```
selftest: corrupted 1 masonry declaration — this MUST now go red
  1 PAINTED FOR ONE SIZE AND MAPPED TO ANOTHER
SELFTEST PASSED
```

## `nightgrade --selftest`, and the lever that did not work

The obvious mutation is to clear a sheet's `selfLit` — it is graded, it is
unchanged, and only that stamp excuses it. **It does nothing.** props.ts
re-stamps `selfLit` in its per-frame pass and the flag is back before the probe
reads it.

**A mutation the world repairs is not a mutation** — and I only learned that by
watching the selftest fail, which is the whole argument for writing one. Had I
shipped it without running it, `nightgrade` would have carried a selftest that
passes by never firing, which is worse than having none: it would certify the
check as sound every time.

So it goes onto ground the dimmer never walks: **claim one of the 456 ungraded
materials was graded.** Nothing rewrites those, so the claim sticks, and it is
then exactly the shape the check exists to find — offered to the dimmer, excused
by no stamp, unchanged between noon and 23:00.

```
selftest: claimed 1 ungraded material as graded — this MUST now go red
SELFTEST PASSED — the unexcused material was caught (1)
```

Both mutations are runtime only. Nothing on disk changes, the world is not
touched, and the normal runs stay green.

## Where my tools stand now

| script | can it fail? | has it been watched fail? |
|---|---|---|
| `check-seethrough.mjs` | yes | **yes** — `--selftest` |
| `density.mjs` | yes | **yes** — `--selftest` |
| `nightgrade.mjs` | yes | **yes** — `--selftest` |
| `check-wiring.mjs` | yes | **yes** — `--selftest` (`f6f09834`) |
| `seampairs.mjs` | **yes** — like-for-like and brick-vs-brick disagreement | **yes** — `--selftest` (`57aa9a6c`) |
| `fpdiff.mjs` | prints only | **yes** — classifier proven both ways on a mutated fingerprint |
| `scenedump.mjs` | measurement, not a check | n/a |

**`seampairs` closed (`57aa9a6c`).** I wrote the line above a week ago, then
spent that week fixing three reporting bugs in that very script while leaving it
unable to report anything as wrong. A tool that always exits 0 is a tool nobody
has to read.

It fails on the two conditions that are actually defects — like-for-like
disagreement, and a face declaring `'brick'` disagreeing with the masonry beside
it. Everything else stays context: 63 unjudgeable pairs failing a build would
teach people to pass `--force`, and a missing declaration is not a fault.

`--selftest` doubles one stamped texture's `repeat.x`. Measured density is
`(canvas width × repeat) / face width` and the stamp is untouched, so that face
still **declares** 8 px/m while **drawing** 16 — the exact defect. One mutated
face produces 7 disagreeing junctions, because it meets seven neighbours.

## `check-wiring` closed (`f6f09834`) — every tool of mine has now been watched fail

I twice let this one off with "it fired for real on five unbuilt modules". That
is exactly the evidence a stale camera offers: *it worked once.*

And it was the worst candidate for that excuse. This check exists because an
unwired module is **invisible** — it typechecks, it builds, the sweep is clean
and the fingerprint is stable, because an unreferenced module is simply absent.
**A check for invisible things is the one you cannot tell has stopped working**,
since a clean run and a broken run look identical.

`--selftest` writes a real orphan to `src/proto/ct/__selftest-orphan.ts`
exporting `buildSelftestOrphan()`. A genuine file, because the fault being
detected *is* a file on disk that nothing references — faking it in memory would
test the decision and not the scan. Cleanup runs inline **and** on process exit,
so an unhandled throw cannot leave a stray module to break `tsc` for whoever runs
next. Verified after: no stray file, `git status` clean, `tsc` clean.

| tool | watched fail |
|---|---|
| `check-seethrough` | yes |
| `density` | yes |
| `nightgrade` | yes |
| `seampairs` | yes |
| `fpdiff` | yes — classifier proven both ways |
| `check-wiring` | **yes** |

`scenedump` remains a measurement rather than a check, and has no verdict to
mutate.
