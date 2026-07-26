# BLOCKED — builder I

## The lot mouth still reads flat from the road — verified by eye, as B asked

**What I need:** the ground either side of the lot's driveway given grain along
the street axis.
**From whom:** **B**, who owns `ct/tex-ground.ts`. Every surface involved is
theirs; none is mine.

B has landed `c5389efe5` — *"Lot mouth: along-street grain as a feathered
overlay, **NOT verified by eye**"* — against my earlier filing. This is that
verification, and it is **still red**, with a much sharper location than I gave
the first time.

### Both viewpoints, measured in the rendered frame

`scripts/I-apron-grain.mjs`. Edge density, at the **same threshold A uses**
(24 summed over rgb) so the numbers are comparable with `A-slabtex-proof.mjs`,
where a flat quad is 0% and a real material 9–17%. Bands are read from the SAME
image, so exposure and night grade cancel, and each view carries its own
known-good controls.

```
  A · from the road, driving IN     (the ground fills the lower half of the frame)
     roadway        (known good)     5.56%   mean rgb 109,105,97
     KERB/WALK BAND (in dispute)     1.50%   mean rgb 131,128,119     <-- FLAT
     lot deck       (known good)     8.38%   mean rgb  80, 78, 79

  B · from inside, looking OUT      (the apron edge-on, 26 screen rows)
     lot deck       (known good)     3.60%
     APRON BAND     (in dispute)    11.06%   -> reads as a material
     roadway        (known good)     9.71%
```

**So B's apron wedge is fine and is not the problem.** Seen edge-on it carries
11.06%, above the roadway in the same frame. What is flat is the **walk band
crossing the mouth, seen from the road** — 1.50%, a third of the worst
known-good surface beside it, and the palest thing in frame.

`shots/I-band-in.png` is that band at 4×: roughly ninety screen rows of pale
grey-green carrying **one horizontal joint line** and almost no speckle. That is
*"a large flat untextured grey plane"*, and it is the frame a driver sees.

### Why my first filing pointed at the wrong thing

I reported the cause as the 60 × 124 m sheets at **0.03–0.11 texels per metre
along z** against 32 on the deck. That measurement is still true, and it is the
mechanism — but I implied the whole mouth was affected. It is not: the apron
wedge sits on top of it and is fine. **Only the walk band either side of the
driveway is bare**, and only along the street axis, which is exactly the axis
those sheets have no texels in.

### Two cautions, because both nearly cost me a wrong answer

1. **My first band was mis-placed and scored 13.5%** — the highest of the three —
   which I nearly published as *"the apron reads as a material"*. It straddled
   the road, the kerb line and the walk, so it was measuring a **kerb edge**.
   `shots/I-band-apron.png` is the bad band. Cropping it and looking is what
   caught it; the number alone was confident and wrong.
2. **Edge density does not predict the complaint on its own.** The lot deck
   scores 3.60% in view B and nobody has ever complained about it. What makes
   this band read as blank is the combination of low grain AND being the palest
   surface in frame (131 against 80 and 67 either side). Worth knowing before
   anyone tunes to a number.

### Deliberately NOT registered

`I-apron-grain.mjs` is written, has controls, and goes red — and it stays **out
of `scripts/checks.mjs`** while the surface it fails on belongs to another
builder. That is C's own rule and it was right: *"reddening the shared suite over
something I cannot fix would hand the block my problem."* Register it the day it
goes green.

**Not blocking me.** I am carrying on with the standing quality brief; this is
filed so it reaches its owner with a viewpoint, a number and a control.

---

## For H — the jacked car floats 2.5 cm on the wheels that should be down

**Owner: H, `ct/cars.ts`.** Not blocking me; filed because the user reported it
and the remaining half is not in my file.

The user: *"check the tilt is a believable jack angle rather than a whole-body
float — one end up, the other end's wheels still firmly down."* Measured on the
lot's one jacked car, deck top at y 0.140:

```
  wheel                     lowest y     vs deck
  jacked corner (raised)      0.265      +0.125   correct — it is on the jack
  other wheel                 0.165      +0.025   should be ON the ground
  other wheel                 0.165      +0.025   should be ON the ground
```

`cars.ts:1129` has `body.position.y = 0.03` alongside the tilt, so the whole body
is lifted 3 cm before it is rotated. The tilt alone is what should raise the
jacked corner; the flat lift takes the other two wheels off the ground with it,
which is exactly the "whole-body float" the user named.

I have not touched it — one flat lift is presumably there to stop the low corner
sinking through the deck once it rotates, and which way to resolve that is H's
call. The lot side of the report (the jack being on the invisible flank, and
nothing propped beside it) is fixed in my file.
