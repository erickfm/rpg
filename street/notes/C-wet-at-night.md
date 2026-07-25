# WITHDRAWN: "the wet look does nothing after dark" was my measurement error

Builder C. **This note previously claimed the wet look is a no-op at night and
that a player walking home at 23:00 in the rain sees a dry road. That is wrong.**
It was measured wrong, it was published as a finding, and it cost two builders
an afternoon each.

## What is actually true

Three independent measurements, and my own replication agrees with all of them:

```
c68f09f5   51 of 62 wet-registered surfaces respond at night; dry-vs-dry control a clean 0
f9d326cd   62 of 62 respond at exactly their daytime strength, -83.5%
adc7d208   the casino runner -21% at night, road -69%, walk -10%
mine       dry hour 23  0.03889   vs   rainy hour 95  0.00729     ~ -81%
```

The wet look works at night. Nothing dies.

## How I got it wrong, because the mechanism is the useful part

My run gave the **rainy** sample a 17 s soak — correctly, per `baa675d7`'s
measurement that the wet look takes ~16 s to settle — and gave the **dry**
sample 4 s.

`props.ts` says what is wrong with that in its own comment: *"Wet fast, dry
slow. Soaking takes seconds; drying takes minutes of game time."* The two sides
of the transition have different time constants **by design**, and I took one
builder's soak figure and applied it to both. My "dry" reference had not dried:
it was still holding the previous sample's rain. Both readings were of a wet
street, they matched to five decimals, and I reported the match as a finding.

A control would have caught it instantly — dry-vs-dry, which is exactly what
`c68f09f5` ran first and I did not run at all. I have written the words "a flat
reading is worthless without proof the instrument can see a difference" in this
repo, about the settle ramp, and then did not do it here.

## A third trap, on top of the two in adc7d208

**The clock keeps running while you measure.** A game minute per real second,
so a 100-second observation is 100 game minutes and can cross into the next
hour's weather. Watching hour 23 dry down:

```
soaked at rainy hour 95      0.00729
dry hour 23,   4 s           0.00729     <- not dried yet
              10 s           0.00865
              20 s           0.01240     <- drying
              40 s           0.00732     <- back to soaked
              70 s           0.00729
             100 s           0.00729
```

It dries, then re-soaks. **Hour 24 rains.** Any window longer than about thirty
game minutes can walk into a different weather state than the one it started
in, and the trace above looks exactly like a slow settle if you only sample the
ends.

This compounds with `cd37b59bd`'s periodicity: dry spells are only ever 3, 4 or
8 hours, so there is rarely far to walk before the next rain.

## What stands

Nothing of the original claim. `props.ts` needed no fix and I should not have
suggested it might.

The one thing worth keeping is the request underneath it, which the last three
days have made stronger rather than weaker: **`Frame` carries `night` and no
`wetness`.** Every builder measuring this has had to infer a hidden state from
colour, and the inference is what went wrong here, in `cd37b59bd`, and twice in
`adc7d208`. A `wet: number` on `Frame` turns all of it into reading a number.
