# I verifying C's three TV rows — all three hold, two caveats recorded

Build `5d58c182f`, everything under the which-world guard, each row tested at
the station it publishes rather than at the one that is easy to reach.

## "how do i stop watching the tv" — CONFIRMED

    station:   walk to the bed's published `at` (198.30, -16.30) at 23:30, press E
    predicate: the prompt reads `[E] stop watching TV`, is the same from every
               look direction, and BOTH E and Escape leave the seat

All four parts hold:

- the prompt reads **`[E] stop watching TV`** — the user's *stand up* complaint
  answered in the label itself
- **one distinct prompt string across 18 look directions** (6 yaws × 3 pitches,
  including hard up and hard down). That is the row's *"does not change however
  you look"* measured rather than asserted
- **E left the seat**
- after sitting again, **Escape left it too**

The Escape half is worth stating plainly: before `f110b7f5a` this world had no
cancel, back or escape binding of any kind, so every seated state had exactly
one way out and a single swallowed keypress was a trap.

I approached from the published `at` on foot rather than warping onto the pose,
because warping onto the pose is what hid the stuck-seat bug from three
verifiers.

## "i think i want the tv black" — CONFIRMED, at the hard station

The row's station is **the set OFF**, and that cannot be shot from the seat —
sitting on the bed turns the television on. So this one needs a standing frame:
`shots/i-tvoff-a.png`, 301 at 23:30, `tv.on = false`.

    region              value    saturation
    casing top          0.302    0.049
    casing front band   0.184    0.043
    casing left side    0.183    0.042
    dead screen         0.150    0.030
    wall behind         0.564    0.085

- **The set is a third the brightness of the wall it stands against.**
- **Saturation 0.042–0.049 on every casing face** — the row's *"very dark
  neutral grey"* as a number.
- **The top face is lighter than the front, 0.302 against 0.184**, and the sides
  are darker than the top — the moulding-catches-light reading the row
  describes. It holds lit as well as dead: 0.439 vs 0.192 at 13:30, 0.390 vs
  0.183 at 23:30.
- **0% beige-ish pixels on every casing face at both times of day.** This set
  was beige with a control panel when F verified the bezel, so that is a real
  change and the user's request is satisfied.
- **The red standby LED is real and is the only warm thing on the set** — 5 warm
  pixels, first at (580, 441), against zero anywhere else on the casing.

### Two sub-claims I am not rounding up

**"glass grey-green".** The dead screen measures **rgb(31, 35, 38)** — blue is
the highest channel. It is a cool grey that leans green only against red
(G−R = +4, against the casing's +2). Greener than the casing, but I would not
call it green. What it *does* separate by is **value**: 0.150 against the
casing's 0.184–0.302, the dead glass darker than the plastic, which reads
correctly.

**"the well between them darker than both".** **Not confirmed.** My strip
measured 0.206 — darker than the casing top, lighter than the screen. But my
sample was a 4-pixel-wide band placed by eye, which is too thin to contradict
anyone with, so this is unsettled rather than a fault.

Neither touches the substance. The television is black.

## "much more diversity on the ads" — CONFIRMED, C's own test reproduced

    station:   sit on the bed in 301 and sample `scene.userData.tv`
    predicate: `fmt` varies and no two consecutive ads share it

Watched **165 s**:

                        me        C
    ads played          43        44
    distinct ads        27        27      (pool declares 27)
    distinct formats    10        10
    consecutive pairs
      sharing a format  0 of 42   0 of 43

An independent reproduction to the same figures, not a re-reading of the claim.
The ten formats seen: `list, split, product, demo, price, slate, legal, order,
quote, sting`.

The 16 repeats before the pool was exhausted are the bag refilling, not the same
ad twice running — and they show what the structural half of the diagnosis
actually is: **the anti-repeat rule is on FORMAT, not on ad identity**, so an ad
can come round again while the layout never does twice in a row. That is the
half the user could see.

## A warning that cost me three wrong measurements

`notes/F-verify-tvads.md` tells the next verifier to find *"the mesh whose
`userData` says it is the screen"*. **There is no such mesh.** The tag is on the
**Scene**, published at `apartment.ts:2562`.

This is nastier than a wrong file reference, because of how it fails:

- a `traverse` that does **not** require `isMesh` picks up the Scene root and
  appears to work — which is what F did, and why the note says "mesh";
- one that **does** require it returns zero, and I briefly concluded the tag had
  been dropped in the black-casing rework;
- worst, the Scene has a `matrixWorld` and no geometry, so my first probe
  silently measured "meshes near the TV" **around the world origin** and
  reported room-sized bounding boxes for a television. I only caught it because
  a 1.8 × 4.5 m "TV casing" is absurd on its face.

**Read `scene.userData.tv` directly. Do not traverse for it.**

That is the fourth time this session a selector has confidently measured the
wrong object, and the third time the tell was a number being the wrong size
rather than the wrong value.
