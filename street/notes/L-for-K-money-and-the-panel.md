# L → K: the take/give call, the credit, and the shared panel

I am builder L. I own `src/proto/ct/slots.ts` and nothing else. I am building
the playable slot machine, and after it blackjack. Both spend and pay the
player's money, and both are full-screen panels. Neither is mine to model.

**I am not building a second wallet.** The desk was explicit and it is obviously
right: two money models that disagree is a bug the user finds in a minute. This
note is the ask, and it has one question in it that I think is genuinely yours
to rule on rather than mine (§2, the credit).

**Status:** the maths is landed (`ccc94df56`, RTP 92.834%). It touches no money
and no DOM. Nothing here blocked it. It blocks the two items after it.

---

## 1. The money verb — is `ctx.purse.cash` directly the sanctioned call?

What I can see today:

- `ct/hud.ts:16` — `export interface Purse { cash: number; inv: Record<string, number> }`,
  and `:15` calls it *"The player's pockets — the wallet is a view onto this,
  nothing more."*
- `ct/ctx.ts:194` — `purse: Purse` on the build context, with `refreshWallet` at
  `:196` described as *"call after changing `purse` so the wallet readout catches
  up"*.
- `ct/int-bodega.ts:709` is the only precedent in the world:

  ```ts
  if (ctx.purse.cash < price) return;
  ctx.purse.cash -= price;
  ```

So the model already exists and is already shared, and I do **not** need you to
invent one. What I need is a ruling on how a GAME should use it, because a shop
and a slot machine are not the same shape:

- the bodega takes money **once, at a known price, and gives you a thing**;
- a slot machine takes 1–5 credits **every few seconds for an hour** and pays
  back at unpredictable moments.

Three specific things I would rather you decide than me:

**(a) Do you want a named verb, or is the raw field fine?**  Something like
`spend(ctx, n): boolean` / `payOut(ctx, n): void` in `ct/inventory.ts` would give
you one place to see money move, and would stop me and the ATM and the bodega
each writing the decrement slightly differently. If you would rather keep it a
plain field, say so and I will do exactly what the bodega does and nothing more.

**(b) Rounding.**  `cash` is a float and the wallet paints
`$${purse.cash.toFixed(2)}` (`hud.ts:268`). A machine that runs thousands of
transactions will accumulate float error where a shop making four purchases a
day never will. If cash is really cents, I would rather add and subtract
integers and let the view divide. **If you want to change the field's units,
that is a change to your model and I will follow it — I am flagging that I am
about to be the heaviest user of it, not asking you to change it.**

**(c) Does the machine hold a balance, or is the wallet the balance?**  A real
1997 machine has a CREDIT METER: you feed it a note, you play down the meter,
you press CASH OUT and it gives you back what is left. That is period-correct
and it is also better play — you are not watching your bank account tick on
every spin. My plan is:

- the credit meter is machine state, in my file, and is **not** money;
- sitting down with an empty meter offers INSERT — takes cash, adds credits;
- CASH OUT and standing up both convert the meter back to cash;
- **standing up always cashes out.** You cannot leave money in the machine and
  you cannot walk away from the room with a meter that survives. The desk's
  words for the requirement are *"what you win is in your wallet when you stand
  up"*, and this is how I intend to guarantee it.

If you would rather the meter not exist and every spin hit `purse.cash`
directly, that is a defensible call — tell me and I will do it. **But if the
meter stays, the invariant "credits only ever exist between sitting down and
standing up" is the thing I need you to sanity-check**, because it is the one
place a second wallet could sneak in by accident.

## 2. What is a credit worth? — I think this one is genuinely yours

The wallet is in **dollars and cents**. My machine is in **credits**. Something
has to author the rate ONCE, and it should not be me: the ATM is yours, the
pockets are yours, and if the slot machine picks a number then the ATM and the
slot machine are two authorings of the same fact.

**My proposal: 1 credit = $0.25.** A 1997 neighbourhood casino floor is quarter
slots — that is what the machines in that room ARE — and it makes the numbers
read right at every scale:

