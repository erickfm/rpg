# The garlands hang on real posts — measured, and now guarded

Builder I, 2026-07-25. Last item under `## Now` in my queue: *"the garlands are
disconnected — they should terminate on real posts and chain between them rather
than floating."*

**Already fixed**, in `98854cfb2` (*"Bunting: one string, tied off on every post,
sag scaled to the span"*). Never checked from outside, and never guarded — which
matters here more than most places, because the lot's own file calls this the
single most identifying object in the typology: *"it is the PENNANT BUNTING.
Triangular plastic flags on a sagging line are what tell you, from the far end of
the block and at a glance, that this is a lot and not a car park."*

## Measured

`scripts/I-bunting.mjs`:

```
  27 bunting segments, 7 uprights they could tie to

  52 of 54 segment ends meet the next segment (within 2 cm)
  2 are ends of a run — these are the ones that must be tied

     end at (7.18, 3.24,  13.90)  TIED to an upright 0.000 m away
     end at (7.18, 3.24,  -8.70)  TIED to an upright 0.000 m away

  every run is a continuous chain and every end is tied to a real upright.
```

Both free ends land on a post top at **0.000 m** — not "close enough", exactly on.

**Endpoints are reconstructed from each segment's own world matrix** — centre,
local x axis, width, and the string is the sheet's TOP edge so the tie point is
half the cloth height above the centre. They are deliberately *not* read back
from the `TIES` table the source builds the runs from; that would only prove the
table agrees with itself.

## Two clauses, because there are two ways it reads as disconnected

They fail independently, so one clause would leave the other unguarded:

1. **A gap mid-run.** Consecutive segments must share an endpoint. A polyline
   whose pieces do not meet is a dotted line, and at the distance you actually
   stand it just looks broken.
2. **A free end.** Every end of a chain must land on a post or the sign mast
   rather than in the air. This is the half the user complained about.

The `--selftest` lifts one segment 0.4 m out of its run and both clauses notice:
the joined count drops 52 → 50, two new free ends appear, and each is reported
floating 1.44 m from the nearest upright. Exit 1.

## Seen

`shots/I-bunt-tie.png` — standing at the north tie. The string runs into the top
of a real grey post and stops there; the flags hang off a continuous line, and
there is no floating end. `shots/I-bunt-run.png` is the whole frontage from the
street.

## Registered

`I-bunting` is in `scripts/checks.mjs`, green, alongside `I-rows`, `I-clip`,
`I-facing` and `I-flatground`.

No change to `ct/lot.ts`.
