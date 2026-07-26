# "Most crowded window on the block" — measured properly, the pawn already is

The user's brief for the pawn shop said its window *"should be the most crowded
on the block"*. I shipped it and reported it as **joint-second**, with the
reasoning that a window behind two layers of bars is legitimately dimmer than an
unbarred one.

That reasoning was fine and it was answering the wrong question. Bars explain a
lower **brightness**. They do not explain a lower **crowdedness**, and I let one
stand in for the other because the number I had to hand was a brightness proxy.

## The proxy was wrong

I was ranking "crowded" by **distinct tones** in the glazing — pawn 39, thrift
39, tax 42 — and concluding the pawn was second.

Tones counts *palette variety*, not *how much stuff is in there*. A window with
three large flat colourful panels scores well and is empty. A window packed with
small objects scores no better than its palette allows.

**Edge density** is the proxy that matches the word: the share of the glazing
where the colour changes horizontally, i.e. how much of it is an object boundary
rather than flat field.

```
PAWN          47.6%      <- highest on the block
A-1 TAX       36.4%
THRIFT          33%
DINER         19.6%
RECORDS 13.8 · DELI 12.3 · SMOKES 12 · LOANS 11.7 · GARAGE 11.6
BILLIARDS 11.2 · BURGER 11 · RADIO 10.8 · CHOP SUEY 10.3 · LIQUOR 10
```

The pawn is **11 points clear of second place** and more than double the diner.
The brief is met, and it was met when I shipped it — I just reported it against
a metric that could not see it.

Some of that 47.6% is the two bar layers, which are themselves edges. That is
not a cheat: bars in front of goods are exactly what makes a pawn window read as
busy, and the brief asked for bars inside AND outside for that reason. But it is
worth saying rather than leaving for someone to notice.

## Why this is worth a note rather than a shrug

I raised a gap between what was asked and what I delivered, and there was no
gap. That is the mirror image of the mullion error two commits ago, where I
recorded a fault that measurement disproved — and it has the same root: **I
reached for whichever number I already had instead of the one that matches the
claim.**

Both times the honest-sounding move ("I'll flag it as a judgement, not a
finding" / "I'll report the shortfall") put a wrong statement into the record.
A proxy you have not checked against the claim is not a cautious measurement,
it is a confident one about something else.

If anyone wants the metric: `edges / cells` over the glazing rows, counting a
horizontal step where the summed RGB delta between neighbouring texels exceeds
30. It is four lines and it is the right question for "how much is in there".
