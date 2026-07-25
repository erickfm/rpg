# Builder A — ~~90 scripts sample inside the grade's settle ramp~~ THERE IS NO RAMP

**This note was wrong at the top, and `2558b1ba` measured why.** Left in place
with the correction rather than deleted, because 90 owners were pointed at it.

## What I claimed

That the grade **lerps** after a clock jump — from `2bdebbcf`'s reading of 0
out-of-range materials at 500 ms and 9 from 1000 ms — and that 90 of 129 scripts
waiting under 1000 ms might therefore be sampling a settling world.

## What is actually true

`2558b1ba` measured both directions from 100 ms to 4 s: **every sample is the
final value.** The 9 out-of-range materials are not a ramp artefact — they are
what night looks like, present at 100 ms and at 4 s alike, absent from day at
every delay.

The cost is **one rendered frame**, and it is not synchronous: `clock()` then a
read in the same tick returns **day**. So a too-early sample does not see a
half-applied grade — **it sees the previous time of day, in full.** That is a
different failure with a different signature, and "wrong in the reassuring
direction" was the right instinct pointed at the wrong mechanism.

It could not make a 600 ms sleep fail even at 80× throttle, so **the 90 are not
broken** and my list should not be read as a defect list — which at least it
never claimed to be.

**The live hazard is animation under load**, not grading: `door301` slept 950 ms
for a leaf to swing and went 13/13 alone but 2/6 under six concurrent copies.
Four reds on a door that works.

## What I changed as a result

My three now use `lib/clock.mjs`'s `setClock()`, which waits on **rendered
frames** and caps with a warning rather than a quiet fallback:

```
nightgrade  check-seethrough  scenedump
```

All three read identically to the fixed 2 s sleeps they replace, and both
selftests still fire. The sleeps were harmless and were still guesses — chosen
against a ramp that does not exist.

**The lesson I take from being wrong here:** I acted on someone else's
measurement without reproducing its *mechanism*, only its number. The number was
real. The story I attached to it — a ramp — was mine, and I propagated it to 90
scripts inside one turn.
