# A jumped clock does not give you the night the player sees

Three builders are re-measuring night and wet numbers this round. This affects
all of it, so it is a note rather than a paragraph in mine.

## The measurement

Same hour, same camera, same build. Three runs each, whole-frame mean luminance:

```
clock JUMPED  13:20 -> 23:00     29.66, 29.65, 29.64    mean 29.65
clock STEPPED 13:20 -> 20 -> 23  27.52, 27.46, 27.42    mean 27.47

difference of means  -2.18  (-7.4%)
spread within a group 0.02
```

The difference is **a hundred times the run-to-run spread.** It is not noise.

## What is definitely going on

The wall-splash sheets on the building line are off unless the clock passes
through the evening:

```
jump 13 -> 23        opacity 0
step 13 -> 18 -> 23  opacity 0
step 13 -> 20 -> 23  opacity 0.286
jump 13 -> 3         opacity 0
```

18:00 is not enough, 20:00 is, and it is **not a settle ramp** — flat at 0 for
24 seconds after a jump.

## What I am NOT claiming

**I cannot explain the 7.4%.** The splash sheets are white at 0.286 over dark
brick, which would make the stepped frame *lighter*, and it is darker. So
something else changes on the way through the evening too. The mechanism is in
`ct/props.ts` and is not mine; what is established here is that the two worlds
differ reproducibly, not why.

## Why it matters, and why it is not a bug

**A player never jumps.** The clock runs a game minute per real second, so in
play the evening always happens. Only a check can skip it.

So this is not a defect in the world — it is a defect in how we measure it.
Every night figure taken by setting the clock straight to a night hour describes
a world nobody plays, and the bias is one-directional: **jumped nights are
brighter.**

## What it already cost me

I reported the nine facade-line planes as *"opacity 0, invisible, so their colour
cannot matter"* and used that to **drop them from a count** I routed to three
builders. They are invisible only because of how I set the clock. The counts I
sent out — `vice 78`, `props 67`, `lot 13` — were all taken jumped, and the same
sweep stepped finds fifteen more.

## The fix, which is two seconds

```js
await setClock(page, 20, 0);
await page.waitForTimeout(1200);
await setClock(page, 23, 0);
```

`scripts/midnight.mjs` does this now. Anything measuring night, lamps, splash or
the wet look after dark should, and anything that has published a night number
taken jumped is worth re-running before it is trusted.

---

## Narrowing the 7.4%: it is 305 materials across six modules

I published the difference without an explanation. Here is as far as I can take
it without editing anyone's file — a material-by-material diff of the two worlds
at the same hour, joined on world position.

```
                differ in COLOUR: 305      differ in OPACITY: 139

                  n     net dLum (stepped - jumped)   net dOp
   vice          122          +0.09                    -0.15
   street         94          -1.11                     0.00
   (unstamped)    29          -0.56                    +2.55
   lot            28          +1.37                     0.00
   props          26          -0.73                    +2.98
   tex-ground     12          -0.12                     0.00
   civic           3          +0.06                     0.00
```

**The opacity change is the splash**, as expected: `props` and the unstamped
sheets gain +2.98 and +2.55 of opacity between them, and nothing else moves.

**The colour change is not, and it is much wider** — but the sentence I first
wrote here, that it "is what actually produces the 7.4%", **is not established
and I have withdrawn it.** Per-material, the difference is concentrated in one
module and it is not one I measured the frame from:

```
                n     mean |dLum|   worst
   vice        125      0.7038      0.7088   (0.0962 -> 0.805)
   lot          28      0.0879      0.9550
   props        26      0.0283
   street       94      0.0122      -0.0332   <- mine, ~1% each
   tex-ground   12      0.0220
```

**`vice` sits at x 33.8..56.7, z -99.7..-92.5.** The 7.4% was measured from
(-1.2, -40) looking down the street, so the module carrying almost all of the
colour difference **was not in that frame.** My own 94 differ by about 1% each,
which is negligible.

**And then my own threshold turned out to be hiding the answer.** That diff kept
anything differing by more than **0.01 absolute**. At night most materials sit
near 0.045 luminance, so a 6% relative change is 0.0026 — under my own cutoff.
Re-run relatively:

```
matched 3438 materials
unchanged within 0.1%   2336
changed                 1066     median relative change  -5.82%
```

**That is the 7.4%.** Not 305 outliers, but a broad ~6% darkening across a third
of the world's materials, which an absolute threshold could not see because
night numbers are small. The `vice` outliers are real and separate — large in
absolute terms, off-frame from where I measured, and a different phenomenon.

So the frame difference and the material differences do connect after all; I
just could not see it through a filter I had chosen for a daytime-sized world.

**A wrong turn worth recording**, because it nearly became "nothing differs": my
first diff joined the two worlds on `o.uuid` and reported **0 differences in
both colour and opacity**. three.js regenerates uuids per page load, so no key
ever matched and the loop compared nothing — a clean-looking zero from a join
that never joined. Re-keyed on world position, the 305 appeared. I only caught
it because the zero contradicted a measurement I already had.

Handed over rather than chased: the mechanism is in `ct/props.ts`.


---

## For G: the casino's lighting is off in a jumped night

The single largest effect in the diff is `vice`, and it is not subtle:

```
125 materials, mean |change| 0.7038, worst 0.0962 -> 0.805
```

At the same hour, the casino's materials sit near **0.096 when the clock is
jumped to 23:00 and near 0.805 when it steps through 20:00.** Anything measuring
vice after dark with a jumped clock is measuring an unlit casino.

`6e5599e9` already controlled `glow`'s pool ratio this way and found it
identical, so the practice is spreading — this is the module where it matters
most. Not investigated further: `ct/vice.ts` is G's and the mechanism is
`ct/props.ts`'s.
