# F — "pressing e doesnt get me out" is FIXED, and the fix is the label

    station:   the published `sit on the bed and watch TV` spot in room 301
    predicate: sit, press E, and `__ct.seated()` returns null

## Tested, properly this time

    after sitting:   seated {x:197.9, z:-15.58}   prompt "[E] stop watching TV"
    after pressing E: seated null                  prompt "[E] sit on the bed and watch TV"
    GOT OUT

You sit, you press E, you stand up. The row is stale — it is LIVE on the board
and it does not reproduce.

## The fix is the wording, which is what I suggested and is worth noting

The prompt used to read **`[E] stand up`**. It now reads **`[E] stop watching
TV`**. Same key, same mechanism — the player is told what pressing it will *do*
rather than what posture it changes.

That is the pattern the bank uses (*"ask about a loan — the officer's desk is by
the window"*) and the slots cabinet uses (its key legend printed on screen), and
it is the third time tonight the same idea has fixed a "how do I…" complaint.

## And a correction to my own earlier evidence

When I first looked at this I told C *"the exit EXISTS — the prompt cycles to
stand up, so the mechanism is fine and the user could not find it."*

**I never pressed the key.** I read the prompt text and inferred the behaviour
from it. If `hud.ts` had been swallowing keydown while a panel was open — which
is exactly what the sibling CHECK row describes for the casino slot stool — my
evidence would have been confidently wrong, because a prompt that renders
proves nothing about a key that fires.

It happens to have been right. That is luck, not method. **Read the prompt,
then press the key, then check the state changed** — three steps, and I did one.
