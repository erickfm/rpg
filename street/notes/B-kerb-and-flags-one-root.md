# The kerb breaks and the "only 3 slabs" are ONE fault, and it is I's finding

Measured before painting, as the desk asked.

## The measurement

There is **no separate walk mesh on the main street.** The pavement is part of
the same long ribbons as the kerb:

```
  60.00 x 124.5 m   texture 768x10   ->  12.8 texels/m in x,  0.08 in z
  60.13 x 124.6 m   texture  768x4   ->  12.8 texels/m in x,  0.03 in z
  17.46 x 114.9 m   texture  384x5   ->   ~22 in x,           0.04 in z
```

**0.03 texels per metre along the street.** So the pavement has no joint along
the direction of travel BY CONSTRUCTION, and three strips is exactly what a
cross-section with three bands in it looks like when you stretch it 124 m. He is
not misreading it; he is reading it correctly.

**This is I's finding, the same root cause, and it now accounts for four
reports:** the driveway apron, the lot mouth, these pavement flags, and the
discontinuous kerb. One fix answers all four.

## The part that surprised me

`walkTex`/`drawWalk` — mine — already draws a proper 1 m joint grid BOTH ways
(`fillRect(0,k,WT,2)` and `fillRect(k,0,2,WT)`), and tiles an 8 m map. It is
correct. **It is simply not what the main street wears.** It dresses the SLABS —
the side street, the alley, the east end — while the main-street walk is part of
the stretched ribbon. So the world already contains the right answer, applied
everywhere except the place the user stands most.

That is worth saying plainly because it changes the fix from "paint something
new" to "give the main-street walk the sheet the rest of the world already
uses", which is a much smaller and safer change than it looked.

## What I have not done

Rebuilt the ribbon. The kerb, gutter pan, chamfer and walk are one continuous
BufferGeometry so that joints march round the corners as a real pour does — that
continuity is deliberate and it is the thing the FIRST fault is about, so I am
not going to cut it into pieces at the end of a session to fix the second.

**The two faults want opposite things and that tension is the real work:** the
kerb wants to be one unbroken run corner to corner; the pavement wants a joint
every metre along it. Both can be had — the kerb ribbon stays continuous and the
WALK band gets its own tiled sheet at 32 px/m — but it is a real change to
`buildGround` and it wants a session with room to walk the result.

## The kerb half, separately

I have NOT yet established whether the breaks are geometry gaps, a texture that
does not tile along its length, or lengths that do not meet. The density figures
above make "does not tile along its length" the leading candidate — at 0.03
texels/m there is nothing to tile — but that is a hypothesis and I have not
tested it. Whoever takes this: measure the ribbon's vertex continuity along z
before assuming, because the three explanations want three different fixes and I
have already published one wrong steer today by pattern-matching instead of
measuring.
