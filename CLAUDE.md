# rpg — CROSSTOWN '97

**New here, or working with no memory of this project? Read
`street/START-HERE.md` first.** It assumes zero context and links everything
else in reading order.

## The four documents

Read these; everything else is history or reference.

0. **`street/notes/SESSION-STATE.md`** — **read this first, always.** What is
   unfinished right now and who has it. Everything below is how the project
   works; this is where it currently stands
1. **`street/START-HERE.md`** — orientation, which agent you are, how to run things
2. **`street/notes/GOTCHAS.md`** — landmines. Read before your first change
3. **`street/notes/OWNERSHIP.md`** — **DEMOTED, history only.** It names which
   agent *last held* a file — `C`, `F`, `J` and so on — and **none of them is
   running.** It is not a permission list. Read it to find out who touched
   something last, never to decide whether you may edit it; **the queue grants
   files now.** Reading it as authority cost the first worker on the self-serve
   queue its entire wave: three items released un-actioned in eleven minutes,
   because every file it was handed "belonged" to a letter that had not existed
   for days
4. **`street/notes/QUEUE.md`** — **the one ranked list of work.** Builders take
   the top item with `./scripts/claim.sh <name>`, finish it, run
   `./scripts/done.sh <name> "..."`, and claim again — nobody waits to be told
   what is next. Rules for *how* live in **`street/notes/BUILDER-BRIEF.md`**,
   read once per session
5. `street/notes/queues/<agent>.md` — **DEAD, kept only as history.** The old
   per-agent files were never ticked off and have not been true for weeks

Reference, for looking things up rather than reading: `street/PARALLEL-WORKFLOW.md`
(the multi-agent process) and `street/FEATURE-REQUESTS.md` (every request in the
user's own words). `street/notes/archive/` holds finished handoff notes — open
one only when touching the area it describes.

## Working agreements

Log every user request to `street/FEATURE-REQUESTS.md`, and **say which agent it
was routed to** when you reply — the user cannot reprioritise a queue he cannot
see.

**IF THE QUEUE HAS UNCLAIMED WORK, WORKERS ARE RUNNING. ALWAYS.** The user's
standing instruction, 2026-08-01: *"if there is a queue there should be workers
working. always."* An idle queue with idle workers is the desk failing, not the
fleet resting. The desk's first act on any tick is to check
`grep -c '| TODO' street/notes/QUEUE.md` and spawn up to the cap if it is
non-zero. Workers are only absent when the queue is genuinely empty.

**Builders are self-serving: they take the top item from `street/notes/QUEUE.md`,
finish it, release it, and take the next.** The desk ranks the queue and verifies
what comes back; it does not hand out work item by item. A builder that runs out
of queue says so and stops — it does not invent work.

**THE DESK RANKS AND VERIFIES. IT DOES NOT DIAGNOSE.** Measured over the 35 items
of 2026-08-01: the desk's stated cause was wrong on 6, and a builder caught it 6
times out of 6. The three longest cycles on the board were all "the brief was
wrong and the builder had to work backwards first" — not hard work, bad dispatch.
So an item ships **the symptom, the user's words verbatim, the screenshot path,
and a "done when" line a script can fail** — never a guessed cause or a guessed
filename. Every item that landed with no follow-up had a check that could fail;
every item that needed follow-up was a symptom plus a guess.

`claim.sh` and `done.sh` lock the file, so two builders can never hold the same
item. **A builder never confirms its own work**: `done.sh` marks DONE, and the
desk checks it against the source before the LEDGER row moves. Every agent this
week has made at least one claim that did not survive that check.

**At most 5 agents run at once — normally 3 builders + 1 auditor.** A
sixteen-agent run exhausted the account's usage on 2026-07-30 and took the whole
fleet down. An agent exists only while it holds an item; when its queue empties
it gets shut down, not parked. `street/PARALLEL-WORKFLOW.md` §10 is binding.

**Screenshots are for LOOKING, never for PROVING.** Two runs of identical code
differ ~20% of pixels. To prove a change didn't move the world:
`npm run fp before` → change → `npm run fp after` → `npm run fpdiff`. Textures
and structure must match; 4–6 pigeons drifting is the noise floor.

Anything involving movement, collision or floors must be verified by **actually
walking it**, not from a screenshot. The 2 m sidewalk lane is sacred.

## Running it

The user playtests **the live integration world at http://localhost:5177/** —
mainline plus every builder's in-flight work, rebuilt every 15 s by
`street/scripts/live-integrate.sh`, which drops any builder that breaks the
build. Builders use their own ports (4178+); never share one.

There is also a published artifact and a GitHub Pages deploy
(https://erickfm.github.io/rpg/, auto-deploys on push). Republish the artifact
with `cd street && npm run build && node scripts/pack-artifact.mjs`, then publish
`street/dist/artifact.html` to the existing artifact URL.

## Commands

| | |
|---|---|
| `./scripts/desk.sh` | **run this first** — who is idle, what is unlanded, which queues are stale |
| `./scripts/queues.sh` | every agent's task, queue depth, git state |
| `./scripts/land.sh [--dry]` | merge train: rebase + merge every green builder |
| `./scripts/ownership.sh <agent>` | are your edits inside your boundaries |
| `npm run sweep` | 48-shot world sweep, reports console errors |
| `node scripts/health.mjs` | does the world actually initialise. **Three statuses:** `0` initialised, `1` measured and broken, `3` nothing measured. That last one matters — for months this check printed `WORLD BROKEN` and exited 0, so a dead world scored green; and the naive repair (`exit 1` on failure) would have sent a builder who simply forgot to start a preview to go looking at their own code. Fixed 2026-08-02, with a `health-dead` mutation case behind it |
