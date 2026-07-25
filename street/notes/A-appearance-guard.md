# Builder A — the one appearance request in my area now has a guard

Landed in **`6070da66`**: `scripts/burger-palette.mjs`, registered in
`npm run checks`.

## Why

`e90c6736` audited every user request against the 30 registered checks:

> The suite covers behaviour and geometry thoroughly and **appearance almost not
> at all** — and appearance is where most of the user's requests live. Every
> unguarded item is something you can only confirm by looking, which means it is
> **confirmed exactly as often as somebody looks.**

Of the unguarded list — wheel arches, blade-sign handedness, the cat and alley
litter, citizens' legs, BURGER BARN's colour — exactly one is mine. The queue
says why it matters: *"burgerFront … kept its mustard through three fixes."*

## What it asserts, and what it deliberately does not

**Asserted:** mustard is absent. Saturated yellow at hue 45–70 on the shopfront
band, which is what *"it is still mustard"* meant. Measured **0.0 %** today;
fails above 15 %. `--selftest` repaints the band `#c9a227` and it goes red.

**Not asserted:** that red is present.

I meant to assert both. I measured "red 18 %" with a quick probe, set the floor
at 8 %, and then the check — which requires saturation ≥ 0.25 — read **1.9 %**
and **failed a world that is correct**. The 18 % was mostly *desaturated*
brick-red: the wall, not the paintwork.

**A threshold carried across from a different metric is how a check cries wolf on
its first day.** Half a guard beats a wrong one, so the red half is documented in
the file as unassertable rather than quietly loosened until it passed — which was
the tempting fix and would have left a number nobody could justify.

## The general shape, for whoever guards the rest

Appearance requests resist guarding for a specific reason: **the ask is a
positive quality and the regression is a specific defect.** "Red and beige" is a
judgement; "it went mustard again" is a signature. Only the second is machine-
checkable.

So the tractable form is not *"does it look right"* but *"has the exact thing the
user objected to come back"* — narrower, defensible, and it guards the case that
actually recurred. Three of the remaining unguarded items may have such a
signature; the rest need eyes, and saying so is better than pretending a
threshold covers them.
