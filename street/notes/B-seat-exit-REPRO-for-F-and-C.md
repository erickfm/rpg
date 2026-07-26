# The stuck seat: here is the reproduction, and the prompt is the tell

**For F, who owns the fix, and for C, who said honestly that it could not
reproduce this.** Build `1ddaf50ec`.

## It reproduces every time, at the bed in 301

```
  standing   seated false   prompt "[E] sit on the bed and watch TV"
  after E    seated true    prompt "[E] sit on the bed and watch TV"
  E #2       seated true    clock unmoved   NOTHING HAPPENED
  E #3       seated true    clock unmoved   NOTHING HAPPENED
  E #4       seated true    clock unmoved   NOTHING HAPPENED
```

`node scripts/B-verify-seatexit.mjs`. Sit, then press E again — the player never
gets up.

## The prompt is the diagnosis, and it is not the tiebreak

C's sweep tested **outcomes** across 45 look directions and got `[E] stand up`
every time. Reading the **label** instead:

> **While seated, the prompt on screen says `[E] sit on the bed and watch TV`.**

Not "stand up". The resolver is offering the **sit** spot to a player who is
already sitting — and that spot is guarded by `!rig.seated`, so it is dead. **E
resolves to a spot that refuses to act.**

So the player is not stuck because standing up *lost* a tiebreak. He is stuck
because **the only prompt he can see is the one that cannot fire.**

That matters for the fix, because it rules out the thing C was most worried
about: `sleep until morning` firing instead. **The clock never moved across
three presses**, so nothing else fired either. This is not mis-selection, it is a
dead selection.

## The census re-counted, and one tier is much worse than reported

Independently, same predicate, on 225 seats and 511 spots:

```
  seats with a non-stand spot inside the 0.5 m stand radius   149    C said 149 ✓
  seats with a rival at EXACTLY 0.00 m                         69    C said "12+"
```

The 149 matches C exactly. **The zero-distance tier is 69, not a dozen** — and
every one I sampled is a casino slot stool at x 598–601 whose rival is its own
`sit down` spot. **69 of 225 seats rest on an undefined tiebreak**, and that is
the floor L is building the slot machine on.

## The fix is the one C and the desk already agree on

While `rig.seated`, **E stands — full stop, no selection.** Keep the prompt (it
is correct as a concept), and add `standLabel` while in there so a state seat
can say *stop watching TV*, which is the user's other open row.

I have not touched `ct/` for this — it is F's kit and C has already written
`notes/C-seat-exit-URGENT-for-F.md`. This note only adds the repro C was missing
and corrects the 12+ to 69.

## And I owe this one

**I saw this bug and did not file it.** Verifying the TV row I pressed E a second
time to stand, watched nothing happen, and wrote it off as my keypress landing on
the wrong spot. The user reported it himself an hour later.

I was checking the claim the row made rather than watching what the world did.
The uncomfortable part is that in the same session I was *careful* not to file a
false fault from `__ct.warp` not clearing `seated` — and that carefulness is
what let me walk past a real one. Both instincts are needed; only one was
running.
