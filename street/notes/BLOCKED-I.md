# BLOCKED — builder I

## The driveway apron the user pointed at is not in `ct/lot.ts`

**What I need:** the long ground sheets either side of the lot mouth given real
grain along the street.
**From whom:** **B**, who owns `ct/tex-ground.ts`. Every surface involved is
theirs; none is mine.

**The user's complaint is real and I am not disputing it.** He saw *"a large
flat untextured grey plane"* at the driveway, and `shots/I-apron-out.png` —
standing inside the lot looking out over the apron, which is the *"drive a car
off the lot"* view the brief names — shows exactly that: a broad, grainless pale
band between the textured lot deck and the textured road.

### Where it actually lives, measured

Walking the ground line across the lot mouth at z 2.6 and reporting the topmost
surface at each x (`scripts/I-flatground.mjs` and the probe in `notes/I-ground.md`):

```
  x 9.5 … 7.5   mod=tex-ground   map 768x4     60.1 x 124.6 m sheet
  x 7.0 … 5.5   mod=tex-ground   map 62x275     1.9 x   8.6 m   <- B's apronTex
  x 5.0 … 1.0   mod=tex-ground   map 768x4     60.1 x 124.6 m sheet
```

**Not one of them is `mod: lot`.** The apron proper already carries B's own
`apronTex` and it is fine — 62 × 275 texels over 1.94 × 8.6 m is **32 texels per
metre**, the world's ground density.

### The number that is the actual finding

The long sheets around it:

```
  60.0 x 124.5 m   texture 768x10   repeat 1,1   ->  12.80 texels/m in x,  0.08 in z
  60.1 x 124.6 m   texture  768x4   repeat 1,1   ->  12.77 texels/m in x,  0.03 in z
  60.0 x 124.5 m   texture  96x14   repeat 1,1   ->   1.60 texels/m in x,  0.11 in z

  the lot deck     32.0 x 30.0 m    repeat 16,15 ->  32.00 texels/m BOTH ways
  the lot pad      23.2 x 23.2 m    repeat 11.6  ->  32.00 texels/m BOTH ways
```

**0.03 texels per metre against 32.** These sheets are a cross-section painted
across the street and stretched 124 m along it — which is a reasonable thing to
do for a kerb profile, and it means there is **no grain whatever in the
direction you drive**. That is the mechanism behind "flat untextured grey
plane", and it is one `repeat.y` away from being fixed.

I have not touched it. `ct/tex-ground.ts` is B's, and this is a change to a
sheet that underlies the whole world — the street, the park and the civic block
all stand on it — so it is a decision for its owner, not a drive-by from the
car lot.

### What I did do

`ct/lot.ts` had exactly **one** flat-colour ground surface, the 0.7 m² office
door step. It is on `slabTex` now and the module is clean:
*"every ground-facing surface in 'lot' carries a texture."*

**Not blocking me.** I am carrying on with my queue; this is filed so it reaches
the owner rather than sitting in a report nobody opens.
