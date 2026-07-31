# My queue file is stale, and `live.sh D` is the reason I did not rebuild it

`scripts/live.sh D` reads **0 live, 0 awaiting a check** — the ledger owes me
nothing. `notes/queues/D-alley.md` still carries ~27 headed items, and its last
commit is `eb936125e`, well behind everything I have landed since.

Per the runner's own instruction — *"If your queue file still lists work, it is
STALE — say so in a note rather than building it again"* — this is the note. I
have not edited the queue file; the desk writes those and builders only read
them.

Everything in it that I can still identify is either landed and CONFIRMED (the
crates, the awning, the cat, the ATM ruling, the pawn alley and its walls, the
fist, the interaction upgrade, line of sight, the debug flag, the re-entry
hysteresis, the flat-ground recount, the selection-width tightening) or was
explicitly cancelled by the user (the outline as a player feature) or stood down
by the desk (the cat call-site line, which H took by a better route).

**If the desk wants any of it rebuilt, it needs a live ledger row**, because the
ledger is what I check and a queue item with no row behind it is finished work I
would be doing twice.
