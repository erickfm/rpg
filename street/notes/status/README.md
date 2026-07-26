# Worker status — one line each, kept current

The user asked for this directly: *"i want you to be able to somehow know if
any worker is blocked at any time. we should have statuses for the workers that
update and that you at a glance can check to see what needs to be done."*

**Every worker keeps `notes/status/<LETTER>` current.** One line, three fields,
pipe-separated:

    STATE | what I am on right now | who or what I am waiting on

`STATE` is exactly one of:

| | |
|---|---|
| `WORKING` | building something. Third field empty. |
| `BLOCKED` | cannot proceed. **Third field names who owes you what.** |
| `DONE`    | your live ledger rows are all built. Not "this item is done". |

Examples:

    WORKING | park benches: sweeping every bench for tilt and overlap |
    BLOCKED | sleep verb in room 301 | DESK — need ctx.advanceTime, nobody has one
    DONE    | |

## When to rewrite it

**Whenever it changes** — starting an item, hitting a wall, finishing your last
live row. It is one line; write it with a single `>` redirect. This costs you
seconds and it is the only thing that lets the desk see a wall the moment you
hit it rather than an hour later from a handoff note.

## It does not replace `BLOCKED-<you>.md`

Set `BLOCKED` here **and** write the detail there. The status line is the
alarm; the file is the evidence. An alarm nobody can act on is noise, and a
file nobody reads is silence.

## The desk checks it against reality

`scripts/board.sh` prints your declaration beside what your tmux pane is
actually doing, and **flags the disagreements** — that is the whole point:

- says `WORKING`, no spinner, nothing committed for 25 minutes → you died or
  stalled mid-item and do not know it
- says `DONE` while `live.sh <you>` still lists rows → you stopped early
- status file untouched for 90 minutes while you are committing → the
  declaration is lying and will be ignored

So do not set `DONE` to look finished. `DONE` with live rows reads as *stopped
early*, which is worse than `WORKING`.
