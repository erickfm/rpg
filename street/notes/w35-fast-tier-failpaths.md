# w35 — item 72: fast-tier checks with no failing path

**Port 4191.** **PARTIAL — 1 of 15 cleared. I am handing the remaining 14 back
rather than reporting the item done.** What is below is enough for the next
builder to start at the mutation and not at the inventory.

## What the item's premise got right, and what it got wrong

**Right:** the 23 checks on the debt register really do run on every suite with
nothing having watched them go red.

**Wrong, or at least incomplete:** the item says *"23 of 125 registered checks
declare NO failing path — sweep the FAST TIER only"* without saying which 23 are
fast. **15 are fast tier, 8 are the walking suites** — split out of the registry
by `scripts/probes/w35-fast-tier-debt.mjs`, which reads both `checks.mjs` and
`checks-can-fail.mjs` so the two cannot drift.

| tier | count | names |
|---|---|---|
| **fast — this item** | 15 | `lot-frontage` `mirror-walk` `I-apron-grain` `people-walk` `floaters-walk` `jump-walk` `gaps` `feet-check` `side-night` `A-eye-height-holds` `K-seat-lets-you-up` `O-jail-door-agree` `L-slots-inworld` `L-every-stool-seats-you` `L-blackjack-inworld` |
| walking — NOT this item | 8 | `w21-roof-climb` `I-seat-exit` `unstick-walk` `integration-doors` `corner-traffic` `crowd-net` `side-walk` `jitter` |

## The "cannot measure" path is already sound — all 15

Ran every one of the 15 against a **dead port**, status read **unpiped**
(`scripts/probes/w35-status-sweep.sh` — nothing is piped, precisely because `$?`
after a pipeline is the last command's status and that has already produced one
false bug report here).

**None exits 0.** So there is no sleeping guard of the `health.mjs` kind — the
"printed a failure and exited 0" class — anywhere in the fast tier.

**But 12 of the 15 exit `1` and only 3 exit `3`,** and that is the confusion the
item itself names: exit 1 for "no server" makes a builder who simply forgot to
start a preview indistinguishable from a genuinely broken world. `L-slots-inworld`,
`L-every-stool-seats-you` and `L-blackjack-inworld` get this right. **The other 12
should be moved to the three-status convention** (0 alive / 1 measured-and-broken
/ 3 nothing-measured) — that is a real, cheap follow-up and it is not what this
item asked for, so I did not do it.

**This is not the same as having a failing path.** A dead port tests "cannot
measure". What was untested, and what the item is actually about, is **measured
and wrong**. That needs a mutation per check.

## Cleared: 1 of 15

**`A-eye-height-holds`** — canfail case **`eye-gate-flat`**, proven **CAUGHT**,
registry row moved from `false` to `['eye-gate-flat']`, name struck from the
debt register (23 → 22).

The mutation restores the original bug: the sight gate built its ray from a bare
`1.6` instead of `apt.gy() + 1.6`, so in room 301 (floor 5.4) the ray started
5.4 m below the floor, was stopped by the slab, and every `[E]` in the room went
unselectable.

## THE TRAP, and it cost me the first attempt — read this before doing the other 14

My first mutation raised the player's own eye in `fp.ts` (`1.62 → 2.90`).
Bytes changed, the build was clean, and **canfail reported `SLEPT`.**

**It was my mutation that was wrong, not the check.** `A-eye-height-holds` says
in its own header that *"the assertion is the symptom, not the arithmetic
above"* — it prints the eye-gap error as a **diagnosis** but asserts on whether
a live `[E]` is actually offered in the spawn room, deliberately, so that it can
go green once the gate is fixed. Raising the player's eye moves the printed
column and does not touch the gate's ray, so the check stayed green **correctly**.

**A check that does not move under the wrong mutation is not a sleeping check.**
Filing it as one is exactly how this repo has twice reported working guards as
dead — `canfail` once reported 0/3 guards asleep when 3/3 were fine. So for each
of the remaining 14: **read what the script ASSERTS on, not what it prints**, and
mutate that. Several of these scripts deliberately separate the two.

## Found on the way, NOT fixed — for the desk to queue

1. **`scripts/checks-registered.mjs` EXITS 1 TODAY, and it predates me.** Three
   scripts have a `--selftest` and are in no tier of `npm run checks`, so they
   **run exactly never**: `H-flare-silhouette.mjs`, `ledger-intact.mjs`,
   `masonry.mjs`. They date to `7ede3c3e5`, not to this session — I confirmed my
   own non-probe edits touched only `canfail.mjs`, `checks.mjs` and
   `checks-can-fail.mjs`. **This is the sibling failure of item 72 and arguably
   worse**: item 72's checks at least run. `ledger-intact.mjs` is the one that
   guards the LEDGER, and it is wired to `npm run ledger` but to no suite.
2. **The 12 fast-tier checks that exit 1 on a dead port** should use exit 3.
3. The remaining **14** fast-tier checks still have no failing path.

## Scripts

- `scripts/probes/w35-fast-tier-debt.mjs` — the fast/slow split, read from the
  registry rather than typed.
- `scripts/probes/w35-status-sweep.sh` — runs named checks and records exit
  status **unpiped**.
