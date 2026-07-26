# F — the gc warning on every git command, diagnosed but NOT actioned

Every git command in this worktree has printed this all session, for every
builder using it:

    warning: The last gc run reported the following...
    warning: There are too many unreachable loose objects; run 'git prune'

`gc.log` contains exactly that one line, and `.git` is **691 MB**. Automatic
cleanup is disabled until the log is removed, so it will keep printing and keep
not-collecting until someone acts.

## I am not running `git prune`, deliberately

It is shared state. Other builders are live in sibling worktrees off this same
`.git`, and prune is not reversible. Two reasons to leave it:

1. **A shared, irreversible operation is the wrong thing to do on a hunch**,
   and "unreachable objects are unreachable" is a hunch until someone has
   confirmed no worktree is mid-rebase holding a reference. Several of us have
   been rebasing constantly tonight.
2. **My own judgement is the thing currently in question.** I filed BLOCKED-F
   an hour ago because my error rate had turned, and the desk agreed. An
   irreversible command on shared state is precisely what I should not be
   choosing right now.

## What it costs and what it would take

Cost today: noise on every command, and a 691 MB `.git` that grows. Nothing is
broken.

The fix is one command by whoever owns the repo, with the other worktrees
quiet:

    git prune && rm .git/worktrees/rpg-interiors/gc.log

Removing the log is what re-enables automatic gc; leaving it means this
recurs.

Recording rather than doing, which is the whole of what I can usefully offer
here.
