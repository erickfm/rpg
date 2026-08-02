# w19 — seat-facing is now a registered check, with two mutations behind it

Queue item 21. Files: `scripts/checks.mjs`, `scripts/canfail.mjs`. Commit
`7f137f5fb`. Port 4184 (the brief gave me 4198; it was already serving somebody
else's world — `ss -ltn` showed 4185-4199 all taken except 4188 and 4190, and
4190 is on the browser's blocked-ports list).

## Root cause, one line

`seat-facing.mjs` was a one-off with no `--selftest`, and `checks-registered.mjs`
takes its population from scripts that carry one — so the audit built to catch
invisible checks was itself blind to this one, and nothing anywhere would ever
have noticed it was not being run.

That is the finding worth carrying forward: **the fifth facing bug shipped, a
check was written for it, and the check was as invisible as the bug.** The item
said "the sixth will ship too" and it was right for a reason nobody had named.

## What I changed

`scripts/checks.mjs` — one row in `CHECKS`, fast tier:

    ['seat-facing', 'does every seat look at something, or at a wall?',
     ['seat-facing', 'seat-facing-wall']],

Fast tier is **measured, not assumed**: 4.4 s against an idle dev server, against
the 36 s that moved `lotwalk` to slow. It measures and does not walk, and
`I-facing` — the same claim for the car lot alone — already sits in the fast
tier.

`scripts/canfail.mjs` — two cases, and two new file constants (`CASINO`, `TAX`).

## Why two cases and not one

The item asked for "a `canfail.mjs` case". I wrote two, on this file's own
`footprint` precedent: the check has two rules, they fail apart, and one case
would have left the other silently unproven.

| case | rule | mutation | what it restores |
|---|---|---|---|
| `seat-facing` | B — turned away from your own furniture | `int-casino.ts`: `yaw: face > 0 ? 0 : Math.PI` → the mirrored ternary | 96 slot stools with their backs 0.37 m from the machines |
| `seat-facing-wall` | A — nose to the wall | `int-tax.ts`: the waiting row's `yaw: 0` → `Math.PI` | three chairs facing plaster 0.58 m away |

Rule B needed its own case specifically because it is the clause a wall test
**structurally cannot reach**: the casino floor is 11 m across, so a backwards
stool is looking at open floor and every nose-to-the-wall predicate in this repo
passes it happily. That is why the original bug survived five facing fixes.

Result, aimed at my own port:

    OK   seat-facing       CAUGHT  96 slot stools with their backs to the machines
    OK   seat-facing-wall  CAUGHT  the waiting row facing plaster 0.58 m away
    2/2 checks caught their mutation
    every mutated file restored byte-for-byte

## Evidence for each clause of DONE WHEN

1. **appears in the CHECKS table** — the row above, and it prints in the suite's
   own summary.
2. **`node scripts/checks.mjs` runs it** — a full default-tier run against 4184,
   ~14 minutes, log at `/tmp/w19-checks.log`. The runner's progress line
   `… seat-facing` at line 278 and the summary row at line 1093:
   `✓ seat-facing   does every seat look at something, or at a wall?`
3. **its canfail case goes red on the mutation** — 2/2 CAUGHT above. I broke the
   world deliberately, twice, in two different rooms, and watched the check go
   red both times.

Baseline before I touched anything: **219 registered seats, 219 look at
something.** The 105-seat red the item quotes is already fixed — w17's casino
ternary landed. So this item was pure guarding, which is what it said it was.

## No `--selftest`, deliberately

Both mutations have to move the WORLD's yaws. The only handle a harness has on
`__ct.seats()` is overriding the registry, which breaks the check's *view* while
leaving the world intact — GOTCHAS 34 says that proves nothing, and it would
certify the check as mutation-proof when it is not. Source mutations are the
honest form here, which is why the row's third field is a case list rather than
`true`. Note that this keeps `seat-facing` outside `checks-registered.mjs`'s
population, so its registration is protected by nothing but this note and the
row itself.

## Found and NOT fixed

Three things, none of them mine, all reproducible from `/tmp/w19-checks.log`:

- **`mutations-quote-real-source` is red on ONE case: `rain`.** 45 cases, 44
  quote live source; `rain`'s needle matches `src/proto/ct/props.ts` 0 times.
  That case is guarding air right now. Not my file's fault and not my case —
  worth a one-line queue item to whoever owns the rain mutation. My two new
  cases both quote real source, proved by canfail applying them.
- **`checks-registered` is red on two scripts** that have a `--selftest` and are
  in no tier: `scripts/H-flare-silhouette.mjs` and `scripts/ledger-intact.mjs`.
  They run exactly never. Same class as the item I just closed, one tier over.
- **`K-tv-off-unless-seated` fails on `SEATED: the set comes on`** — and the
  station it sat at is the BED, not the TV seat ("pressing E sits you on the
  bed"). That reads like the probe picking the wrong seat rather than the TV
  being broken, but I did not chase it and I am not claiming it.

Other reds in that run (`seampairs`, `mirror-walk`, `gotchas-numbers`,
`spot-coverage`, `floaters-walk`, `hashes-resolve`, `N-post-waiting`,
`note-hashes` WRONG WORLD) were all red before my change and none of them
mentions seats or facing.

## Verdict

`node scripts/bugsweep.mjs` against 4184: 93 shots, **zero STATION MISS**, no
console errors — only the standing THREE.Clock deprecation and the Canvas2D
`willReadFrequently` performance warnings, which every run here prints.

No after-images to judge: this change adds no geometry and touches no `src/`
file. The world is byte-identical, which canfail asserts on its own way out
("every mutated file restored byte-for-byte").
