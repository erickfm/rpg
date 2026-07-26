# Agent queues

One file per builder. **The desk writes; builders only read.** That asymmetry is
deliberate — if both sides edited these files they would conflict on every
merge, which is the exact problem the queue exists to solve.

- **Desk** appends tasks, reorders them, and moves finished ones to `## Done`.
- **Builder** REBASES ON MAINLINE FIRST, then reads its file, takes the top
  unchecked item under `## Now`, does it, commits, then RE-READS the file (the
  desk may have reordered while it worked) and **immediately takes the next
  one**. It never edits the file.

  **Do not stop after one item.** Work your queue continuously until it is
  empty or you are genuinely blocked — a conflict you cannot resolve, a
  decision only the desk can make, or a file you do not own. Then say which of
  those it is and stop.

  This matters more than it sounds. Every builder returning to idle after a
  single item turns the desk into a dispatcher that must poll nine agents and
  re-prompt each one, and the user experiences all of that latency as the
  project being slow. It has been measured: nine agents finished an item
  within a few minutes of each other and every one of them sat idle waiting to
  be told to continue, with fifty items queued between them.
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


---

## One committable outcome per item

A queue item must name **one thing that can be committed on its own.** Not two,
even when the second obviously follows from the first.

This has a measured cost. The desk once wrote an item that said, in effect:
*wire these three finished rooms into the world, AND close the structural hole
that let them be forgotten.* The builder went for the structural half — the
harder, more interesting one — and ground for **74 minutes without committing
anything**, while three rooms the user had asked for stayed out of the world
and the desk's status board reported the agent as healthily "busy".

So:

- **Smallest shippable thing first, as its own commit.** If the fix is three
  lines and the proper solution is a refactor, the three lines ship first and
  the refactor is the next item. The user gets the room; the codebase gets the
  fix; neither waits for the other.
- **If an item contains the word "and", look hard at it.** Usually it is two
  items.
- A builder that finds an item is really two should **say so and do the
  smaller half first**, rather than picking the interesting one.

## Raising a blocker

If you cannot proceed — you need an export from a file you do not own, a
decision only the desk can make, or another builder's work has to land first —
**write `street/notes/BLOCKED-<you>.md`** saying exactly what you need and from
whom, then take the next item in your queue.

`scripts/desk.sh` surfaces that file as an ACTION. Do not rely on the desk
reading your handoff note: a builder once sat blocked on a one-line export that
another builder could have added in a minute, and the desk only discovered it
by chance while reading a report for another reason.

Delete the file yourself once you are unblocked.


## Rulings go in the queue file, not in a message

A decision the desk makes — which of two candidates is the fault, whether to
revert, which way an object should face — must be written into the builder's
queue file, not sent as a tmux message.

Messages die. A ruling on the vehicle wheels was delivered twice and lost
twice: once when the builder's session exited, once when it stalled and the
message scrolled away. The ATM ruling was lost the same way. Each time the
builder re-raised the same blocker and the desk answered it again, having
learned nothing.

The queue file survives session exits, stalls, compaction and restarts. That is
the entire reason it exists — and it is why a restarted agent can pick up
exactly where the last one stopped.
