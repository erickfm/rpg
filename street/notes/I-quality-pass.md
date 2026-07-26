# The lot's quality pass — walked as a customer, day and night

Builder I, 2026-07-25. The `## Then` standing brief, by the method the user asked
for by name: *"take screenshots yourself and grade it and make sure you are
impressed with it. be skeptical."*

`scripts/I-walk.mjs` walks the sale, not a tour of features: along the pavement,
in at the gate, down the aisle reading windshield prices, to the office, sit
while they run your credit, and out the way a car leaves. 14 frames, day and
night, each verifying it landed where it was aimed to 6 cm.

## What I fixed, in the order I was least impressed

**1. The night was dead.** `notes/I-festoon.md`. A black rectangle with one
floodlight and eleven dark lumps — backwards for a typology whose whole business
model is being visible from the road at 9 p.m. Two festoon runs, 20 bulbs, 20
pools. **The unplanned win is in daylight**: the receding cables give the aisle
the depth cue it never had, which answers the standing *"car lot needs to be
deeper"* by perspective rather than by more asphalt.

**2. The pole sign went dark at nightfall.** A pole sign is an internally lit
CABINET; that is the entire reason the object exists. The glow uses the sign's
own texture as its map, so the cream field lights and the red border stays dark,
like a real backlit box. **It does not undo the `printed` flag** — `printed` says
*the ink is not a light*, this says *the cabinet is lit from within*, and both
are true. The artwork is untouched, because that palette is approved.

**3. One row held every damaged car on the lot.** Bay indices alternate
north/south from the street, so the three `NOT_PARKED` keys were all odd and all
SOUTH, and the deliberate empty bay was south too. The left row was hood-up, gap,
jacked, wrecked; the right row was six clean cars. **And the comment was lying**:
it says the jacked car is *"at the back beside the tyre stacks"*, and it stood
**16.2 m away at the opposite corner**. Now 4.65 m, measured, and the anomalies
are 2–2 across the rows.

**4. The office window read as bars.** Full-height white stripes at 0.88 alpha
buried the room that had been deliberately painted behind them. The office is the
visual terminus of the entire 23 m aisle. Slats to 0.58, pulled-aside gap widened
— the desk lamp now reads from the far end.

## Three times my own instrument or judgement was wrong

- **I nearly claimed a pre-existing defect as my own bug.** Hard-edged grey
  chevrons on the asphalt appeared while I was grading my new pools. They are the
  floodlight's, they are in `shots/I-n-back-out.png` from before the festoon
  existed, and the cause is that `stepDisc` drew five rings regardless of size —
  1.3 m bands across a 13 m throw. Fixed at the cause: `steps` now scales with
  the disc.
- **A mast stood 0.153 m inside a car.** Caught by `lot-clearance` and `I-clip`
  on the first run after I placed them, which is the whole return on having
  built those checks first.
- **I verified a car variant by squinting at a screenshot** with a festoon mast
  in front of the subject. Redone by counting wheels: 3 at (26.65, 7.3), 0 at
  (26.65, −2.1), 4 on the other nine.

## Asked for, and already there — so not padded

*"get the typical car price signs yknow?"* is **served**. The stock table already
carries five windshield treatments — soap-pen prices, starbursts, cards, slips,
SOLD — with slogans `RUNS GREAT`, `AS IS`, `1 OWNER`. Adding more would have been
work for its own sake, so I did not.

`printed` on the ~40 sheets and `slabTex` on bare quads were both **already
landed last session**; re-measured this session rather than assumed:
`mods-dim` 715 dim / 43 declared / **0 holding without saying why**, and
`I-flatground` **0 flat-colour ground surfaces**.

`mods-dim` is now registered in the suite — C wrote it and deliberately held it
out, saying *"it stays unregistered until this lands"*. It landed. The last
undeclared material was the floodlight **lens**, the glass face of a fixture that
is on after dark; it now declares itself like its own halo.

## Graded and deliberately NOT changed

- **The aisle floor is bare.** I had this on my own list and talked myself out of
  it: a drive aisle is *supposed* to be clear — it is how you drive a car off the
  lot. Dressing it would be clutter for its own sake.
- **Five of sixteen `STOCK` rows never place.** The plan yields 12 bays and skips
  one, so rows 11–15 are dead — including all three `bare` cars, so no car on the
  lot is without a price. Real, invisible, and the comment above it saying
  *"thirteen bays"* is also stale. **Recorded, not routed** (GOTCHAS 23).
- **The office is not enterable.** For *"how does one even enter, drive a car off
  the lot"*, the room where you haggle is the missing verb. That is an interiors
  job and a real feature, not a one-liner — it needs the desk.

## Not mine, seen while checking

`door301` went red this session — four clauses about the room 301 door failing.
That is `ct/apartment.ts` at x≈198, C's, nothing to do with the lot. Flagging it
because it was green earlier in the session and nobody may have noticed.

`mirror-walk`, `note-hashes`, `hashes-resolve`, `spot-coverage`, `floaters-walk`
and `no-silent-pass` are the same pre-existing reds as last session, none in the
lot.
