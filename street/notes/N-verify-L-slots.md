# VERIFY L's slots — sitting opens it, the money is conserved to the cent, and you get off the stool

Builder N, verifying a row I did not build. **Not marked CONFIRMED** — only the
desk or the auditor may. Built bundle on 4195, HEAD `ee2c2aaa7`.

Driven by hand at L's own station: `window.__ct.seats().filter(s => s.label ===
'sit at the slot')` returns **96**, warp to `.at`, press E.

## ✅ It opens because you SAT — one press, not two

That is the user's actual sentence — *"when i sit down i enter the slots"* — and
it is the half a maths check cannot see.

```
before          cash $14.50, panel closed, not seated
after ONE E     panel OPEN, seated true
```

No second press anywhere.

## ✅ The money is conserved, exactly, and there is no second wallet

```
FEED $5 note    cash $14.50 -> $9.50   meter 20 credits @ $0.25 = $5.00 exactly
4 SPINS         meter 20 -> 18         cash UNCHANGED at $9.50
ESC             cash $9.50 -> $14.00   expected $14.00   MATCH   meter -> 0
```

Money moves only at the two boundaries, never mid-play, which is what makes
*"what you win is in your wallet when you stand up"* true by construction rather
than by bookkeeping.

**And it closes:** the wallet went $14.50 → $14.00, net **−$0.50**, and the
game's own counters say staked 4, returned 2 credits — `(2 − 4) × $0.25 =
−$0.50`. The wallet and the meter agree to the cent by two different routes.

## ✅ YOU GET OFF THE STOOL — and this is the one I most expected to fail

C measured the casino floor as the **worst trigger cluster in the world**: of
the 69 spots in this world sitting at exactly 0.00 m from a stand spot, **78 of
the entries are `sit at the slot`** (`notes/N-verify-C-seat-exit.md`), and C
named it *"exactly the case the desk predicted L would hit."*

It does not hit.

```
after ESC   panel closed, still seated   (correct — ESC leaves the machine, not the stool)
after E     seated FALSE
```

ESC and E do two different jobs and neither eats the other. Recording this
against C's row as well as L's: **the predicted failure has not materialised on
the seats that were predicted to show it.**

## ✅ The headline RTP is the honest quotient of its own table

```
rows sum to 9885 credits over 2023 winning combos
header says   9885 / 2023
9885 / 10648 = 0.928343351      headline = 0.928343351
```

Nine decimal places. That rules out the failure worth ruling out — a summary
figure that its own enumeration does not support.

## ❌ What I did NOT verify, said rather than glossed

**I did not independently re-derive the 92.834%.** L's row calls it *"the EXACT
enumeration of all 22³ = 10,648 stop combinations"*, and re-deriving that needs
the reel strips, which are not published on `__slots` (`open, close, view,
insert, play, rtp, cash, credit` — no strips). So what I checked is that the
number is consistent with the table L publishes, not that the table is right.

**And I nearly filed a spectacular false red doing it.** I drove
`__slots.play(1)` 200,000 times to measure the return empirically and got
**0.000000 — a 92.8 percentage-point miss.** `play()` returns `false`: it is
the UI's spin trigger, not a headless resolver, so I measured my own instrument
converting `false` to 0. Two hundred thousand samples of nothing, and it would
have read as a catastrophic finding against a working game.

GOTCHAS §48's family, and the third instrument fault I have produced today. The
tell was that the number was too round.

**Corroboration, clearly labelled as L's own and not independent:**
`L-slots-inworld.mjs all` and `L-slots-rtp.mjs all` both exit 0 on my build.

— N
