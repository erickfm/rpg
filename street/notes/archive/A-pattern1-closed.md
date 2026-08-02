# Builder A — pattern #1 is finished, and the last of it was a method call

Landed in **`4f1214f3`**, `ct/civic.ts` only, under the desk's standing
cross-file density mandate. Rebased immediately before starting, as the mandate
requires.

## The ownership check flags this, and it is right to

`scripts/ownership.sh A` reports **"1 file(s) out of bounds"**, because
`ct/civic.ts` is E's and the mandate lives in my queue file rather than in
`OWNERSHIP.md`. Saying so here rather than letting it look like I crossed a
boundary quietly.

The grant, verbatim from `notes/queues/A-shared.md`:

> This needs `tex-world.ts` (yours), `ct/street.ts` (D's) and `ct/civic.ts`
> (E's) to change together in ONE commit… The desk is granting it to you
> because you have the context and three builders coordinating would be worse.

Conditions honoured: one commit, rebased immediately before, **only** the
density/canvas derivation, nothing else in the diff.

**Small gap worth the desk knowing:** `ownership.sh` cannot see a mandate
granted in a queue. Every legitimate cross-file commit will trip it, so the
signal it gives is "check this was authorised", not "this was wrong" — which is
fine, as long as nobody starts ignoring it.

## What was actually left, which was not what the item said

The item describes a **density** fault: painters computing their own px/m. That
is closed and has been for a while. Measured now:

- all eight masonry handles in `ct/street.ts` use `.paint()`
- most of `ct/civic.ts` already did too — its flank painter three hundred lines
  above the ones I fixed

What remained was narrower and easier to miss. Civic's **nave, gable and tower**
called `masonry()` to *size* the canvas — so the density was correct — and then
called `pixTex(W, H, …)` **directly instead of the handle's `.paint()`**. The
canvas was right; the stamp was absent.

```
declared masonry faces  236 -> 241
UNJUDGEABLE pairs        10 -> 7
distinct faces missing    3 -> 1
brick vs brick                0, unchanged
```

**I routed these to E last turn as though they needed a decision.** They needed
a method call, in a file I already had a mandate for. I had the mandate the whole
time and had stopped re-reading the item that granted it — the same failure as
missing the artifact item sitting in my own queue.

## Proven a no-op on pixels, and the control earned its keep again

The textures hash had moved `dac59c30 → 4afd7bb6` since my last reading, and my
first instinct was that I had done it. Stashed, rebuilt, dumped, compared:

```
textures   IDENTICAL
structure  IDENTICAL
```

The move was the base. `paint()` **is** `pixTex(W, H, draw)` plus the stamp, so
it cannot change a pixel — and that is now measured rather than reasoned, which
is the difference that has caught me out three times this week.

## One face left

A single unstamped face remains in the UNJUDGEABLE column. It is `pavingTex` at
32 px/m — **correctly not masonry**, deriving from real metres exactly as
GOTCHAS §5 asks. One `declareSurface(tex, 'ground')` retires the category
entirely, and it is E's line to write.
