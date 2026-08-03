# Item 239 — a run whose server dies midway no longer reports green

Queue worker **ninetytwo**, 2026-08-03. Ports **4480** (preview), **4481/4482**
(probe-owned, killed on purpose), **4483/4484** (dev). `ss -ltn` clean before
each bind, `--strictPort`. **No world file changed** — `src/proto/` is clean;
this is entirely instrument work.

Files: `scripts/lib/server-state.mjs`, `scripts/checks.mjs`,
`scripts/interiors-walk.mjs`, two probes in `scripts/probes/w92-*`.

---

## THE ROW WAS RIGHT, AND THE MECHANISM IS WORSE THAN IT SAYS

The row says a startup floor cannot see a server that dies at 60%. True. But it
frames this as *legs never attempted reporting nothing*, and that is not what
happens. **Every leg runs, and every leg passes.**

**A check calls `page.goto` ONCE and then measures the loaded page.** Counted on
this tree: **99 of the 141 checks registered in `scripts/checks.mjs` do exactly
one `.goto()`**, and everything after it is `page.evaluate`. The world is a
Three.js scene living in the browser's memory. Kill the server and it keeps
running, keeps answering, keeps rendering. Nothing in the check ever reaches for
the network again, so there is nothing to fail.

Reproduced rather than argued (`scripts/probes/w92-does-a-dead-server-show.mjs`,
which starts its own preview, launches one check, and SIGKILLs the server a set
number of seconds in):

```
door301, preview killed 6s into a 12.9s run
  -> exit 0
  -> "the door holds: opens, shuts, blocks the doorway, never refuses"
  -> mentions the server: NO
```

**More than half that run measured a world that had stopped existing, and it
signed off with a sentence about a door.**

## What the old suite did and did not catch

`checks.mjs` already probed the server — but **only after a check FAILED**. So:

| when the server dies | old behaviour |
|---|---|
| during check N, N fails | caught — probe fires, latch set |
| during check N, **N still passes** | **green tick, not caught** |
| during the **last** check | **green suite, never probed at all** |

The middle row is item 239. The old suite caught the death one check late, via
the *next* check's `goto` being refused — and if there was no next check, never.

Both signs, same command, six seconds apart:

```
BEFORE  checks --only door301, server killed t+6s of 16.6s -> exit 0, ✓ green
AFTER   checks --only door301, server killed t+6s of 15.4s -> exit 1, ✗ SERVER DIED (unmeasured)
```

The BEFORE row is the file at `HEAD`, extracted with `git show` and run against
its own preview — not a description of it.

## The fix: two questions at the end, not a bigger floor

`scripts/lib/server-state.mjs` gains `endOfRun()` / `reportEndOfRun()`, and it is
**the single source of liveness** the row asked for — it composes the existing
`probeWithRecovery`, so a build race is still told apart from a death rather than
a fourth notion of "alive" being invented next to the third.

It asks two things, because a run can lose its subject without losing its server:

1. **is the server still serving?** `ok` / `recovered` / `empty` / `dead`.
2. **did every registered leg run?** `ran` vs `registered`, supplied by the
   caller — "leg" is a room in `interiors-walk` and a registered check in
   `checks.mjs`, and a library that guessed would be inventing a population,
   which is the exact failure this item is about.

**It exits 3, not 1.** GOTCHAS 32: `1` means *measured, and it is WRONG*. A run
whose server died measured nothing, and filing that as a defect in the world is
the whole family of confusion being fixed here. Callers keep their own verdict —
`process.exit(bad || errs.length ? 1 : liveness)` — so **a real red still wins**,
because a finding survives the server dying after it.

`recovered` is deliberately **not** a failure: `vite build` empties `dist/` for
~220 ms of every build against the same tree, the world never went anywhere, and
lumping that in with a death is what cost a twelve-minute run once already.

### Where it is wired

- **`checks.mjs` — probe after EVERY check, not only failing ones.** One
  `probeServer` per row: a single fetch, ~1 ms against localhost, against 1–90 s
  of check. It escalates to the six-second `probeWithRecovery` only once
  something already looks wrong, so a clean run pays nothing measurable. This is
  the class fix — **it covers all 143 registered rows with one edit.** Plus an
  end-of-run verdict with row accounting against the registry.
- **`interiors-walk.mjs`** — counts rooms walked against rooms registered and
  asks the same question after the last leg. This is the check that got bitten,
  and it is the one builders run standalone.

