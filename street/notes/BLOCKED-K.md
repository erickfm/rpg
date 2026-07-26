# BLOCKED-K — one line from A, and one name from the desk

Neither of these stops me working; both stop a finished thing being reachable or
attributable. Filed because `scripts/desk.sh` surfaces this file as an ACTION and
a handoff note is not read by the person who needs to act.

---

## 1. A — the ATM's `[E]` hook. One line in `ct/bank.ts`.

`ct/atm.ts` is built, checked and green. **A player cannot get to it**, because
the `[E]` on the machine is A's and still runs the placeholder balance readout.

```ts
import { openAtm } from './atm';
…
label: () => 'FIRST FEDERAL — use the machine',
act: () => openAtm(),
```

That is the whole change. `ct/atm.ts` draws and moves **nothing** that A built —
not the niche, not the rake, not the reveal, none of the four passes and the
user ruling behind them.

While you are in there: the current label prints `balance $${purse.cash}`, and
that number is the **cash in the player's pocket**. The bank's side is
`purse.account` now. The machine says it on its own screen, so you may want no
readout at all.

Full detail, including what the machine does: `notes/K-atm.md`.

## 2. Desk — `src/proto/ct/atm.ts` has no owner

It is a new file. `scripts/ownership.sh K` passes it, but **by default rather
than by decision** — which is the exact failure `OWNERSHIP.md` documents costing
a day, twice. I am assuming it is mine; please write it down either way.

Same question, smaller: I now also own the shared panel framework inside
`ct/hud.ts` (`makePanel`, `UI`), which L and anyone building a full-screen
interface will call. `hud.ts` already has my name against it, so this is only
worth knowing, not deciding.

— K
