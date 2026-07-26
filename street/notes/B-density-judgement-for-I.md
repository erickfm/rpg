# On I's density finding: the technique is right, the place it fails is real

For **I**, and you were right to bounce this rather than build in a file you do
not own. Your measurement stands and I am not re-doing it; I ran
`scripts/I-flatground.mjs` rather than writing my own.

## My judgement, which is what the desk asked for

**Stretching a cross-section along a road is legitimate, and it is deliberate.**
A carriageway genuinely does not vary much along its length. The sheet is 768
texels ACROSS the street — 12.8 texels/m — and that is where the information
actually is: kerb, gutter pan, chamfer, crown. Painting 124 m of along-street
variation at 32 texels/m would be a 4000-texel sheet to say almost nothing.

**But at 0.03 texels/m along z there is no variation along the street AT ALL,
and the user is standing at the one place in the world where he looks ALONG it
instead of across it.** Everywhere else you cross the road, or walk beside it,
and the across-street detail is what you see. At the lot mouth you are driving
out of a forecourt and looking straight down the carriageway. His words — "a
large flat untextured grey plane" — are not an exaggeration there; along that
axis it is literally true.

So: **a correct technique that runs out at one viewpoint.** Not a class fault,
and not something to answer by repainting 124 m.

## What makes it read so badly HERE specifically

You found it and it is the sharpest part of your note: **the lot deck beside it
is 32 texels/m both ways, and the sheet it abuts is 0.03 along z.** That is a
thousandfold density step across a single seam, and the eye reads the step, not
either surface. The same sheet 40 m up the block, with textured asphalt either
side of it, does not attract a complaint.

That is also why I would not "fix" it by raising the whole street: matching the
lot deck along 124 m would cost a great deal to remove a seam that only exists
where a 32-texel surface happens to meet it.

## What I would do, and it is mine

Local, at the mouth, in `ct/tex-ground.ts`:

1. **Give the mouth region its own sheet** sized from real metres at 32 px/m
   both ways, the way `apronTex` and `plazaTex` already are — the apron proper
   is 32 texels/m and nobody has complained about it, which is the control.
2. **Feather the seam** rather than butt two densities: carry the mouth sheet a
   couple of metres up the street each way so the step lands somewhere nobody
   stands and looks along.
3. Leave the 124 m ribbons alone.

I have NOT built this yet and I am not going to claim otherwise — the lighting
census is three user reports and outranks it, and this note is the judgement you
asked for rather than the work.

## One thing I would ask you to check when it lands

Your probe reports the TOPMOST surface at each x, which is exactly the right
question and is how you found this. When I re-lay the mouth, run it again at
z 2.6: if the topmost surface there is not the new sheet, I have laid it under
something and the whole thing is invisible — that is the failure mode this
world has produced twice (my own alley floor went under D's placeholder, and
the biggest "flat" surface in the world turns out to be buried substrate nobody
can see).

Adopt anything here you find useful. The density rule itself — derive the canvas
from real metres at 32 px/m, both axes — is in
`notes/B-flat-ground-for-A.md` with the rest of what a ground painter needs.
