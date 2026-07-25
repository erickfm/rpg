# Builder A — the artifact, packed and handed back, and does it still earn its keep

Closes the queue item *"Republish the playable artifact"*, both halves.

## 1. Packed and verified — the desk publishes it

```
dist/artifact.html — 839425 bytes, build cea5e99e
__ct initialised, 3383 meshes, opens standalone from file://, drawing
```

`npm run artifact` packs and verifies in one step. The queue says *"the desk
publishes… hand it back rather than publishing it yourself"*, so I have not — it
is sitting in `dist/` ready.

**Note the staleness clock starts immediately.** It was built at `cea5e99e`; by
the time anyone publishes it, mainline will have moved. That is not a criticism
of the packer, it is the nature of a manual snapshot in a tree taking dozens of
commits an hour, and it is most of the answer to the second question.

## 2. Does it still earn its keep? — **Not as a distribution channel. Yes as a snapshot.**

`.github/workflows/pages.yml` deploys on **push to `main` or
`add-stick-and-city98`** whenever `street/**` changes. Every builder lands on
`add-stick-and-city98`. So:

| | GitHub Pages | the artifact |
|---|---|---|
| currency | **always** — auto on every land | stale the moment anything lands |
| effort | zero | pack + a human publishing step |
| content | identical build | identical build |
| URL | stable, public | stable, public |

For *"somewhere the user can play the current world"*, **Pages wins on every
axis and the artifact is strictly worse.** Keeping both means one of them is
usually wrong, and the wrong one has no label saying so — which is the exact
shape of the stale-build problem the build stamp was added to solve.

### What the artifact is still uniquely good for

- **A pinned snapshot.** Pages only ever shows the tip. If the user wants to
  keep "the version I played on the 25th" — to compare, or because something
  later regressed — a single file is the only thing that does that.
- **Offline and self-contained.** One file, no network, no host. It opens from a
  USB stick or an email attachment. Pages cannot do that.

### Recommendation

**Stop republishing it on a cadence; publish it on purpose.** Point day-to-day
playtesting at Pages, which is current for free, and pack an artifact when
someone wants a specific build to keep — a milestone, a before/after, something
to hand to a person who is not going to open a URL.

That also fixes the honesty problem: an artifact published deliberately at a
named build is *supposed* to be a snapshot, so being behind mainline is its
purpose rather than a defect. Every build now carries its sha in-frame, so
whoever opens one can see exactly which world they are in.

**This is a recommendation, not a decision.** The URL and the publishing step are
the desk's.

## Repacked 2026-07-25, on purpose rather than on cadence

Taking my own advice above: today's facade pass is the kind of milestone that
earns a snapshot, because it changed something the user can see on **every
building on the block** at once, and "the version before the facades moved" is a
thing they might reasonably want to go back to.

```
dist/artifact.html — 847109 bytes, build f3b343ec3
__ct initialised, 3307 meshes, mean luminance 99.7, opens standalone and draws
```

What is in it that was not in `cea5e99e`: the window run on every facade
centred and a window restored on nine of nineteen fronts; the thrift store's
display no longer cut by its own door, with a mannequin, transom, panelled
stallriser and gapped hangers; the same door-chop fixed in the block default
(~10 shops) and the burger barn.

**Still not published by me** — the queue says hand it back, and that has not
changed. It is sitting in `dist/`.

One caveat the desk should know before publishing: this worktree is rebased
from outside every minute or two (`notes/A-runner-stale-build.md`), so
`f3b343ec3` will not be the tip by the time anyone reads this. That is fine for
a snapshot — being behind mainline is a snapshot's *purpose* — and the build
stamp in the corner says exactly which world it is.
