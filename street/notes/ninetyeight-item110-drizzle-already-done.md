# item 110 — the drizzle already exists. Verified, not rebuilt.

Worker ninetyeight, 2026-08-03. Port **4540**, built bundle at `8b0c2032c`.
**No change to `ct/props.ts`.** The row was marked `[VERIFY STATE]` and the
verification passes, so this is a confirmation, not a build.

> *"rain seems extra intense now. thats fine but i want a drizzle to also exist
> and be more likely than the downpour featured here."*
> — `FEATURE-REQUESTS.md:2579`

The ask has two halves and they need two different instruments.

## Half 2 — "more likely than the downpour": a distribution

`scripts/probes/w59-storm-dist.mjs` (existing), 20000 hours on the built bundle:

```
6607 wet hours out of 20000 (33.0%)
min 0.340  p10 0.346  median 0.509  p90 0.883  max 1.000   mean 0.563

Q1 0.34-0.51  3264  49.4%      drizzle  (bottom quarter): 3264 (49.4%)
Q2 0.51-0.67  1337  20.2%      downpour (above 0.90)    :  544 ( 8.2%)
Q3 0.67-0.83  1070  16.2%
Q4 0.83-1.00   936  14.2%      monotonically decreasing: true
                               lightest quartile is 3.5x the heaviest
```

Drizzle is **6.0× more common than downpour**, and the decrease is monotone —
every lighter band beats every equally-wide heavier band, not merely on average.
`ct/props.ts:289` is `STORM_FLOOR + (1 - STORM_FLOOR) * u * u` with
`STORM_FLOOR = 0.34`; for uniform `u`, `u²` has density `1/(2√x)`, which is
strictly decreasing, so that property is structural rather than lucky. Rain
*rate* is untouched at 33.0% of hours, which is right — he complained about
strength, not frequency.

## Half 1 — "a drizzle to also EXIST": a picture

A histogram cannot answer this. The dangerous failure of lowering a storm floor
is that the weakest storms stop reading as weather — and *"rain too faint"* is
the complaint already on file in the opposite direction, which is why the floor
is 0.34 and not 0.

`scripts/probes/w98-drizzle-vs-downpour.mjs` (new) forces both extremes and
photographs them:

```
lightest  hour   3781  stormAt 0.340 -> stormNow 0.340  rainHeavy 0.330
heaviest  hour 158413  stormAt 1.000 -> stormNow 1.000  rainHeavy 0.971
PASS established / distinct / latched / floor
```

**Both frames are at the same hour of day**, which is the one care that makes
them comparable. `hourAbs` is `floor(totalMin / 60)` (`crosstown.ts:1850`) and
`__ct.clock(h)` sets exactly that, so hours 13, 37, 61 … are all 13:00 with
independent storm draws. Comparing a storm at 13:00 with one at 03:00 would be
photographing the night wash, not the rain.

`shots/w98-rain-drizzle.png` and `shots/w98-rain-downpour.png`, looked at:
identical framing and light, and the difference is unmistakable. The drizzle is
sparse, short, faint streaks you can count individually against the brick, with
the road wet and dark — plainly rain, and plainly light. The downpour is several
times as many streaks, longer and brighter. **Both read as rain; neither reads
as the other.** That is the ask.

## The one instrument fault worth recording

The first shot stood at `(6, -14)` facing a bodega window, and a shopfront two
metres away filled the frame with the single surface a few hundred thin streaks
are hardest to see against — the drizzle was legible only in the strip of sky
above it. Rain has to be photographed **down** a street, not across it at a
wall. Fixed and commented in the probe; it would have been very easy to read
that first frame as "the drizzle is invisible" and go and change a value that
is correct.

## Not done

Nothing outstanding on this row. `w59-storm-dist.mjs` is a probe, not a
registered check — if the desk wants the distribution defended against future
edits it would have to be promoted into `scripts/checks.mjs`, which is outside
this item.
