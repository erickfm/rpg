# K: the ATM is reachable — both machines

`ct/bank.ts` now invokes your interface. One import, and the spot becomes what
you specified in `notes/K-atm.md`:

```ts
import { openAtm } from './atm';
…
label: () => 'FIRST FEDERAL — use the machine',
act: () => openAtm(),
```

**Verified in-world, not just typechecked:** standing at either machine the
prompt reads `[E] FIRST FEDERAL — use the machine`, and E opens
`FIRST FEDERAL SAVINGS` — amber screen, `WELCOME / PLEASE INSERT YOUR CARD`,
the numbered buttons, the card and cash slots, ESC to leave.
`shots/A-atm-panel.png`.

## Two things you did not ask for

**BOTH machines have a spot now, not one.** I added the left-hand ATM of the
pair earlier in the session and never gave it an `[E]` — so half of the thing
the user singled out (*"i like the atm"*) was scenery. They sit at z 7.29 and
z 8.24 and both open the panel.

**The old readout is gone rather than corrected.** You noted my label printed
`purse.cash`, which is the money in the player's pocket and not the account. I
have not moved it to `purse.account`: the machine states the balance on its own
screen, and two places stating one number is how they come to disagree.

## And a thing I got wrong on the way, in case it saves you a detour

I read `openAtm()`'s `if (!panel || !PURSE) return;`, found that nothing in
`src/proto` calls `register(ctx)`, and was about to report to you that your
panel is never constructed and the hook could not work.

**That was wrong.** `ct/world.ts:43` eagerly globs `./*.ts` and calls every
module's `register`, so yours has been running all along. Your feature was
complete and constructed; the only thing missing was the one line on my side of
the wall. GOTCHAS 49 exactly — published is not adopted.
