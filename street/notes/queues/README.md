# Agent queues

One file per builder. **The desk writes; builders only read.** That asymmetry is
deliberate — if both sides edited these files they would conflict on every
merge, which is the exact problem the queue exists to solve.

- **Desk** appends tasks, reorders them, and moves finished ones to `## Done`.
- **Builder** reads its file, takes the top unchecked item under `## Now`,
  does it, commits, then RE-READS the file (the desk may have reordered while
  it worked). It never edits the file.
- **Completion** is reported in the builder's handoff note, not here.

`scripts/queues.sh` prints every queue at once — that is the desk's answer to
"what is each agent doing and what is behind it".

Why this exists: before it, queueing was just messages typed into a builder's
terminal. That meant no visibility into what was pending, no way to reorder, no
survival across a context reset, and no accounting — one builder silently
accumulated ten items while a high-value request sat behind low-value work for
three separate asks.
