# Builder A — a twelve-minute suite that measured nothing, twice

`scripts/checks.mjs`, `scripts/lib/which-world.mjs`. Both mine.

## What happened

I ran the full suite twice and both runs were void:

```
68 of 68 checks printed MEASURING THE WRONG WORLD
  dist/ was built from  43364fa9b
  this checkout is at   79f0c83ca
```

Nothing failed. Nothing passed either. Twelve minutes each time, sixty-eight
browser launches, and not one measurement.

**Nobody did anything wrong to cause it.** This worktree sits on a merge train
that REBASES, so HEAD moves under a running suite without a file being touched —
`npm run build`, start the suite, the desk lands something, and every check from
that moment on is reading a `dist/` that is no longer this commit. The guard in
`reportWorld` is correct and did its job perfectly sixty-eight separate times;
it just has no way to say it once, in advance, on behalf of the whole run.

## The fix is the argument the runner already makes, applied a second time

`checks.mjs` opens with a comment I did not write and should have read harder:

> So the URL is probed ONCE, first, and a dead port stops the run in a second
> instead of failing thirty checks slowly. "Could not measure" and "measured,
> and it is wrong" are different sentences and the second one is the expensive
> one to get wrong.

That is exactly this bug, for the other way a run can measure nothing. There are
**two** ways: nothing is serving the URL, and the thing being served is not this
commit. Only the first was probed.

So, before any browser starts:

```
dist/ ON THIS DISK IS NOT THIS COMMIT.
  dist/ was built from  43364fa9b
  this checkout is at   79f0c83ca

  A preview serves dist/, so every check below would exit 3 and report
  WRONG WORLD. That is not red — it is nothing measured at all.

  Fix: npm run build   (then re-run; restart the preview if it caches)
```

Twelve minutes becomes one second. No browser needed — `distSha()` already reads
the SHA out of the built bundle and `localHead()` already asks git; both existed
in `which-world.mjs` and were module-private. They are exported now, which is
the whole change to that file.

## And the half a pre-flight probe cannot cover

A probe speaks for the instant it runs. A suite takes twelve minutes and a
rebase takes none, so HEAD can move *during* the run — which is what actually
happened to me. The checks before the move measured a world; the ones after it
measured nothing.

Without saying so, those two are indistinguishable in the summary: ticks for the
first half, WRONG WORLD for the second, reading as "some checks are broken". It
is not that. It is a run that stopped being about anything.

```
THE TREE MOVED UNDER THIS RUN: 43364fa9b -> 79f0c83ca
  Everything after the move measured a stale dist/, so any WRONG WORLD
  above is the rebase, not the check. A green here is provisional.
```

HEAD is captured at the start and compared at the end. Cheap, and it means a
run can no longer be quietly half-meaningless.

**Verified:** the comparison fires on a foreign sha, does not fire on the real
`dist/`, and does not fire on a short-vs-long prefix of the same commit — that
last one matters because the HUD stamp and `git rev-parse --short` need not be
the same length, and a fussy equality here would have blocked every run.

## While I was in there: two of G's checks ran exactly never

`checks-registered` went red the run after G's work landed:

```
scripts/G-rooms-walk.mjs  has a --selftest and is in no tier of npm run checks
scripts/G-vice-walk.mjs   has a --selftest and is in no tier of npm run checks
```

That is the check doing precisely the job it was written for — *"a check that is
not run cannot fail"* — and it caught them within a run of landing.

Registered both in the SLOW tier, beside F's `interiors-walk`, because both
walk. **I ran them first rather than registering blind**, since registering a
red check turns the runner red and that would be my doing, not G's:

```
G-rooms-walk   rc=0   113/113 passed
G-vice-walk    rc=0    18/18 passed
```

Whether those checks are *right* is G's business and I have not touched their
files. Whether they RUN is the runner's business, and the runner is mine.

**An aside worth keeping:** `G-vice-walk` reports *"3 of 4 bulb materials changed
colour across 7 samples"* on the casino marquee. That is an independent
confirmation, from someone else's instrument, of the animated chase materials
that `A-fingerprint.md` found by hashing and that my `nightgrade` flake fix now
excludes by watching across frames. Three tools, three routes, the same three
materials.

## For the desk: something outside rebases this worktree every minute or two

Measured, not inferred. I built, started the suite, and 79 seconds later:

```
dist=772d333f8   head=3aee766e7

git reflog:
  12:04:18  rebase (finish): returning to refs/heads/feat/split-2b     <- mine
  12:05:37  rebase (start):  checkout add-stick-and-city98             <- NOT mine
  12:05:37  rebase (pick) x4 … returning to refs/heads/feat/split-2b
```

I ran one rebase, at 12:04. The one at 12:05 replayed all four of my commits
onto a new base and I did not ask for it — `land.sh` or `live-integrate.sh`
reaching into this worktree is the obvious candidate.

**The consequence is arithmetic: the suite takes twelve minutes and the branch
is rewritten every one or two.** A full green run in this worktree is a coin
flip, and the two void runs above were not bad luck.

**I am not calling this blocked**, and I want to be careful about why. My work
IS verified: every targeted check is green, and I got one clean full-suite run
(`79f0c83ca` at both ends, 0 WRONG WORLD, 46 green). What is impractical is
*re-verifying the full suite after every rebase*, which nothing requires.
Declaring myself blocked on that would be crying wolf — the exact failure I
have spent this session removing from `nightgrade`.

What I would want the desk to decide, since it owns the merge train:

- is an external rebase of a builder's live worktree intended? It is invisible
  from inside — nothing announces it, and before this change it presented as
  sixty-eight checks failing;
- if it is, the full suite wants somewhere stable to run: a pinned checkout, or
  a window where the train holds.

Note the guard is **right** to refuse here, and I nearly talked myself out of
that. A rebase changes the commit id, and my own bytes are identical across it —
so it is tempting to call the mismatch cosmetic. It is not: upstream moved too,
so the replayed tree contains other builders' work that the stale `dist/` does
not. The world really did change. The SHA is not a proxy for anything here; it
is the answer.

## The full suite, on a build that stayed put

```
HEAD 79f0c83ca at start and 79f0c83ca at end · 0 WRONG WORLD
46 checks green, including nightgrade — which is where it went red before
```
