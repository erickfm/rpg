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




## Editing `notes/LEDGER.md`: your own rows only, OPEN -> LANDED only

Ten agents appending to one file is a conflict machine, and it has already cost
a real delay: G's church and library work sat unlandable behind a LEDGER.md
conflict in which G had moved its pew row to LANDED and E had moved its fence
row within the same three lines. Both edits were correct. The file still would
not merge, and the merge train reported G as broken.

So:

- touch **only rows whose owner is you**
- move them **only OPEN -> LANDED**, and only the status cell and the evidence
  cell
- **never** re-sort, reflow, realign or tidy the table — a whitespace change
  conflicts with every concurrent edit
- **never** write CONFIRMED. Only the desk or the auditor may, and only after
  someone who did not build it has watched it work

If you hit a ledger conflict, resolve it by taking the **most advanced status**
of each row (OPEN < LANDED < CONFIRMED) and keeping both sides' evidence. The
two writers are nearly always advancing different rows, so almost every one of
these conflicts is a false one.


## Keep `notes/status/<YOU>` current — this is not optional

One line, rewritten whenever your state changes:

    STATE | what I am on right now | who or what I am waiting on

`STATE` is `WORKING`, `BLOCKED` or `DONE`. Full protocol and examples:
`notes/status/README.md`.

The user asked for this by name: *"i want you to be able to somehow know if any
worker is blocked at any time."* Until now the desk could only INFER your state
from the outside — spinner, commits, a BLOCKED file it might not read for an
hour. Inference cannot see the one case that matters most: **a worker that
knows it is stuck.** Waiting on another builder's export looks exactly like
thinking hard, and that has cost this project hours twice.

`scripts/board.sh` prints your declaration beside what your pane is actually
doing and flags the disagreements — `WORKING` with no spinner and no commit for
25 minutes means you died mid-item; `DONE` with live ledger rows means you
stopped early. So declare honestly rather than tidily. **`BLOCKED` is never a
failure — an unreported block is.**


## Before you read your queue, run `scripts/live.sh <you>`

Your queue file and the ledger do two different jobs, and reading the queue for
the wrong one is what has been wasting your time:

    notes/LEDGER.md            IS IT STILL LIVE?   status, one row per request
    notes/queues/<you>.md      WHAT AM I BUILDING? the brief, the ruling, the why

`scripts/live.sh <you>` prints the ledger rows still open for you. **That is
the authoritative list of what to build.** Read the queue file for HOW — the
brief, the user's own words, the desk's rulings — not to work out WHETHER.

This exists because two builders reported the same thing on the same round. B
accounted for all 16 unchecked items in its queue as done, void or superseded.
F took five consecutive items and found every one already delivered, and put
the cost exactly: *"I am spending most of each pass proving that finished work
is finished, and a builder cannot tell a stale item from a live one by reading
it."* Both were right, and both were right to stop and say so rather than
build it again.

**If your queue file lists something `live.sh` does not, it is finished or
void.** File a one-line note naming it. Do not build it a second time, and do
not assume the desk knows.


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


## Grade your own work before you report it done

The user's instruction, given about the park after ten disappointing rounds,
and it applies to everything:

> *"take screenshots yourself and grade it and make sure you are impressed with
> it. be skeptical."*

Before you report an item finished:

1. **Take your own screenshots** of it, from where a PLAYER stands — standing
   eye height, walking distance, and every angle it can be seen from.
2. **Grade them skeptically.** Not "did I do what the brief said" but "would
   this impress someone who has been disappointed before."
3. **Fix what you graded badly, re-shoot, re-grade.**
4. **If you are not impressed, do not report it done.** Say what you could not
   solve instead.

Almost every rejected item this session would have been caught by step 2. The
builder had done what the brief said and never looked at the result the way the
user would.

## When `live.sh <you>` is empty, you become a VERIFIER

Do not idle and do not invent work. **Verification is the bottleneck in this
project**, not building: at one point 51 rows sat LANDED and unchecked against
a single auditor, which meant fifty-one things the user had asked for were
built, working, and still counted as unfinished.

So when your own rows are done:

1. `scripts/ledger.sh` — take LANDED rows that are **not yours**
2. Go and **watch the thing happen in the world**. Evidence means somebody
   watched it, not that a commit exists
3. Judge from **where a player actually stands**, and say in the finding which
   station you used. The auditor once withdrew its own CONFIRMED for judging
   the park from a spot 1.1 m from the war memorial and 11 m from the gate —
   the canonical station is the gate, arriving on foot
4. Holds → CONFIRMED, with what you saw. Does not → say so plainly and the desk
   routes it back

**A rejection from you costs one message. A false CONFIRMED costs the user
another screenshot**, and he has already had to send several twice.

Two hard rules: **never confirm your own work** — only someone who did not
build it may — and **never re-sort or reflow `LEDGER.md`**, because eleven
writers share one file and a whitespace change conflicts with every concurrent
edit.
