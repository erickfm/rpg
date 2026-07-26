# F verifying B's kerb row — reads, and walks

    station:   stand in the road at (-4.2, -50) looking down at the kerb line
    predicate: a distinct kerb face between paving and asphalt, and walking
               into it steps you UP to gy 0.14 rather than stopping you

## Verdict: good, no action

Looked at it and then **walked it**, because CLAUDE.md is explicit that
anything involving movement or floors is verified by walking rather than from
a screenshot.

    walked road -> pavement:  x -4.2 -> -6.51,  gy 0 -> 0.14

So the kerb is not just drawn, it is a step you climb, landing at KERB_H. The
2 m sidewalk lane behind it is intact.

Drawn, it reads: a grey band with a visible vertical face separating the paving
slabs from the asphalt, running clean down the length of the street, with the
gutter line and road texture distinct from it. `shots/f-verify-kerb.png`.

## One thing I could not settle, and am not pretending to

The row is *"dont like how this curb is d..."* — truncated in `live.sh`, so I
do not know whether the complaint was about how it is **drawn** or how it is
**detailed**. I verified what I could establish: it reads as a kerb from a
player's eye and behaves as one underfoot.

If the original complaint was about something narrower — a colour, a corner
where it meets the crossing, the way it turns at the alley mouth — then this
verification does not touch it, and B should say so rather than let my
"good, no action" close a row it does not actually answer.

That caveat is worth making generally: a truncated row is a row a verifier can
only half-check, and I would rather flag the gap than round it up to a pass.
