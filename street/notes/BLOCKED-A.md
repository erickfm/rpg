# BLOCKED — A is out of work, and it is not a failure of the queue

**State, measured just now:**

```
scripts/live.sh A     0 live · 0 awaiting a check
LEDGER.md             0 LANDED rows anywhere — nothing left to verify, mine or anyone's
OPEN rows routed to A 0
unlanded commits       5
```

I have been reporting this in prose for several rounds. **Writing the file is the
protocol and I should have done it sooner** — the desk watches `notes/status/A`
and this path, not my messages.

## Why I am not taking anything

The standing rule is: build from the queue; when the queue is empty, verify other
people's LANDED rows; never invent work. All three are exhausted at once — the
queue is empty **and** the verification pile is empty. That is a first this
session and it is why this file exists rather than another report.

Five OPEN rows sit under `desk`, which is a routing queue, not an assignment. I
am not self-assigning from it.

## Three things that would unblock me, in the order I would take them

1. **Route 302 — "make the exteriors match the interiors."** Frontage and
   `ct/tex-world.ts` are mine and the authority flip was my work: the interior
   declares the door in world coordinates and the facade follows. I know where
   the seams are. GOTCHAS 45 already settled that *match* never meant the
   dimensions.

2. **Route 307 — "~15 CONFIRMED rows cite interior coordinates that no longer
   exist."** Mechanically checkable with `scripts/A-confirmed-rests-on.mjs`,
   which I built for the 28-rows-resting-on-nothing sweep — same shape, one
   predicate over. Interiors moved +80 m when `ct/int-bank.ts` was inserted,
   which is exactly the kind of drift that leaves citations pointing at nothing.

3. **Run the merge train.** Five commits are waiting and only accumulate: the
   210/213-row sweep, the artifact re-pack, C's seat-exit evidence, and two
   corrections of my own claims. **None can be dropped** — I checked that
   carefully after nearly deleting one by misreading an append as a rewrite.

## Two open questions I cannot answer from here

- **The bed's `[E]` fires nothing on mainline**, controlled twice, contradicting
  H's result on their own tree. One run on the integrated world settles it.
- **`street/dist/artifact.html`** is packed at `af33304a7`, verified standalone,
  and unpublished. Publishing is outward-facing and my queue says hand it back.

## Not blocked on

Anything I own. `ct/tex-world.ts`, `ct/paint.ts`, `ct/bank.ts` and `scripts/**`
are all green: the ledger resolver's selftest passes 9 of 9, my four registered
checks exit 0, and the sweep reads 213 CONFIRMED rows with 0 resting on nothing.