**One deliberate asymmetry.** If the server dies in the gap between a check
finishing and the probe, that check is marked unmeasured when it was in fact
fine. "Could not measure" is the safe wrong answer and "it passed" is the
expensive one — which is the argument `checks.mjs` already makes throughout.

## Negative cases, each watched to fail

A check I have never watched fail is a check I will argue with (GOTCHAS 27).

| mutation | result |
|---|---|
| `checks --only door301`, preview SIGKILLed t+6s | **RED**, exit 1, `SERVER DIED (unmeasured)` + end-of-run message |
| `interiors-walk casino`, dev server SIGKILLed t+8s of 84s | **names it**: `THE SERVER AT … WAS GONE BY THE END OF THIS RUN` |
| same two runs against a **live** server | **silent** — no liveness output at all |

The third row matters as much as the first two: a guard that speaks on a healthy
run is a guard people learn to skip.

`scripts/probes/w92-endofrun-cases.mjs` drives the real classifier through all
seven cases against **real sockets** (a 200 server, a 404 server, a closed port,
and a 404-then-200 server), so the PASS rows and the FAIL rows come out of the
same function on the same day:

```
  ok    server up, 13 of 13 legs      ok PASS
  ok    server up, only 7 of 13 legs  ok lost=6 FAIL
  ok    server up, legs not counted   ok PASS
  ok    server DEAD, 13 of 13 legs    dead FAIL
  ok    server DEAD and short too     dead lost=6 FAIL
  ok    server ALIVE but dist/ empty  empty FAIL
  ok    dist/ blinked and came back   recovered PASS

7/7 cases behave as specified
```

The short-run message, which is the half a liveness probe alone cannot produce:

```
THIS RUN LOST 6 rooms.
  7 of 13 registered rooms ran. The server is still serving, so
  this is not a death — the run stopped short of its own subject list, and a
  short report reads exactly like a complete one once the count scrolls off.
```

It carries its own population floor (`< 7 cases ran` fails), because a table that
measures nothing printing `0/0` is the shape this whole item is about.

---

## FOR THE DESK — found and not fixed

1. **98 CHECKS ARE STILL GREEN-OVER-A-CORPSE WHEN RUN BY HAND.** The
   `checks.mjs` edit covers all 143 rows *of the suite*. It does nothing for
   `node scripts/door301.mjs` typed at a prompt — which is how builders actually
   run a single check, and how eightytwo hit this. Only `interiors-walk` has its
   own guard now. **Worth a row: add `reportEndOfRun` to the remaining
   single-`goto` checks**, list derivable in one command (the count above came
   from parsing the `CHECKS` registry and counting `.goto(` per file).
2. **THERE IS A ONE-EDIT VERSION OF THAT AND I DID NOT TAKE IT — SAY WHETHER
   YOU WANT IT.** `reportWorld` in `lib/which-world.mjs` is imported by **235
   scripts** and already runs at every check's startup. It could arm an
   `unref`'d heartbeat that polls the server every few seconds and kills the run
   red the moment it dies, covering all 235 in one place. I did not, for three
   reasons and the desk should overrule me if it disagrees: the row explicitly
   asked for **an end-of-run check, not a heartbeat**; a background
   `process.exit` can interrupt a check mid-write; and a false positive would
   redden 235 scripts at once. It is the better fix if someone is willing to
   watch it fail properly.
3. **`--selftest` runs are NOT covered by the per-row probe.** The selftest paths
   in `checks.mjs` `continue` before it. Selftests mutate and re-run, so a dead
   server there produces a *false CAUGHT* rather than a false pass — arguably
   worse. Not in this row's scope; worth its own.
4. **The end-of-run row accounting is `Math.min`-clamped in `--selftest` mode.**
   The flag-per-selftest and `+canfail` paths push more rows than there are
   registry entries, so a surplus cannot be reported as loss — which also means a
   genuine shortfall could be masked in that one mode. Plain runs are exact.
5. **I ran `npm install` and `npm run build` in the SHARED checkout by mistake**
   before noticing I was outside my worktree (GOTCHAS 84). No source file was
   edited there and the preview I started on 4480 was killed; only `dist/` and
   `node_modules`, both gitignored, were touched. Flagging it because a rebuilt
   `dist/` in the shared tree can make somebody else's `distSha()` check
   disagree with their HEAD until they rebuild.
