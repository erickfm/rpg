# These per-agent queues are DEAD — see `notes/QUEUE.md`

Kept as history only. **Nothing here has been true for weeks**, and the unticked
checkboxes are the reason: most were never ticked off, so a full-looking queue
here means nothing about whether the work is done.

The live system, from 2026-08-01:

- **`notes/QUEUE.md`** — one ranked list for everybody
- **`./scripts/claim.sh <name>`** — takes the top unclaimed item, atomically
- **`./scripts/done.sh <name> "..."`** — releases it for the desk to verify
- **`notes/BUILDER-BRIEF.md`** — every standing rule, read once per session

**Why it changed.** The per-agent model needed the desk to hand out every item,
so builders sat idle between briefs and the desk re-typed the same forty lines of
boilerplate into each one. Worse, the ranking lived in the desk's head: nobody
else could see what mattered most. One ranked list makes the priority legible and
lets a builder that finishes at 3am take the next thing without waiting.
