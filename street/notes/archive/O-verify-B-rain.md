# VERIFY B's rain row — IT HOLDS, on B's own instrument, and mine was wrong

**Verified by O, who did not build it.** Build `c3bf35d39+`.

## The verdict

B's row says the reported fault does not reproduce and the report was taken from
the indoor spawn. **Confirmed**, using `scripts/rainlive.mjs` — B's own script,
at B's own station:

```
rainAt() says these absolute hours rain: 0, 1, 10, 14, 16, 17, 21, 36, 38

INDOORS  (the spawn, x 198.6)   rainLevel 0.0000   wetness 0.0000
OUTDOORS (the pavement, x -6.0) rainLevel 0.9893   wetness 0.9843
after settling outdoors         rainLevel 0.9914   wetness 0.9871
```

**It rains, hard, and the ground gets wet.** The 0 indoors is `updateRain`'s own
rule and not the bug. B's diagnosis — that the reporter read the signal from a
spawn point that is inside the apartment — is the correct explanation.

## I wrote my own check first and it was WRONG. That is the useful half.

I did not want to re-run B's experiment, so I built an independent one. It read
**0.167 outdoors** where B reads 0.98, and reported B's working storm as a red.

The tell was in my own output and I nearly missed it:

```
x40:0.0708  x60:0.1545  x69:0.2369  x80:0.2984  x95:0.3395  x99:0.4028
```

That looks like a value varying with **x**. It is a value varying with **time** —
the storm ramping while my sweep walked east. My `read()` gave each station six
frames after the warp; B's script settles at each station and says so. **A fixed
frame budget on something the render loop drives is GOTCHAS §30**, and here it
failed in the direction that reports correct work as broken.

**I deleted my script rather than commit it.** A check that cries wolf on
another builder's row is worse than no check (GOTCHAS §27, §48), and this is the
second one I have deleted tonight for exactly that.

The lesson is not "write a better sweep". It is that **B had already built the
instrument, and the right move for a verifier was to run it.** Using the owner's
own tool is not lazy — it is the only way the measurement is comparable to the
claim.

## One observation I could NOT settle, offered to B as a question

Rain is cut at `x = 100` rather than faded — B says so and my sweep agrees
(`x99: non-zero, x101: 0`). **Does any ground a player can stand on outdoors lie
past that cut?** If it does, it stays dry in a storm and the cut is a visible
seam rather than an implementation detail.

I could not answer it. My measure of "how far east the outdoor world reaches"
returned **x = 262**, which is the world's own boundary wall and not walkable
ground — so the number is real and means nothing for this question. The side
street ends at x = 55 and the jail at x = 69, so the answer is *probably* none.

**"Probably" is what this project keeps paying for**, so it is a question and not
a finding. B owns the rain and knows what is out there.

— O
