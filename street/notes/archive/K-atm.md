# FIRST FEDERAL — the machine you can actually use

*"i also want an atm interface and an inventory interface. equally try hard."*

**A: I need one line from you, and nothing else.** Details at the bottom.
**Desk: `src/proto/ct/atm.ts` is a new file and it has no row in
`OWNERSHIP.md`.** `scripts/ownership.sh K` passes it, but by DEFAULT rather than
by decision — which is the exact thing the table's own notes say costs a day.
Please give it a name; I am assuming it is mine.

---

## What it is, and what it is not

**Not** the machine. The niche cut into the bank wall, the raked screen, the
keypad, the three reveal tones, the 0.15 m recess — all of that is A's, in
`ct/bank.ts`, it went through four passes and a user ruling, and the user has
said he likes it. `ct/atm.ts` draws **none** of it and touches **nothing** in
that file.

This is only what happens after you press `[E]` on it.

## It behaves like a 1997 bank machine, which mostly means literally

Insert card → PIN → menu → balance / withdraw → notes counted → take your cash →
receipt? → take your card. Chunky buttons down both sides, **1–4 on the left and
5–8 on the right**, with the menu items lined up against them, because that is
what the layout is *for*. Amber CRT with scanlines. A card slot with a lamp and
a cash mouth that has notes visibly sitting in it when there are notes in it.

**The receipt is the joke.** It asks, and if you say yes it tells you there is no
paper in this machine. It has never had paper in it.

**The PIN is any four digits**, on purpose. It is your card. A machine that can
reject you turns a piece of texture into a guessing game with nothing on the
other side of it.

**Digits work at all** only because this is a `makePanel` panel: `src/main.ts`
spends every digit switching prototypes, and the panel gate takes keydown before
main.ts's listener sees it. See `notes/K-panel-framework.md`.

## The money is one model, not two

Cash you withdraw lands in **`purse.cash`** — the same number the wallet shows,
the same one the bodega spends. There is no second wallet.

What is new is **`purse.account`**, the bank's side, seeded at **$312.40** on
first use. It has to be a separate number or the machine has nothing to do: an
ATM whose balance IS your cash can only ever tell you what your own wallet
already says, which is what the placeholder did.

`purse.card` (default true) is whether your card is in the wallet. With no card
the screen says **NO CARD / SEE YOUR BRANCH FOR A NEW ONE** and will not
proceed — the desk asked what happens and that is what happens. Nothing in the
world sets it false yet; `__atm.setCard(false)` does, and the check uses it.

**Walking away costs you nothing.** A real machine of that era would keep a card
you left in it, and would keep notes you did not take. That is a lovely detail
and a bad rule: the framework promises ESC always works, so **ESC must never be
the expensive choice**. Anything already in the mouth goes into your pocket and
the card comes back.

## Checked

`scripts/K-atm-walk.mjs`, registered in `checks.mjs`. It asserts the money
rather than the pictures:

```
the account fell by exactly $40 (312.4 -> 272.4)
$40 is in the mouth and NOT yet in your pocket (cash still 14.5)
taking it put $40 in your pocket (14.5 -> 54.5)
nothing was created or destroyed (272.4 + 54.5 = 326.9)
walking away mid-session leaves nothing in the machine
```

`--selftest` **jams the dispenser** — the debit stands and the notes vanish,
which is the one failure of a cash machine that matters and the one that every
screen of the thing sails through looking perfectly correct. Watched it go red
on all three conservation verdicts.

It also checks the framework's promises from a caller's side — world frozen
behind it, digits reaching the machine and not the world, ESC costing nothing —
because a promise the kit makes to three builders is worth checking once rather
than trusting three times.

---

## A: the one line

`ct/bank.ts` already registers the machine's `[E]` and already reads the purse.
Swap the placeholder readout for the machine:

```ts
import { openAtm } from './atm';
…
label: () => 'FIRST FEDERAL — use the machine',
act: () => openAtm(),
```

That is all. `ct/atm.ts` never draws or moves any part of what you built.

One thing worth your eye either way: the current label says
`balance $${purse.cash}`, and that number is the **cash in the player's
pocket**. The account is `purse.account` now. If you keep a readout at all it
should be that — though the machine says it on its own screen, so you may not
want one.

**Until that line lands the ATM is unreachable from the world**, which is why I
am not claiming this row is finished. `window.__atm.open()` opens it from
anywhere and is how the check drives it.

**STATION:** `window.__atm.open()`, then `1`, four digits, ENTER.
`shots/K/atm-{1-idle … 10-thanks,11-nocard}.png` is the whole session.

— K
