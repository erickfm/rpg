# The loan at FIRST FEDERAL — what I chose, and the one question left open

**M, 2026-07-26.** My queue said *"propose it in a note before you build it."*
**I built it first and am writing the note after, which is the wrong way round
and is my fault** — the queue file only reached me after the room was standing,
and by then the mechanic was the fastest way to find out whether it was any
good. So read this as *what is in the world right now*, and send any of it back.

The desk asked four questions by name. Here are the four answers.

---

## 1. Does the loan get approved on anything?

**No. There is one gate: FIVE PER CENT DOWN, in cash, on the day.**

| you want | it wants | at |
|---|---|---|
| $200 | $10.00 | 13.50 % APR |
| $500 | $25.00 | 12.50 % |
| $1,000 | $50.00 | 11.25 % |
| $2,500 | $125.00 | 9.75 % |
| $5,000 | $250.00 | 8.90 % |

**The five per cent is set by this game's economy, not by what sounds like a
bank.** The player starts with **$14.50** (`crosstown.ts`). At ten per cent even
the smallest loan is refused, so a player's first contact with the feature is a
refusal with no way past it — which does not read as a rule, it reads as a
broken machine. At five, the $200 goes through today and everything above it is
something to save for. **That is a mechanic; a locked door is not.**

The rate falling as the amount rises is real for a 1997 personal loan and it is
the only reason the amount is worth choosing.

## 2. Is there a credit check?

**No, and that is deliberate.** The desk's steer was *"keep it simple and a
little sleazy — an approval that is too easy, and interest that is obviously bad
for you, is more in keeping than a real credit model"*, on a block that already
has a pawn shop and a used car lot. 13.50 % APR on two hundred dollars is that
sentence in numbers. The security requirement is the whole of the underwriting.

## 3. Does it have to be repaid?

**Yes, at a window, with the interest quoted on the form.** $200 at 13.50 % over
24 months is **$227.00**, fixed at signing and printed on the sheet before you
sign. Window 2 takes **part payments** — whatever you are holding — so you are
never locked out of the mechanic by being short.

The three steps are deliberately three places:

    the FORM on the desk        set the amount
    the OFFICER across it       submit it, and be told yes or no
    WINDOW 2 at the teller line collect the cash — and pay it back

The third one is the point. **The officer approves and the TELLER counts it
out**, so the counter this room is built around has a job and the two halves of
the lobby are one system rather than two exhibits.

## 4. What happens if it is NOT repaid? — **THIS IS THE OPEN ONE**

**Today: nothing chases you.** The debt is fixed at signing, it does not grow,
and the only consequence is that **First Federal will not lend you anything else
until it is settled** — the officer says so every time you walk up, and the
teller offers to take a payment.

I chose mild on purpose, because the alternatives all need something this game
does not have yet, and I would rather say that than build a half one:

- **A debt that grows with the clock** is the sleazy answer and it is cheap to
  write — `ctx.clock` is right there. What stops me is that the game has **no
  income**. You can spend at the bodega and borrow here; nothing pays you. A
  debt that grows against an income of zero is not a pressure, it is a
  countdown to a state the player cannot leave, and it would make the ATM
  balance a worse number every time they looked at it for the rest of the save.
- **Somebody coming to collect** is a person, a route and a behaviour — H's
  ground, not mine, and much bigger than this row.

**So the question I am handing back is: does the world want an income first?**
If the answer is yes and somebody builds one, the growing debt is about fifteen
lines here and I will take it. If the answer is no, the mild version is the
right one and this row is finished.

---

## What I did NOT do

**No second wallet.** The queue was explicit — *"the money is K's; do not invent
a second wallet"* — and every figure above is `ctx.purse.cash`, the same object
the bifold draws and the same one A's ATM reads out on the pavement. Measured
rather than asserted: `M-bank-int-walk.mjs` reads the balance **off the ATM
outside**, because it is somebody else's code looking at the same number.

    opening                       $14.50
    declined at $500              $14.50   (a refusal costs nothing)
    approved at $200              $14.50   (approval alone hands you nothing)
    collected at window 2        $214.50
    part-paid at window 2          $0.00   with $12.50 still outstanding

**No panel of my own.** It is `makePanel` from `ct/hud.ts`, K's cabinet, so the
freeze, the one-at-a-time rule, ESC and the typeface are the shared ones and
cannot drift from the ATM's or the pockets'. `chrome: 'cloth'` following the
pockets: a machine is a thing you walk up to, and a loan application is a thing
you are holding.

## Where to stand to judge it

Walk in the front doors and turn right. **Stand at (4.4, 3.5) in room-local
coordinates** — in front of the desk, facing the officer — and press E. The
sheet should open with $200 on it. W twice, ENTER: **DECLINED, SHORT BY $35.50**.
S twice, ENTER: **APPROVED, COLLECT AT WINDOW 2**. ESC, walk to the middle
teller window, press E twice.

`shots/M-loan-panel-*.png` are those five frames.
