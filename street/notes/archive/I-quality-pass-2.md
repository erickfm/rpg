# I — second quality pass on the lot: walked day and night, found nothing to fix

The standing brief, in the user's words: *"take screenshots yourself and grade
it and make sure you are impressed with it. be skeptical."* Build `f0c824b85`,
28 frames — the customer route at 13:30 and again at 21:30, 12 of 14 landing
within 6 cm of their aim point both times.

**Verdict: I did not find a defect, and I am reporting that rather than
manufacturing one.** What follows is what I checked and the numbers, because a
pass that says "looks good" and shows nothing is worth nothing.

## The route reads

From the gate mouth (`shots/I-wd-05-gate.png`) the lot does what the brief asks
of it: two rows nosed out toward the aisle, prices legible on the glass at a
customer's distance — **$899, $1295, $2495** readable in the frame — banners on
both walls, the office closing the vista with `WE FINANCE ANYONE` and a phone
number, a salesman standing outside it, a cone on the deck, and the ghost sign
faded into the back wall above.

The chairs the user reported as *"backwards"* still face **out** at the lot with
`[E] sit down` offered (`shots/I-wd-11-chairs.png`). The office cabin carries
blinds with a warm interior behind them, an AC unit, a dish, and weeds at its
base.

All eleven of the lot's registered guards pass on this build: `lot-layout`,
`lot-kerb-seam`, `lot-clearance`, `lot-frontage`, `I-rows`, `I-clip`, `I-cards`,
`I-facing`, `I-bunting`, `I-archcheck`, `I-flatground`.

## Where I nearly filed a fault, and the measurement that stopped me

Night looked wrong to me. The deck reads near-black in the foreground, the car
bodies barely separate from it, and the only things carrying light are the price
cards, the SOLD/AS IS stickers, the banners and the office doorway. My first
sentence was going to be *the lot is too dark for a business whose whole pitch is
look at me.*

So I measured it instead, in **one frame** so it is one exposure
(`shots/I-wn-04-kerb.png`, standing in the road at the kerb cut, where the public
pavement and the lot deck are both in shot):

    21:30   pavement outside the gate   luminance 0.0615
            the apron in the gate mouth           0.0311
            lot deck, aisle floor                 0.0312

    13:30   pavement                              0.4821
            lot deck                              0.2966

**The lot deck is 2.0× darker than the pavement at night — and 1.63× darker at
one in the afternoon.** So the night-time penalty is a 23% relative worsening,
not the collapse my eye reported. Most of that gap is asphalt-against-concrete
and is there in full daylight.

**And the lighting is working, which I checked rather than assumed.** Counting
only inside the lot bounds:

    13:30   13 translucent pools, opacity sum  3.42
    21:30   47 translucent pools, opacity sum 12.82

Thirty-four more pools light up after dark and the total opacity more than
triples. The floodlight is already aimed at the aisle on purpose — `lot.ts:2326`
records the reasoning, that it used to throw into the back-south corner and that
*"a floodlight lighting a corner nobody walks into is the night-time version of a
pole with a box on it"* — and its 13 × 9 m pool is the warm patch in front of the
office in the night frames.

**So there is nothing broken here, and I am not repainting an approved palette on
the strength of a first impression that measurement contradicted.** The user
approved this palette in as many words: *"pole sign, bunting, banner copy,
palette, all of it lands."*

### The one thing worth someone's judgement, stated as an observation

A lot with festoon lighting and a floodlight is arguably meant to be a *bright
island* after dark, and this one is dimmer than the street outside its own gate.
That is a taste call about how loud the lot should be at night, not a fault —
the fixture aims, the colours and the intensities are all deliberate and
documented. If the user wants it louder the knob is small and in my file
(`haloM.opacity`, `poolM.opacity`, `bulbHaloM.opacity`, all `× f.night`), but
that is his call to make, not mine to take on a hunch.

## A limitation of my own probe, recorded

My light census counted **0 glowing meshes** inside the lot, which is plainly
false — the bulbs are visible in every night frame. The probe tested
`material.emissive`, and these bulbs are `MeshBasicMaterial` driven by opacity
and additive blending instead. The pool count is the number that carried the
answer; the emissive count measured nothing and would have been a confident zero
if I had leaned on it. Same family as every other selector mistake this session:
it did not fail, it answered a different question.
