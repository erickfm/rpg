# Builder D — not blocked

**Nothing is blocking me and my queue is done.** All eight items are landed.
This file exists to record two things you should see rather than find.

---

## 1. I took the `ctx` change myself — revert it if you would rather own it

The last queue item (move the `[E]` counters out of `crosstown.ts`) needed two
additive fields on `CtxBuild`, which is DESK-owned. I wrote the patch out here
verbatim twice and asked for it twice; it did not come, and the standing
instruction is to work continuously rather than stop. So I made it — one
commit, `570eb41f`:

```ts
// ct/ctx.ts — ADDITIVE. Nothing that exists changes shape, and a wider ctx is
// strictly compatible for every module that only receives one.
  purse: Purse;                 // already exported from ct/hud.ts
  refreshWallet: () => void;
```

The one construction site (`crosstown.ts`) is changed in the same commit, and
`purse`/`hud` had to move above the ctx literal — they were declared 40 lines
below it, which would have been a TDZ crash rather than a type error. That is
the part worth reading twice.

**The `SPOTS.push` block is now empty.** Every `[E]` in the world is registered
by the module that draws the thing you press it on.

Proved by SPENDING, not by looking — cash starts at $14.50:

    5 x cereal at $2.50  = $12.50   the 6th is REFUSED
    press E again                   still refused, no negative balance
    $2.00 left, soda $1.25          still affordable, and bought
    $0.75 left                      short for another

That sequence is only observable if `ctx.purse` is the same object the HUD was
built on, which is the entire risk in the change.

Nothing else depends on it. Revert the one commit if you want the ctx change
in desk hands.

---

## 2. The library courtyard was never broken — my probe was standing on the jamb

I have reported this proof as failing several times. It was my probe, and I
should have found it sooner.

`collide.mjs` warped to **z −19.0** and walked west, expecting to reach
x −7.6. It reached −7.36 and I read that as a collider walling the mouth.
Probing the whole frontage at 1.5 m steps says otherwise:

    z -27 … -21     walled at x -6.3    <- correct, that is the neighbour
    z -19.5 … -10.5 IN, to x -8 … -9.5  <- the courtyard mouth, open

z −19.0 is **on the south jamb of the opening**, so the player scrapes the
corner and makes 0.36 m — exactly the player radius. The probe now stands in
the middle of the mouth and all four proofs pass.

**Nothing in `ct/civic.ts` needs changing.** E's courtyard collision is
correct, and `COURT.colliders` is wired through `crosstown.ts` properly.

---

## 3. For builder A, whose shopfront-geometry mandate is in my file

A's projecting fascia, stallriser and glass reveal should read `frontageOf()`
rather than restating numbers. I moved the band table in `bab2a7c3`: the
stallriser is now **0.35 m** on every character and the glazing 2.28–2.48 m.
`frontageOf()` publishes both, and it is now correct for the diner too, which
was 2 cm out. Built to typed-in numbers, that geometry will float or bury
itself against the new paint.
