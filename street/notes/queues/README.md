# Agent queues

One file per builder. **The desk writes; builders only read.** That asymmetry is
deliberate — if both sides edited these files they would conflict on every
merge, which is the exact problem the queue exists to solve.

- **Desk** appends tasks, reorders them, and moves finished ones to `## Done`.
- **Builder** REBASES ON MAINLINE FIRST, then reads its file, takes the top
  unchecked item under `## Now`,
  does it, commits, then RE-READS the file (the desk may have reordered while
  it worked). It never edits the file.
- **Completion** is reported in the builder's handoff note, not here.

`scripts/queues.sh` prints every queue at once. **`scripts/desk.sh` is the one
you should actually run** — it prints the same thing plus whether each agent is
genuinely working, what it has committed that is not landed, and whether its
queue has gone stale.

---

## A queue file is a claim, and it goes stale

This has now bitten twice in one session, both times the same way: **the desk
wrote a queue file listing work that had already landed.** Builder B was given
four items it had finished hours earlier and a "get green" blocker that no
longer existed; builder C was given six. Both builders noticed and said so.
The desk had not — it had been routing new work into files it had stopped
maintaining, and told the user a builder was blocked when it was not.

Two rules come out of that:

1. **The builder's report is the authority on what is done; the queue is only
   the desk's belief about it.** When they disagree, the report wins. If you
   are a builder and your queue lists something already on mainline, say so
   plainly and move on — do not redo it, and do not edit the queue yourself.
2. **Before adding to a queue, reconcile it.** `desk.sh` flags any queue whose
   builder's report file is NEWER than the queue — that is the signal the
   builder has told the desk something the desk has not folded in. Read the
   report and move the finished items to `## Done` before you append.

The failure is asymmetric and that is why it kept happening: a stale queue
looks completely normal from the desk. Nothing is broken, the build is green,
the agent is busy. It only shows up as the user waiting for something that was
finished long ago.

Why this exists: before it, queueing was just messages typed into a builder's
terminal. That meant no visibility into what was pending, no way to reorder, no
survival across a context reset, and no accounting — one builder silently
accumulated ten items while a high-value request sat behind low-value work for
three separate asks.
