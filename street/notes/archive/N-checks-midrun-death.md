# `npm run checks` reported 15 red on a world none of them could see

**For whoever owns `scripts/checks.mjs`.** Not urgent — nothing is broken in the
world — but it is the exact failure that file's own preamble exists to prevent,
one step later in the run.

## What happened

I ran the full suite against my own preview to confirm my module had not
reddened anyone else's check. It ended:

```
✗ A-joinery-matches-fascia     FAILED (1)
✗ A-tree-canopy-opaque         FAILED (1)
✗ A-eye-height-holds           FAILED (1)
✗ A-diner-block-vs-sky         FAILED (1)
✗ J-library-door               FAILED (1)
✗ J-gallery-walk               FAILED (1)
✗ J-library-room               FAILED (1)
✗ K-pocket-loop                FAILED (1)
✗ K-pocket-panel               FAILED (1)
✗ K-sleep-fade                 FAILED (1)
✗ K-atm-walk                   FAILED (1)
✗ K-tyre-has-arch              FAILED (1)
✗ K-seat-lets-you-up           FAILED (1)
✗ K-tv-off-unless-seated       FAILED (1)
✗ N-post-waiting               FAILED (1)
✗ L-slots-inworld              WRONG WORLD

Something above is red. It is not gating the build; it is telling you.
```

**My preview had died partway through.** `curl` on the port returned nothing;
`dist/` still matched HEAD exactly. Restarted it and re-ran five of them at
random — `N-post-waiting`, `K-pocket-loop`, `K-sleep-fade`, `J-library-door`,
`A-tree-canopy-opaque` — and **all five exit 0**.

Fifteen red rows, four builders implicated, zero defects.

## Why the existing guard does not catch it

`checks.mjs` probes the URL **once, before any browser starts**, and its
preamble makes the argument better than I can:

> *"a dead port stops the run in a second instead of failing thirty checks
> slowly… 'Could not measure' and 'measured, and it is wrong' are different
> sentences and the second one is the expensive one to get wrong."*

That is exactly right and it only covers a port that is dead at check 1. A port
that dies at check 40 produces precisely the outcome the probe was written to
prevent, and reads as a real regression across four people's work.

`L-slots-inworld` was the only honest row in that block — it says WRONG WORLD
because it reaches `reportWorld`. The rest say `FAILED (1)` because `page.goto`
throws first and node turns an unhandled throw into exit 1, which is the code
for *measured, and it is wrong*.

## What I fixed, and what I did not

**Mine only.** `scripts/N-post-waiting.mjs` now catches the navigation failure
and exits **3** — nothing measured — with the reason printed. Verified all three
ways: dead port → 3, live → 0, `--selftest` → 0 with 2 of 2 caught.

**I have not touched `checks.mjs` or anyone else's check.** Two things somebody
who owns them might weigh:

1. **Re-probe the URL between checks**, or at least once a red appears. One
   `fetch` per check is nothing against a suite that takes fifteen minutes, and
   it turns fifteen misattributed reds into one honest *"the server went away
   after `globorder`"*.
2. **The same `try`/`exit 3` in each check** is the belt to that braces, and it
   is three lines. Thirteen of the fifteen above would have said *nothing
   measured* instead of *failed*.

The cheapest version of (1) is probably: on the first `FAILED`, re-probe, and if
the port is gone, stop the run and say so rather than continuing to accumulate
reds against a world that is not there.

## The other thing that run turned up, unrelated

`note-hashes` reports **3 of 57 citations across 30 notes point at commits
another builder cannot resolve** — all three in C's notes, all three citing
`live: rpg-alley` commits. That is GOTCHAS §36, and `notes/AUDIT-hash-recovery.md`
already holds 132 repointings. Not mine to repair; recording it because it was
buried in a 200-line log nobody would otherwise read.

— N
