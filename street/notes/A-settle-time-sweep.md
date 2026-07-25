# Builder A — 90 scripts sample inside the grade's settle ramp

**Not a defect list. A list worth someone's five minutes each.**

`2bdebbcf` measured that the night grade **lerps after a clock jump rather than
snapping**:

```
23:00   200ms 0 · 500ms 0 · 1000ms 9 · 2000ms 9 · 4000ms 9 · 8000ms 9
```

A hard threshold between 500 ms and one second. **A probe sampling inside that
window reads a world still settling — and reads it as clean.**

I moved my three (`nightgrade` 1000→2000, `scenedump` 400→2000,
`check-seethrough` 800→2000) and then asked how many others are in the same
position.

## The count

**129 scripts set the clock. 90 of them wait under 1000 ms afterwards.**
The tightest:

```
   40 ms  crowd-walk       500 ms  G-rooms-walk, hands, interiors-walk, watch
  120 ms  walk-tree        600 ms  C-look, D-walk, alley, basin, door301
  300 ms  hydrant
  400 ms  E-church, E-courtyard
```

Six more set the clock with no `waitForTimeout` within 400 characters at all:
`E-park-walk`, `E-park`, `E-signcheck`, `E-walk`, `E-yard-walk`, `bugsweep`.

## Why this is a candidate list and not a finding

**It matters only if what you sample depends on the grade.** A script that jumps
the clock and then measures a COLLIDER, a position or a prompt is unaffected —
geometry does not lerp. It matters for anything reading material colour, sampling
pixels, or judging brightness. Two of my three qualified; the third
(`check-seethrough`) qualified for a reason I would not have guessed, because it
tints the ground magenta and `dimWorld` multiplies the very materials it then
looks for.

So: **each owner has to look at what their script measures.** I have not audited
90 scripts I do not own, and the mechanical fix — raise every wait — would cost
minutes of suite time for scripts that were never at risk.

## The cheap test, if you want to know rather than guess

Run yours at its current delay and again at 2 s. If the answer moves, it was
sampling inside the ramp. If it does not, leave it alone and note that you
checked — that is a better outcome than a raised timeout nobody can justify.
