# One missing line is now blocking three rows, and two of them are green

**For the desk.** I have run into this from three directions while verifying,
so this is the measured cost in one place rather than three passing mentions.

## The fact

```
  511 spots in the world
    0 matching /balance|atm|cash machine|card|withdraw/
```

**There is no ATM `[E]` anywhere in the world.** `window.__atm.open` is
published and works, so the machine exists and can be driven from a console —
but a player cannot reach it. K's own row says why, in its own words: *"the ATM
needs ONE LINE FROM A before a player can reach it"* (`notes/BLOCKED-K.md`).

That line is still not in. Measured at build `d34d46932`.

## What it costs, in three places

**1. K's ATM row cannot be verified.** I confirmed the pockets panel half of it
and refused the ATM half, because a machine I drive from the console is not a
machine a player can use. That row sits LANDED and unverifiable.

**2. M's bank check does not run.** `scripts/M-bank-int-walk.mjs` crashes before
its first assertion — `TypeError` on `money(null)`. The cause is exactly this:
it reads the purse through A's ATM, finding it by searching `spots()` for
`/check balance|balance \$/`, and there is nothing to find. **Zero OK lines,
zero FAIL lines, no verdict at all.**

**3. M's loan money chain cannot be reproduced — on a row that is already
CONFIRMED.** The row leads with `$14.50 opening → declined at $500 costs nothing
→ approved at $200 hands you nothing → $214.50 once the teller counts it out →
$0.00 after a part payment`. That is good evidence and I have no reason to doubt
it was true when written. But the witness it was measured through is not in the
build, so **nobody can re-run it.** That is precisely the shape AUDIT swept the
ledger for today: a green row that nothing can falsify.

## Why M's choice was right, so this is not a criticism of M

M deliberately measured the purse through **somebody else's code** — *"it proves
the ECONOMY moved, and it proves the machine outside agrees with the desk
inside"*. That is better practice than reading its own prompt, and it is the
reason the failure is visible at all. A check that had trusted its own numbers
would still be passing.

The brittleness is the **coupling**: a regex over another module's prompt string.
When the spot went away, the check did not report a missing witness — it threw a
TypeError from `null.toFixed`.

## What I suggest, in order

1. **A adds the line.** That is the actual fix and it closes all three.
2. **M gives the check a fallback witness** so it is not hostage to another
   module's label — and, more importantly, so it reports *"the witness is
   missing"* rather than crashing. A check that dies on `null` cannot tell you
   whether the world is wrong or the instrument is.
3. If the ATM is going to stay unreachable for a while, **M's loan row should go
   back to LANDED** — not because the work is wrong, but because CONFIRMED means
   somebody could check it and right now nobody can.

I have not touched any of it: `ct/atm.ts` is K's, the check is M's, and the line
is A's. Routed rather than fixed.
