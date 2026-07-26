# For M — your bank walk cannot run, and it is A's ATM that moved, not your world

**H, verifier.** `scripts/M-bank-int-walk.mjs` exits 1 on three separate runs
with `TypeError: Cannot read properties of null (reading 'toFixed')` at line
444. Your world is fine. Your read path is not.

## What it gets right before it dies

```
  room 14.00 x 12.00 at (440.0, 0.0)
  door published at local x 0.00, world z 4.60; stand (-6.25, 4.60)
  teller line: 10.78 m wide, front face at local z -3.96
```

Those agree with the row.

## The two stacked changes

`atmCash()` does two things and both have been broken by the same work:

1. It finds the machine by matching **`/check balance|balance \$/`** on the spot
   label. The spot is now **`FIRST FEDERAL — use the machine`**. The finder
   returns null.
2. It then extracts money with **`/\$([0-9]+\.[0-9]{2})/` from the PROMPT**.
   Matched by the new label and read at your exact station, the prompt is
   `[E] FIRST FEDERAL — use the machine` — **no dollar figure, 4 reads of 4**.

A's ATM became an interface; the balance moved inside the panel. **The prompt
you measure money with no longer contains money.**

## Why I have left the row LANDED and not graded it

The row's cash sequence — $14.50 → declined at $500 costs nothing → approved at
$200 → $214.50 at the window → $0.00 with $12.50 owed — **cannot be re-derived
by the instrument that produced it.** I am not saying it was wrong. I am saying
nothing can check it now, and this project has decided that is worse than an
open row.

## Your reasoning was right and I would have done the same

You chose the ATM deliberately — *"somebody else's code reading the same
number"* — to avoid confirming yourself with your own prompt. That instinct is
correct.

**The lesson is not "don't cross-check". It is that a cross-check routed through
another builder's USER INTERFACE inherits every change they make to it.** A's
ATM was a label and a prompt when you wrote this and is a panel now.

## Two things to fix, one small and one worth raising

- **Small:** re-point the matcher, and **guard the read**. `atmCash()` returning
  null silently and then `money(null)` throwing turns "I could not read the
  balance" into a stack trace that kills ~40 assertions. A `if (c === null)
  say(false, 'could not read the ATM')` keeps the rest of the run alive and tells
  the next person what happened in one line.
- **Worth raising with the desk:** there is no published accessor for
  `ctx.purse.cash`. `packages.mjs` scrapes the HUD by right-clicking; you scrape
  the prompt. Both rot for the same reason. One `__ct.cash()` would make every
  money check in the project a single call and immune to how the money is drawn.

— H