| | credits | dollars |
|---|---|---|
| one spin, 1 credit | 1 | $0.25 |
| max bet | 5 | $1.25 |
| a $20 note buys | 80 | a real sitting |
| 3 CHERRIES, 40x | 40 | $10.00 |
| **3 SEVENS, 250x** | 250 | **$62.50** |

$62.50 on a quarter machine is a correct 1997 jackpot: a good night, not a life
change, which is the right size for this street. At $1 a credit the same
jackpot is $250 and the room becomes somewhere else.

It also matters for the drift the user asked for. Measured, not guessed —
`node scripts/L-slots-rtp.mjs sessions`, 2,000 runs:

```
    median spins survived   ~397 of 500
    ran out before 500      53.400%
    still up when they stop 23.750%
    average high-water mark 160 credits
```

At 1 credit = $0.25, **$25 buys 100 credits and lasts about 400 spins**, which
at roughly 4 s a spin is a good half-hour sitting that drifts down. That is the
user's *"sit and play a while, win sometimes, and drift down slowly"* in the
actual currency of his wallet, and the rate is what makes it true.

**Tell me the number and I will use yours.** I only care that there is one.

## 3. The panel framework — I will use it, and here is what I need from it

The desk told me you are building **one shared panel framework** in `ct/hud.ts`
for all three of the ATM, the pockets and my games, and that I should use it
rather than roll my own. Agreed without reservation: three people building three
panels gives this world three different-looking UIs and he will see it instantly.
I have not written a line of DOM and will not until yours is callable.

What my two games need from it. This is a wish list, not a requirement list —
**build what the ATM and the pockets need and I will fit inside it**; I am
writing it down now only so it is in front of you while you are choosing the
shape, rather than arriving as a change request after it lands.

1. **Open, close, and the world frozen behind it** — you have this in the brief.
   For me "frozen" also has to mean the `[E]` prompt and mouse-look are off,
   because I am taking keys.
2. **Keys.** A slot machine is one big button; blackjack is four. If the frame
   owns keyboard focus I need a way to receive keys while open, and I need
   **`Esc` reserved for close** rather than owned by me.
3. **A per-frame tick while open, in real seconds.** This is the one I would
   most like and the one I would be most sorry to hand-roll. The whole feel of
   this feature is animated — reels stopping one at a time left to right, a
   payout counting up — and that has to advance on FRAMES, not on `setTimeout`
   (GOTCHAS §30: a fixed sleep for anything the render loop drives fails only
   under load, and GOTCHAS §43: below 20 fps sim time and wall time are not the
   same clock). If the frame gives me `onTick(dt)` my animation is testable and
   correct on a slow machine; if it does not, I will drive it off
   `requestAnimationFrame` inside my own panel and the two clocks can disagree.
4. **A canvas I paint, not widgets.** Both games are drawn — reels behind glass,
   cards on felt — at the world's own pixel density. I do not need buttons,
   layout or text fields. One `CanvasRenderingContext2D`, its size, and the
   bezel drawn around it by you is ideal.
5. **Close must be refusable, or at least notified.** You cannot walk out of a
   spin mid-flight, and standing up has to cash out (§1c). If the frame can ask
   me `canClose()` or call `onClose()` before it goes, that is enough.

**Tell me the moment it is callable and I will build against it.** Until then I
am building the game as pure logic with no DOM in it at all — reels, stagger,
anticipation, payout ramp, all advanced by a `dt` I am handed — precisely so
that fitting it into your frame is a rendering job and not a rewrite. That is
also what makes blackjack cheap: same frame, same money, same seat mechanism,
and only the rules and the cards are new.

## 4. What I am not asking for

Not asking for an item, a takeable, a pocket slot, or anything on the pockets
panel. Not asking you to know what a slot machine is. Not asking for anything
before the framework you are already building.

---

*L. Nothing here blocks you; all of it blocks me, in the order written.*
