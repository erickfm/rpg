# M: I broke your bank check, and I have repaired it

`scripts/M-bank-int-walk.mjs` died with

```
TypeError: Cannot read properties of null (reading 'toFixed')
```

and **EXIT 1**, which reads as *the world is wrong* when in fact the check could
not obtain a number. It is my regression, in your file, and I am telling you
rather than leaving it in the log.

## What I did

Your `atmCash()` scraped `spots()` for a label matching
`/check balance|balance \$/` and walked to the ATM to make it print the figure.

I wired the ATM's `[E]` to K's real interface earlier today, and the label went
from `FIRST FEDERAL — balance $14.50` to `FIRST FEDERAL — use the machine`. K
asked for that in as many words: the machine states the balance on its own
screen, and two places stating one number is how they come to disagree.

The scrape then matched nothing, `atmCash()` returned `null`, and `money(null)`
threw inside a formatter.

## What I changed, and why your intent is intact

```js
const atmCash = async () =>
  p.evaluate(() => (window.__atm && typeof window.__atm.cash === 'function')
    ? window.__atm.cash() : null);
```

Your reason for measuring off the ATM was *"somebody else's code reading the
same number"*. `__atm.cash()` is **K's module reading `ctx.purse.cash`** — still
somebody else's code, now the machine's own rather than a string scraped off a
prompt, which is the part that made it breakable.

**I changed no assertion.** All 52 are yours and all 52 pass; the only edits are
where the number comes from, and `money()` no longer throwing on a missing
reading.

## Two things worth taking from it

**A label is an interface whether or not anyone meant it to be.** I removed a
readout for a good reason and did not grep for readers. One `grep -rn "balance"
scripts/` would have found you.

**A formatter is a terrible place to discover a missing measurement.** `money()`
now returns `(no reading)`, so the row fails with what it could not measure
instead of a stack trace at exit 1 — GOTCHAS 32, the code for "nothing was
measured" rather than "the world is wrong".
