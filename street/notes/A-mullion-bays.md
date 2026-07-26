# I was wrong about the diner's mullions, and there is a real finding underneath

I recorded twice — in `A-diner-facade-fixed.md` and `A-QUEUE-CLOSED.md` — that
*"three bays of mullions over 8.45 m still looks coarse to me; I have no
measurement, so it stays a judgement and not a finding."* Keeping it out of the
findings was right. Leaving it unmeasured was not, so here is the measurement.

## The diner is not coarse. It is finer than most of the block.

Bay width = glazing span ÷ bays actually drawn:

```
A-1 TAX        13 m frontage   11.76 m glazing  /4.2   3 bays   3.92 m
THRIFT       12.5             11.40            /4.5   3        3.80
PAWN           15             13.76            /3.8   4        3.44
CHOP SUEY      11              9.76            /3.4   3        3.25
SMOKES / LOANS 11              9.76            /3.4   3        3.25
BURGER BARN    16             14.76            /3.2   5        2.95
LIQUOR         13             11.76            /3.4   4        2.94
DINER          12              8.45            /3.6   3        2.82   <- ninth of sixteen
DELI          9.5              8.26            /3.4   3        2.75
GARAGE / BILLIARDS / RADIO  12 10.76           /3.4   4        2.69
RECORDS       8.5              7.26            /3.4   3        2.42
BODEGA       6.05              4.81            /3.4   2        2.41
FLOWERS         6              4.76            /3.4   2        2.38
```

**The tax office and the thrift are the widest**, and the diner sits below the
median. My eye read "3 bays" as coarse and never checked what three bays meant
on that particular glazing — the diner's glass block eats 3.5 m of its 12 m
frontage, so its glazing is the shortest relative to its width on the block.

## The real finding: the divisor is in the wrong units

Every painter sizes its bays as `Math.round(wMeters / K)` — the FRONTAGE width —
and then draws them across `gw`, the GLAZING width. So

```ts
mullions(g, surf, gx, gy, gw, gh, Math.max(2, Math.round(wM / 3.6)), STEEL_D);
```

reads as *"a bay about every 3.6 m"* and is not: it is "however many 3.6 m fit
in the frontage, stretched over whatever glazing is left". The two differ by the
brick margins, the door, and — on the diner — a glass-block panel. The result is
that bay width is **uncontrolled, 2.38 m to 3.92 m, a 65 % spread**, with no
painter asking for that spread.

This is the same shape as the density pattern the auditor restated: the defect
is not that a painter computes its bays badly, it is that the number it computes
does not mean what it is written as.

## What I am NOT doing about it, and why

**Not changing it.** Correcting the units would re-bay all sixteen shopfronts
and repaint every band on the block, and I checked what it would actually buy:
dividing the GLAZING by the same constants gives the diner `round(8.45/3.6) = 2`
bays — 4.22 m, **coarser than what it has now**. So the obvious repair makes the
front I was worried about worse, and the honest fix is a decision about what a
bay should BE (a real 1997 shopfront pane is nearer 1.2–2.0 m, so every front
here is wide), not a units correction.

That is an aesthetic change across the whole block, nobody has complained about
it, and GOTCHAS 23 is the rule: real is not the same as visible. Recorded rather
than churned — the same call as the tax office's navy mouldings and the thrift's
bright window.

If the desk wants the block re-bayed to a target pane width, it is a one-line
change per painter and I will do it; it needs someone to choose the number.

## The correction that matters

Two of my notes tell a reader the diner's mullions look coarse. They are wrong
and now carry a pointer here. I had this filed as "a judgement, not a finding",
which sounds careful and still put a wrong impression in two documents somebody
else may act on — a judgement you decline to measure is just an unverified claim
with a disclaimer attached.
