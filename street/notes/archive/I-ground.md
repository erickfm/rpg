# The lot's flat ground: one surface, not twelve — and the apron is B's

Builder I, 2026-07-25. Routed mid-session, ranked after the two twice-reported
faults, both of which were done first as asked.

The ask: adopt `apronTex` on the driveway apron and `slabTex` on the yard
surfaces, against a census of *"12 untextured ground-facing surfaces totalling
82 square metres"* in `ct/lot.ts`.

## What I found

**`ct/lot.ts` had one flat-colour ground surface, of 0.7 m².** It is the office
door step, and it is now on `slabTex`. The module reports clean:

```
  'lot' ground-facing surfaces: 13
     13 textured   139.9 m2
     0 FLAT COLOUR

  every ground-facing surface in 'lot' carries a texture.
```

**The driveway apron is not in this module at all**, and the surface the user
saw is real but belongs to B. Both claims are measured below.

## My first census said 142 m², and it was wrong the same way item 2 was wrong

`scripts/I-flatground.mjs`, first run: **19 surfaces, 142.3 m²**, twelve of them
identical 11.59 m² grey planes. That number is garbage and it nearly went into a
note.

They are the **bay stripes** — `PlaneGeometry(0.09, 5.0)`, painted parking lines,
raked 0.55 rad. Raked, so their world axis-aligned box is 2.69 × 4.31 m = 11.59,
while the actual quad is 0.09 × 5.0 = **0.45 m²**. I measured a paint stripe as a
slab, twelve times, and got a headline that was 99% artefact.

**It is precisely the axis-aligned-versus-oriented mistake I spent item 2 taking
apart** — where H's 1.23 m "overlaps" turned out to be AABBs around raked cars —
and I made it myself one item later, in a script written to be careful about
exactly this class of error. Area now comes from `geometry.parameters`, and
anything under 0.35 m in its short axis is excluded as a painted LINE rather
than a surface.

I record this because the number that was asked of me — 12 surfaces, 82 m² — has
the same shape as the number I produced by that bug: **twelve somethings, of an
area far larger than they really cover.** I cannot see the original predicate, so
I am not asserting it made this mistake. But I could not reproduce 82 m² by any
honest predicate, and A's note already documents three failed attempts at this
same census for three different reasons. It is a hard thing to count.

## Where the apron actually is

Walking the ground line across the lot mouth at z 2.6, reporting the topmost
surface at each x:

```
  x 9.5 … 7.5   mod=tex-ground   map 768x4    60.1 x 124.6 m sheet
  x 7.0 … 5.5   mod=tex-ground   map 62x275    1.9 x   8.6 m    <- B's apronTex
  x 5.0 … 1.0   mod=tex-ground   map 768x4    60.1 x 124.6 m sheet
```

Every one is `mod: tex-ground` — **B's file**. The apron proper already carries
B's `apronTex`, at 32 texels/m, and the auditor confirmed that work.

**The user is still right that it reads flat**, and here is the mechanism:

```
  60.1 x 124.6 m sheet   texture 768x4    repeat 1,1  ->  12.77 texels/m in x, 0.03 in z
  the lot deck           64x64            repeat 11.6 ->  32.00 texels/m BOTH ways
```

**0.03 texels per metre along the street against 32 on the deck.** Those sheets
are a cross-section painted across the road and stretched 124 m along it, so
there is no grain at all in the direction you drive. Filed to B in
`notes/BLOCKED-I.md`; I have not edited it, because it underlies the street, the
park and the civic block, and that is a decision for its owner.

## What changed in my file

The office step's tread. `slabTex({ wMeters: 0.7, dMeters: 1.0, base: '#8b867e',
joint: 0, grain: 0.12 })` on material index 2 of the box, the `+y` face.

- **`joint: 0`** because a 0.7 × 1.0 m concrete step is one cast piece. Joints
  would invent a scale that is not there.
- **The colour is unchanged.** `slabTex` fills `base` as given — this is the same
  tone with grain in it, not a repaint of approved artwork.

`shots/I-step.png`: the tread now carries aggregate speckle against its flat
sides and reads as cast concrete rather than a grey box. It is the surface you
stand on to open the office door.

**No new nondeterminism**, which was worth checking because `slabTex` uses
`Math.random()`: `textures=d92de112` on two consecutive captures.

## One thing found on the way, not fixed here

**`padT` is defined at `ct/lot.ts:261` and never used.** It is the lot's own
asphalt — patched squares, cold joints, twenty years of drips, with a long
comment explaining it — and nothing references it. The deck you actually walk on
is the shared site slab at 32 texels/m, which is why the lot floor still looks
right (`shots/I-apron-down.png`).

So this is dead code rather than a visible defect, and deleting it or wiring it
up is a decision about whether the lot wants its own surface over the site's.
Recording it rather than doing it, because it is not what was asked for and it
is not one line.
