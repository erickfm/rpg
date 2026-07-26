# The three re-briefed TV items were already built — re-verified, not rebuilt

`scripts/live.sh C` reads **0 live, 0 awaiting a check**. The desk's "2 LIVE"
view predates the commits. Per the standing rule I am saying so rather than
building them twice, and I re-ran the evidence on the rebased tree rather than
pointing at yesterday's numbers.

## 1. The ads differ in KIND, not in colour

The brief and what shipped line up item for item:

```
  asked for                         shipped
  full-screen price card            price     4 ads
  rotating product shot             product   2
  before / after split              split     3
  list ad, one bullet at a time     list      3
  phone-order end card              order     3
  testimonial with a name caption   quote     2
  demonstration                     demo      2
  scrolling disclaimer              legal     2
  two-second logo sting             sting     3
  white-on-blue text slate          slate     3
                                    ---------------
                                    10 formats, 27 ads
```

**Pacing varies with them**, as asked: 16 distinct durations from **2.0 s**
(the stings) to **5.6 s** (the bodega list). **Register varies too** — two of
the twenty-seven sell nothing at all: a PSA on a slate and a CHANNEL 4 station
ident. A quiet slate between two loud ones is what makes the loud ones loud.

**The street ones are in several formats each**, exactly as asked:

```
  CROSSTOWN AUTO   price card + order card + sting
  SEVENS           slate + testimonial
  FIRST FEDERAL    legal crawl + slate
  the pawn shop    price card + testimonial
  the bodega       list
  BURGER BARN      before/after split
```

**His own test, re-run on the rebased tree — three minutes without looking
away:**

```
  47 ads shown, 27 distinct of 27
  all 10 formats seen
  0 of 46 consecutive pairs shared a format
```

The last line is the one that matters: the bag prefers a different `fmt` from
the one just shown, so the next frame's layout is not predictable.

## 2. The casing is black

`shots/tv/black-off-night.png`, taken at 23:30 with the set OFF, which is the
hard case now that it defaults to off. Not `#000`: a very dark neutral grey
with the **top face two shades lighter** (`#36363f` against a `#26262c` front)
where the moulding catches light, sides darker, underside darker still, and the
surround a shade off the carcass so the mould line between rail and body reads.

**It separates from the dead screen by HUE as well as value** — casing neutral,
glass grey-green, and the well between them (`#14141a`) darker than both, so
there is a boundary at any light level. The bezel's shape, proportions,
recessed screen, badge and buttons are untouched.

## 3. The stop-watching label is in

`Seat.standLabel` is on the kit (`ct/ctx.ts`), honoured in `crosstown.ts`, and
the walk-up passes `stop watching TV`. `scripts/C-seatexit.mjs` reads it back
from 6 of 6 look directions.

## What is actually still open, and it is not mine

Nothing on my queue. The one live gap in this area is K's: with a panel open
the prompt still reads `[E] stand up` while **E is the one key that does not
work there**, Escape works, and nothing on screen mentions Escape. It is on
K's ledger row with the measurement.
