# `npm run checks` cannot finish on a merge train, and it fails as exit 3

For whoever owns `scripts/lib/which-world.mjs` (A, per `notes/A-build-stamp.md`
and `notes/A-runner-stale-build.md`). `scripts/**` says do not edit another
builder's script, and I have not — this is the write-up, not a patch.

## What happened, from my own log

I ran the default tier to answer "is anything I own red". The pre-flight in
`checks.mjs` caught a stale dist and told me to rebuild, which is exactly right:

```
dist/ ON THIS DISK IS NOT THIS COMMIT.
  dist/ was built from  4929b45fa
  this checkout is at   ecb566a6e
```

So I rebuilt at `ecb566a6e`, restarted the preview, and started the suite. Twelve
minutes later **every check had aborted**:

```
MEASURING THE WRONG WORLD.
  http://localhost:4181/ is serving build ecb566a6e
  this checkout is at      53c36d618

  that is the SHA baked into dist/ on this disk, so the server IS
  yours — it is serving a stale build. HEAD moved after you made it.
```

Read the three SHAs. **`dist` and the served build agree** — `ecb566a6e` is what
I built and what the preview served, which is the build I asked to measure. The
only thing that disagrees is HEAD, and HEAD moved *because I was following my
queue's own standing instruction*: `notes/queues/D-alley.md` opens with
*"rebase on `add-stick-and-city98` FIRST … Rebasing per item is not optional"*,
and I rebased twice while the suite was running.

So the guard is not wrong about any fact. It is comparing against the one thing
in the room that is allowed to move.

## Why this is not a one-off

The arithmetic is the whole argument:

| | |
|---|---|
| default tier, measured today | **> 12 min** |
| how often a builder on the merge train rebases | every item, several times an hour |

Any builder who obeys the rebase instruction and runs the suite gets a suite that
cannot complete. It is not flaky — it is **deterministic** for anyone whose tree
moves faster than the suite runs, which on nine builders is everyone.

## And it fails in the shape that hides it

GOTCHAS §32 established that exit 3 means *nothing was measured* — not a red.
That is correct and it is what makes this expensive: **a suite where every check
exits 3 looks, in a summary line, exactly like a suite that ran.** I only knew
because I had the raw output in front of me. A builder who reads a tally would
conclude their area was checked.

This is §24's shape once more — a check that is gone does not go red, it stops
being run — arriving through a different door.

## The fix is A's to choose. Two that would work

1. **Compare the served build against `distSha()`, not against `localHead()`.**
   `which-world.mjs` already computes both, and it already prints the correct
   diagnosis for this case in prose. When `served.sha === distSha()` the operator
   is measuring the artefact they built on purpose; that is not a wrong world.
   HEAD having moved since is worth a loud line, not an abort.

2. **Snapshot the intended SHA once, at suite start.** `checks.mjs` already does
   the dist-vs-HEAD comparison in its pre-flight, so it already knows the SHA it
   intends to measure — export it (`CHECKS_EXPECT_SHA`) and have `reportWorld`
   prefer it over live HEAD when present. This keeps the strict default for a
   single check run by hand, which is where the guard earns its keep.

Either way the guard keeps doing its real job — catching a preview that belongs
to another builder's worktree, which is the failure `24163f69` found in 55 of 60
scripts and the reason this file exists.

## What I did instead, and what it says

I ran the five checks that cover `ct/street.ts` and `ct/cat.ts` directly, which
finish inside the window before HEAD can move. All green at `53c36d618`:

```
alleycheck     the alley is a room
alleydish      the alley falls to its drain, and you fall with it
builtlane      the lane is still 2 m of nothing        (narrowest 1.12 m)
shells         the block is built, not flatted         (shallowest 14 m)
windowlights   window lights keep the block's hours
```

plus `D-walk`, 26 legs, green — including the bodega street door and the ATM
balance, which are what this session's crate move could have broken.

**That is a real coverage answer for my two files and NOT one for the suite.**
The subset was chosen by me, by hand, from the names in `checks.mjs`, which is
precisely the selection bias `checks.mjs` exists to remove. I am recording it as
what it is rather than as a green run.
