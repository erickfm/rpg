# ~~The weather is periodic~~ FIXED in e0c68e46 — and verified here

**Status: the defect below is gone.** `e0c68e46` replaced `rainAt`'s
`Math.imul(h, K) % 100` — an arithmetic progression wearing a hash's clothes —
and published the function on `scene.userData.rainAt` so no script has to keep a
hand-copy of it. Verified at HEAD by calling the world's own function rather
than re-implementing it, which is the mistake the publishing was meant to end:

```
                                      before        after
  rain frequency                       22.0%        32.7%
  dry-spell lengths        ONLY 3, 4 or 8 h        1..21 and 23 — every length
  longest dry spell in 5000 days           8 h        23 h
  wet-spell lengths                  1 or 2 h        1..11 h
  middays with 12 dry hours behind   0 of 3999     55 of 4999
```

The lattice is gone and the counts are consistent with a real hash: at 32.7%
rain, independence predicts about 0.5% of middays to have twelve dry hours
behind them, and 55 of 4999 is 1.1% — the same order, where before it was
structurally impossible.

**One consequence worth stating rather than burying:** the street is now wet a
third of the time instead of a fifth. That cuts slightly against the request
this was fixed for — *"make wetness last a lil after it stops raining"* wants
dry pavement to contrast against. The 8 → 23 hour ceiling is what actually
delivers that contrast, and it more than pays for the higher rate, but the rate
did move and it moved the wrong way.

The original finding is kept below, because it is why the fix happened.

---

Builder C. Arithmetic on `rainAt`, no browser needed — anyone can re-run it.

`props.ts` decides rain per absolute hour with
`((Math.imul(h, 2246822519) >>> 0) % 100) < 22`. The frequency is exactly the
22% it looks like. The *arrangement* is not what it looks like.

Over 5000 game days:

```
dry spells   ONLY EVER 3, 4 or 8 hours     3h x7622   4h x16414   8h x637
wet spells   ONLY EVER 1 or 2 hours
longest dry spell in 5000 days:  8 hours
```

No dry spell of 1, 2, 5, 6, 7 hours has ever occurred and none longer than 8
ever will. **It rains at least every eight hours, forever.** I went looking for
a midday with twelve dry hours behind it — independence predicts about 200 in
4000 days — and there are zero.

## Why it matters, and it is not a defect claim

**A jumped clock is a world with no weather history.** `3d71b035` measured a
jumped 23:00 as 7.4% brighter than a stepped one and did not claim a mechanism.
Here is one contributor, at least for the ground: jump to an hour and the
street has never rained; step to the same hour and it rained within the last
eight hours, always, because there is no longer gap to arrive through.

It is why my own "noon, dry" reading moved so far when I re-measured it stepped
rather than jumped:

```
                    decal    tarmac   ratio
  noon dry, JUMPED  0.6933   1.0000   0.693     a street that has never rained
  noon dry, STEPPED 0.1978   0.2362   0.837     a street that rained this morning
  noon RAIN         0.1551   0.1705   0.910
  23:00 RAIN        0.0070   0.0077   0.910
```

Both are true; only the second is a place the player can be. **The conclusion I
drew from that table is unchanged** — the decals track the tarmac, ratio 0.84
to 0.91 — and it is the ratio that was the point, which is why it survived
three separate corrections to how the numbers were taken.

## What I could NOT establish, and why

**Whether the street ever finishes drying.** `props.ts` dries slowly on purpose
— *"longer after a long storm and longer again at night"* — and the longest
run it will ever be given is eight hours. Whether wetness reaches zero inside
one is a fair question and I failed to answer it twice:

1. Reading the tarmac's colour across the spell — confounded. Hours 182..189
   are 14:00..21:00, so the day/night grade swamps the wet tint.
2. Ratio of wet-registered surfaces to a non-wet ground reference at the same
   instant, to divide the time of day out — came back non-monotonic
   (0.385, 0.385, 0.385, 0.450, 0.609, 0.390, 0.276, 0.126, 0.148). The
   reference set is not a clean control.

Publishing the failure rather than the third attempt's number. The right
instrument is not a colour at all: it is `wetness` itself, which `props.ts`
keeps as a closure local and `Frame` does not carry — the same gap that stopped
my decals reacting to rain in their own loop and sent them to `ctx.wet()`.

**If `Frame` carried `wet: number`,** this would be a two-line check instead of
an afternoon, and `ct/props.ts`'s own drying model would become testable from
outside for the first time. That is a request for whoever owns it, not a patch:
`notes/C-lot.md` already records the same gap from the other direction.
