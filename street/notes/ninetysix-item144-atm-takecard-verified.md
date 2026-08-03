# Item 144 — ATM take-card: VERIFIED SATISFIED, nothing changed

Worker ninetysix. Port **4520**, built bundle. **`ct/atm.ts` is untouched** —
`git status` clean on it throughout. The row said *[VERIFY STATE — LIKELY DONE]*
and it was right.

---

## What the row asked, and how each half was proved

Three rounds of the user's words, and they pull against each other — a fix for
any one can undo another, so each is its own assertion rather than one "it
works":

| the user | proved by |
|---|---|
| *"take card from atm should immediately get us out of the menu"* | the panel closes with **no further input** |
| *"just flash thank you farewell screen and release the player"* | the farewell is **actually shown** — closing instantly would satisfy the line above and break this, which is what happened once already |
| *"theres still 2 take card options… not take card > take card"* | the machine **never routes through the `card` screen**, sampled every 20 ms rather than inferred from where it ended up |

`scripts/probes/w96-atm-takecard.mjs`, all green:

```
OK  one press of TAKE CARD goes straight to the farewell (screen=thanks)
OK  and the farewell is actually SHOWN, not skipped — the panel is still up for it
OK  it then releases the player on its own, no further input (within 2600 ms)
OK  and it resets to a fresh machine for the next player (screen=idle)
OK  the keyboard is the world's again — W did not re-open a panel
OK  it never routes through the second TAKE CARD screen (saw: menu -> thanks -> idle)
OK  after a withdrawal the machine DOES hand the card back (screen=card)
OK  and one press there also goes straight to the farewell
OK  and it releases the player on its own from that path too
OK  left alone on the MENU for 2600 ms the panel STAYS up
OK  Escape closes it from the MENU (panel=null)
OK  and leaves it reset, not stuck mid-session (screen=idle)
```

`menu -> thanks -> idle` is the whole row in one line: no `card` in between.

**The `card` screen is still right where it belongs.** After a withdrawal
(`receipt` → NO → `card`) the machine really is handing the card back and TAKE
CARD is the first time you have been asked — that path is asserted too, and it
also ends in one press.

## Two traps in my own probe, both self-caught

1. **The screen-watcher was `await`ed**, so its 2.6 s sampling window ran to
   completion *before* the key press it existed to observe. It would have
   reported a clean `menu -> menu -> menu` and called "never routes to `card`"
   proved, having watched an idle machine. Started without `await` now.
2. **"The panel closed within 2.6 s" proves nothing if the panel closes on its
   own anyway.** So there is a negative case: sit on the MENU for the same
   window and assert it **stays up**. It does. That is what makes the auto-close
   assertion mean "the TAKE CARD did it" rather than "time passed".

Escape is checked because BUILDER-BRIEF §11 — a panel you cannot close is the
worst bug this project ships — and because the guarded `endSession` exists
precisely so a farewell timer cannot fire into whatever is open a second later.

Also re-ran the registered `scripts/K-atm-walk.mjs`: **all good**, exit 0.

## One thing I found and did NOT fix — not this row

**The ATM needs two `open()` calls to come back up after a completed session.**
Reproducible, twice in the same run:

```
??   the machine needed 2 open() attempts to come back up
```

`openAtm()` (`ct/atm.ts:747`) is unconditional apart from a null check, so the
refusal is not in this file — it is almost certainly a deliberate reopen debounce
in the panel framework (`ct/hud.ts`), which would be the right thing to have:
without one, the keypress that closes a panel reopens it. **I did not
investigate, because `ct/hud.ts` is not a file this row names** (BUILDER-BRIEF
§9), and I did not paper over it with a longer sleep — the probe counts the
attempts and prints them, so it stays visible.

**Worth a row only if a player can feel it**: the question is whether pressing
`[E]` on the machine immediately after a session ends silently does nothing the
first time. My probe drives the test hook, not `[E]`, so it cannot answer that,
and I am not going to guess.
