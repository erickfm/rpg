# VERIFY K's sleep fade — the BED calls it now. The desk's re-open is resolved.

Builder N, verifying a row I did not build. **Not marked CONFIRMED** — only the
desk or the auditor may. Built bundle on 4195, HEAD `9c78e4b64`.

This row has the most dangerous history in the ledger: it was **CONFIRMED and
not true at the same time**. K built the capability, the bed never called it, and
the desk re-opened it with a station that could not be misread:

> *"sit on the bed in 301, press E, and watch the screen — not the clock."*

So that is the only thing I measured.

## The bed, at the desk's own station and by the desk's own method

Sampling `#ct-fade`'s computed opacity every 25 ms — K's method, the one the
desk and A used — pressing `[E] sleep until morning` from the bed:

| | desk's re-open (before) | mine (now) |
|---|---|---|
| peak opacity | **0.000** | **1.000** |
| samples fully black | **0 of 25** | **15 of 51** |
| clock | +16.5 h, with no fade | +17.7 h, 13:21 → 07:02 |

**The bed fades.** The thing the desk re-opened the row for is done.

## Seen, not just asserted — H's method reproduces

Four frames through one bed fade, and the file sizes settle it on their own the
way H said they would: a flat black frame compresses to almost nothing, a
rendered street cannot.

```
shots/N/fade-bed-400.png    55.5 KB   the room
shots/N/fade-bed-700.png     4.2 KB   BLACK
shots/N/fade-bed-1000.png    4.2 KB   BLACK
shots/N/fade-bed-1400.png   56.7 KB   the room, back
```

I opened the 700 ms frame. It is black — not a blank error page, not a white
canvas: a fully black frame at 1280 × 720.

## A harness fault of my own, recorded because it nearly cost me the control

I ran the control first, as the desk did — and got **0 samples, peak
`-Infinity`**. Not a finding: `page.evaluate(() => window.__hud.fade(…))`
returns a promise and Playwright **awaits it**, so the whole fade completed
before my sampling loop began.

Same family as the fault H recorded on this very row (reading a WebGL canvas
with `drawImage` and getting a constant 0.4979). **This row has now produced two
instrument faults and zero feature faults on the visual side**, which is worth
saying out loud to whoever measures it next.

The control turned out not to be load-bearing here — the bed itself reached
1.000, so the instrument demonstrably can see a fade — but if the bed had read
0.000 I would have had no control to distinguish "no fade" from "my loop never
ran", and that is exactly how a false red gets filed.

## A cross-check that happens to be mine

`ct/tenancy.ts` claims its rent and post are **derived from the clock rather
than accumulated**, so that sleeping through days behaves like walking through
them. Every test of that claim so far has snapped the clock. This is the first
time I have watched it across a **real slept night**, driven by somebody else's
feature:

```
before   day 0, 13:21, 3 letters waiting
after    day 1, 07:03, 3 letters waiting, 3 envelopes showing
```

Correct in the detail that matters: waking at 07:03 is **before** the 11:00
post, so day 1's mail has not arrived yet and day 0's is still in the box. A
model that accumulated per frame would have lost or doubled it.

— N
