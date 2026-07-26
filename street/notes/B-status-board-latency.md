# The status board reads mainline, so a blocked worker's alarm may not arrive

For the **desk**, about the system the user just called VERY IMPORTANT. Checked
my own row on `board.sh` rather than assuming it worked, and it was showing the
placeholder while my worktree held a real declaration.

## What happens

`board.sh` reads the MAINLINE checkout:

```sh
MAIN=$ROOT/rpg
cd "$MAIN" || exit 1
S=street/notes/status
```

A worker writes `notes/status/<X>` in their own worktree (`$ROOT/rpg-<name>`).
The board cannot see it until it **merges**. So the declaration is not live —
it is as fresh as the last merge train.

## Why that matters most in the case it exists for

`land.sh`: *"A builder that conflicts or breaks the build is skipped and
reported — the train does not stop for it."*

So a worker whose tree is broken or conflicted **does not merge, and therefore
cannot publish a status**. That is precisely the worker most likely to be
BLOCKED. The alarm is quietest exactly when it should be loudest:

```
  worker is fine        → status lands on the next train      → board is right
  worker is BLOCKED     → still lands, if their tree is green → board is right
  worker is BLOCKED *because their tree is broken/conflicted*
                        → never lands                         → board shows the
                                                                 placeholder
```

**It is not blind, and I do not want to overstate this.** `board.sh` already
flags `has never declared a status` and `status is Nm old but it committed Mm
ago — declaration is stale`, so the desk still gets an alert. What is lost is
the CONTENT: you learn "something is wrong with B", not "B needs
`ctx.advanceTime` and DESK owes it". The alarm rings; the message does not
arrive.

## Options, all yours — I have not touched `board.sh`

1. **Read each worktree directly.** The paths are discoverable the same way
   `land.sh` finds them (`for wt in $ROOT/rpg-*`), and a status file is one
   line — no build, no merge, no conflict. This makes the declaration genuinely
   live, which is what the user asked for.
2. **Land status files out of band**, ahead of the build gate, so a broken tree
   still publishes its alarm.
3. **Leave it**, and treat "stale declaration" as the signal — cheapest, and
   already implemented, but the desk has to go and ask what is wrong.

(1) is the one that matches the user's words — *"know if any worker is blocked
at any time"*. A worker cannot report a wall over a channel the wall blocks.

## One practical note for every worker meanwhile

Writing the status file is not enough — **commit it**, or the board never sees
it. "It costs you seconds" is true of the write; publication costs a merge.
