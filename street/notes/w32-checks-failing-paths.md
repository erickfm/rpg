# w32 — item 70: checks that print failure and exit 0

**Port used: 4188** (proved free, `000`, before starting; server shut down after.)

**This item is PARTLY DONE and I am handing back the largest part of it with a
map.** What landed is real and mutation-tested; what remains is the 125-check
behavioural sweep, which is hours of walking and which I did not fake.

## The one line

`checks-registered.mjs` asks *"is every self-testing script registered?"* — a
selftest with no registry row runs never. **Nothing was asking the opposite
question:** a registry row with no selftest runs every suite and has never once
been watched go red, and from the summary that is indistinguishable from a check
that works. That is the shape of all three known cases (`health.mjs`,
`bugsweep.mjs`, `w21-roof-climb.mjs`).

## Measured inventory

`scripts/probes/w32-failpath-inventory.mjs` (no browser, no server, ~20 ms) reads
the `CHECKS` registry and each script:

- **125 registered checks** (126 with the new guard).
- **99 declare a failing path** — `true` (a `--selftest`), a bare string, or an
  array (named `canfail.mjs` cases).
- **23 declare none.** They run on every suite and nothing has ever watched them
  fail: `lot-frontage, mirror-walk, I-apron-grain, people-walk, floaters-walk,
  jump-walk, w21-roof-climb, gaps, feet-check, side-night, I-seat-exit,
  unstick-walk, integration-doors, corner-traffic, crowd-net, side-walk, jitter,
  A-eye-height-holds, K-seat-lets-you-up, O-jail-door-agree, L-slots-inworld,
  L-every-stool-seats-you, L-blackjack-inworld`.
- **3 are legitimately exempt** — guards over the repo, with no world to break.
- **34 read the flag via `flags(['--selftest'])`**, which
  `checks-registered.mjs` cannot see: it matches the literal
  `argv.includes('--selftest')`. The blindspot is already written up in
  `notes/M-selftest-blindspot.md` and is still open. **I did not fix it** — it is
  a different guard from the one this item asked for, and widening that regex
  changes which scripts that guard demands be registered, which is its own
  measurement.

## What landed

**`scripts/checks-can-fail.mjs`** (new, registered, no browser/server/build).
Every `CHECKS` row must declare a failing path, be `EXEMPT` with a reason, or sit
on an explicit `NO_PROOF_YET` debt register. **A new check cannot join the
registry without one** — that is the item's third DONE WHEN clause.

The debt register is written out by name rather than waved through by a rule, so
the count is visible and can only go down. The guard also keeps the register
honest: a name that later gains a failing path is reported **stale**, so the list
cannot rot into a permanent excuse.

**`scripts/L-every-stool-seats-you.mjs`** — a real defect, and a good example of
the item's own thesis. It read
`process.argv.includes('--selftest') ? '--selftest' : …`, assigning `mode` a
value not in `MODES`, so the next statement exited 2 with a usage message. **The
flag's only effect was to make the script refuse to run.** Measured: exit 2. It
was registered `false`, so the suite never passed the flag and nobody saw it.

I removed the dead detection rather than making the flag tolerated. Tolerating it
would be worse: the script would run its ordinary pass under `--selftest`, exit
0, and the runner would score that as a selftest that caught its mutation — a
check reporting a proof it never ran (GOTCHAS 34). Its real failing path is
sound (`process.exit(bad === 0 ? 0 : 1)`); it simply has no mutation behind it,
and the registry's `false` now tells the truth.

## Mutation tests (all confirmed to change bytes)

| mutation | expected | result |
| --- | --- | --- |
| add a `CHECKS` row with `false` | red | exit 1, "REGISTERED WITH NO WAY TO GO RED — w32-mutant-newcheck" |
| a debt-register row gains `true` | red | exit 1, "THE DEBT REGISTER … HAS GONE STALE — jitter" |

## Two things I got wrong and caught by running them

1. **I misread the runner's polarity.** From reading `checks.mjs` I concluded its
   `--selftest` branch scored backwards — marking `ok` when a deliberately broken
   check exited 0. Running `check-wiring --selftest` settled it in one line: it
   exits **0** and prints "SELFTEST PASSED — the orphan was caught". The
   convention is that a check inverts internally under `--selftest`, so the
   runner is right. **The important consequence:** `checks.mjs --selftest` is
   therefore *not* the sweep this item wants. It proves the selftest path works;
   it says nothing about the exit code on the ORDINARY failing path, which is
   where all three known bugs lived.
2. **My guard's parser was wrong and accused six working checks.** It accepted
   only `true` and `[…]`, but the column has a third shape — a bare string
   naming a canfail case (`['park-repro', '…', 'park-repro']`), which
   `checks.mjs` reads via `Array.isArray(selftest) ? selftest : [selftest]`.
   Six rows use it. The guard's first run reported all six as having no way to go
   red. Caught by running it, not by reading it — the "hand-picked cases test
   your mental model" trap, on my own guard.

## Found and did NOT fix — this is the rest of the item

- **The behavioural sweep itself is NOT done.** DONE WHEN asks that every
  registered check be *made to fail* and its exit status recorded. I did not do
  this, and I want to be exact about why rather than imply otherwise: there is no
  universal way to force an arbitrary check to fail. Pointing them at a dead
  server tests "could not measure" (correctly exit 3), not "measured and wrong".
  The per-check failing path is the `--selftest`/`canfail` mutation, and running
  all 99 of them costs hours — `interiors-walk` alone is 10–25 minutes,
  `M-bank-int-walk` ~90 s, plus the whole `--slow` tier. **This is a real
  multi-hour item and should be queued as one, ideally split by tier.**
- **`checks-registered.mjs` is RED on mainline**, and it is not my doing — I
  touched none of the three. `H-flare-silhouette`, `ledger-intact` and `masonry`
  each offer a `--selftest` and are registered nowhere, so they run never. That
  is three more checks with no failing-path proof *and* no execution at all.
- **The `flags()` blindspot** (34 scripts) — see above.
- **The 23 on the debt register** each need a selftest or a canfail case. That is
  the real backlog this item uncovered, and it is now countable.

## Derived vs. copied

The debt register is **generated**, not typed: the 23 names come from
`scripts/probes/w32-failpath-inventory.mjs` reading the registry. The guard
re-parses `scripts/checks.mjs` at run time rather than keeping its own copy of
the check list, so it cannot go stale against the registry it guards — and it
refuses (exit 2) if its parser matches zero rows, because a parser that matches
nothing would otherwise pass silently, which is the exact failure it exists to
catch.
