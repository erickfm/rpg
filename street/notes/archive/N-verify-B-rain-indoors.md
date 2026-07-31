# VERIFY B's rain row — every claim reproduces, and one line of it will be misread

Builder N, verifying a row I did not build. **Not marked CONFIRMED** — only the
desk or the auditor may. Built bundle, build `905622878`.

B's verdict is *"it does not reproduce, and the report was almost certainly
taken from the INDOOR SPAWN."* **All four measurable claims hold**, and I
checked them against the world rather than by re-running B's script — then ran
B's script as corroboration.

| B's claim | mine |
|---|---|
| `rainAt()` reports hours 0, 1, 10, 14, 16, 17, 21, 36, 38 | **identical, all nine** |
| indoors at the spawn, hour 0:30 → `rainLevel 0` | **0.0000** on a fresh load |
| outdoors → it rains hard and the ground gets wet | **0.8918 / 0.8694**, settling |
| indoors is a CUT above x 100, not a fade | **exact**: x 99 → 0.9488, x 101 → 0 |

And B's `rainlive.mjs` exits 0 on my build with `0.9660 / 0.9547`.

## The single-frame trap is real, and it is the better half of the row

B warns that `rainLevel` eases at `dt * 0.6`, so one sample straight after a
clock move reads near zero. Measured, **outdoors, at a raining hour**:

```
one frame after the clock move   rainLevel 0.0000   wetness 0.0000
settled                          rainLevel 0.6227   wetness 0.5903
```

**Zero, outdoors, in the rain.** That is a second, independent way to produce
exactly the reported bug — and unlike the indoor one it does not even need you
to be in the wrong place. Anyone re-testing this without waiting will "confirm"
the fault.

## The one line that will be misread — and it is a presentation problem, not an error

The row prints indoors and outdoors side by side:

```
INDOORS at the spawn, x 198.6:   rainLevel 0.0000, wetness 0.0000
OUTDOORS on the pavement, x -6.0: rainLevel 0.9803, wetness 0.9726
```

Read cold, that says **both** signals are cut indoors. **They are not.**
`rainLevel` is position-dependent; **`wetness` is not.** Same instant, either
side of the cut:

```
x =  99   rainLevel 0.5968   wetness 0.9269
x = 101   rainLevel 0.0000   wetness 0.9156
```

And stepping from the wet street into the flat:

```
outdoors, settled     rainLevel 0.8918   wetness 0.8694
indoors, 0.6 s later  rainLevel 0.0000   wetness 0.8714
indoors, 4.6 s later  rainLevel 0.0000   wetness 0.8328     <- drying, not cut
```

`wetness` is the GROUND's, world-wide, and `ctx.ts` says so in as many words —
*"How wet the GROUND is… Lags the rain: wets fast, dries slow."* B's indoor
`0.0000` is correct **because that session had not rained yet**, not because
indoors is dry.

**Why this is worth a note rather than a shrug.** The next person to measure
indoors *after* it has rained will read `wetness 0.87` where the row says
`0.0000`, and conclude the row is wrong. That is the same shape as the two
false routings I have already made today from predicates I invented — and this
row is specifically about a signal being misread from the wrong station. One
clause on the indoor line, *"wetness is world-wide and this session had not
rained"*, closes it.

## What I did not do

I did not re-derive the rain schedule; I asked `scene.userData.rainAt`, which is
published precisely because two scripts once carried hand-copies and drifted.
So the nine hours are the world's answer, not a second implementation of it —
which means B and I agree because we asked the same oracle, not because we
independently computed it.

— N
