# The junction bunching complaint, measured — it does NOT reproduce at shipped density

**H.** The user has said twice: *"tons of people always get stuck at this cross
walk. the walk logic should allow people to walk around things"*. This is the
BEFORE for moving the graph's crossing arms onto B's junction paint.

`scripts/H-junction-jam.mjs`, junction box x −9…13, z −111…−94 (both existing
crossing arms and the kerbs either side), 945 ticks over 180 s:

```
  walker-samples inside the junction:       1252
  STALLED (jam >= 0.5 s):                      0    (0.0%)
  worst single jam:                         0.05 s
  peak walkers in the junction at once:        4

  STANDING (wait > 0):                       251    (20.0%)
    by activity:  window 103 · corner 120 · door 28
  standing with NO activity (a real queue):    0    (0.0%)
```

**At the shipped crowd density nobody is stuck at this junction.** Every one of
the 251 standing samples carries a deliberate activity — window shopping,
pausing at a corner, hesitating in a doorway. That is the crowd working, not
jamming.

## Two corrections I made to my own probe, both of which changed the answer

**First version excluded `wait > 0` as "parked on purpose".** That threw away
exactly the population the user is describing — *people queueing at a kerb look
like people standing still* — and reported 0 stalls in a junction he has
complained about twice. A confident zero from the wrong population.

**Second version counted all 251 standing samples as a queue.** That was the
opposite error: the worst bins were **(12, −96)**, which is `n-win2`, a WINDOW
node, and **(6, −96)** by the bodega door. Those are shoppers. Splitting by the
sim's own `doing` field is what separates a queue from a shop window, and it
takes the real queue to zero.

**So the honest reading is: `jam` says movement is not blocked, and `doing` says
the standing is all purposeful.** Neither number alone would have shown that.

## What this means for the routed work

1. **The bunching does not reproduce at 1x.** I previously measured this crossing
   at **4x and 8x** the shipped crowd and it is *genuinely busy there* (14 and 17
   at the kerb). So the complaint most likely needs density to show, or it is a
   different crosswalk. **I am not going to "fix" a jam I cannot reproduce** —
   that is how a working system gets changed to chase a number.
2. **The walk-around logic is doing its job here.** `jam` peaks at 0.05 s against
   a `JAM_GIVE_UP` of 2.0 s, so nothing gets near the give-up-and-reroute path.
3. **This baseline is still worth having.** When B's junction coordinates land
   and I move the crossing arms onto the paint, re-running this must not make
   any of these numbers worse. A zero that stays zero is the pass condition.

**What would help:** if the user can say which crosswalk, or catch it in a shot,
I can point the same box at it. The probe takes a box.

— H
