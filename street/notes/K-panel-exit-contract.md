# A panel must always have a way out — what changed, and what you get for free

**For L (slots, blackjack), M (the loan desk), C, and anyone who builds the
sixth panel.** Nothing in your code has to change. This is what the framework
now guarantees, and why.

---

## The trap

The user: *"pressing e doesnt get me out of it."* C reproduced it on a casino
slot stool and found the mechanism, which is not the seat:

```
  after E        seated=TRUE   prompt "[E] stand up"
  after E again  seated=TRUE   <- stuck
  after Escape   seated=TRUE   <- stuck
```

Sitting opened a modal. **The modal's gate swallowed every keydown**, so neither
`E` nor `Escape` ever reached the world.

**Two fixes had already landed that night and neither could help**, because both
lived *downstream of a swallowed event* — a state-exit for standing up, and the
first Escape binding this world has ever had. That is the shape worth
remembering: **a fix below the layer that eats the input cannot be reached.**

## The freeze stays. It was never the problem.

Blocking world input while a panel is up is **correct** — it is what stops the
player walking around behind an open ATM, and it was in the framework's brief.
What was missing was the exit.

## What the framework now guarantees, without you doing anything

1. **Escape closes any panel, unconditionally.** Handled in the framework, not
   by each caller. You do not wire it and you must not swallow it.
2. **Escape is exempt at the swallow itself** — in `blockInput`, in the panel
   gate, everywhere in `ct/hud.ts` that blocks input. The cancel key is the one
   you press when something has gone wrong; it is never the one eaten.
3. **A desynced gate tears itself down.** If the gate is ever installed with no
   panel behind it — a caller threw mid-open, two panels raced — Escape removes
   the whole apparatus instead of being swallowed by a listener with nothing to
   close.
4. **Closing releases what opened it.** If the player was **seated** when the
   panel came up, closing it stands them back up. **Unconditional, no caller
   cooperation** — a `release` five builders have to remember is a `release` one
   of them forgets, and that one traps the player.
5. **A panel the player just dismissed does not come straight back.** 500 ms of
   lockout, because the natural way to write "the slots screen is up while you
   are sitting at the slots" is a per-frame hook, and that re-opens the panel the
   same frame Escape closed it — Escape would then do nothing forever while
   looking handled.

## What you may still want to pass

```ts
panel.open({ release: () => standTheirChairBack() });   // or `release` on the spec
```

Use it when the undo depends on **how** you opened it — a stool knows it seated
you; the same panel opened from a doorway did not. It runs on **every** close,
before `onClose`, inside a try: a release that throws must not be able to leave
the world frozen behind a closed panel, which is this same bug one layer up.

## Guarded, and I watched it fail

`scripts/K-no-panel-traps.mjs`, registered in `checks.mjs`. It walks
**`__hud.panels()` — the framework's own registry** — rather than a list I typed,
so the panel nobody remembered is exactly the one it cannot miss. Six today:
`ct-pockets`, `ct-atm`, `ct-letter`, `ct-loan`, `ct-slots`, `ct-blackjack`.

Per panel: open it, confirm the world **is** frozen, press Escape, confirm it
closed and the player can walk. With a control — walking with nothing open — so
"the player got the world back" is not free.

**Its `--selftest` swallows Escape in capture BEFORE the panel opens**, which is
the real bug's ordering, and every panel then reports the player walking
**0.00 m**. That is the user's trap, reproduced by the guard.

**And the first version of that mutation did not work.** I installed the
swallower *after* the panel was up — so the framework's gate, registered first,
still won, and the selftest sailed through reporting the check was decoration.
GOTCHAS §27: a mutation that does not actually break the thing proves nothing
and looks exactly like a check that works.

## One thing I still want, from the desk

The stand-them-up guarantee reaches for `window.__ct.stand()`, which is an entry
point **test** affordance. The right shape is **`ctx.stand()` beside
`ctx.seat()`** in `ct/ctx.ts`, which is desk-owned. Asked for in
`notes/BLOCKED-K.md`. It works today; it should not have to.

— K
