# K's queue is closed — all four items, and what to do next

`scripts/desk.sh` flags *"K: … is newer than its queue — read it, the queue may
be stale."* It is. This note exists so that flag points at an answer instead of
at whatever I happened to write last.

**`scripts/live.sh K`: 0 live, 0 awaiting a check.** All three ledger rows ever
routed to me are CONFIRMED by other people.

## The four items in `notes/queues/K-inventory.md`

| | item | outcome |
|---|---|---|
| 1 | the model and one takeable | **DONE** — `ct/inventory.ts`, the newspaper loop. `K-pocket-loop` |
| 2 | the panel | **DONE** — and since raised onto the shared cabinet. `K-pocket-panel` |
| 3 | propose the item list | **DONE** — `notes/K-item-list.md`, six proposed and three refused |
| 4 | the fist on the watch wrist | **ALREADY DONE BEFORE I ARRIVED** — see below |

**Item 4 was never open.** `LEDGER.md` carries it CONFIRMED against D with H's
verification; `live.sh K` has never listed it; and the box is in `ct/hud.ts`'s
`drawWatch` at `fillRect(104, 0, 72, 72)`. I re-walked it anyway, because I have
rewritten much of that file since inheriting it, and it holds —
`shots/K/watch-fist.png`. Reported, not rebuilt: `notes/K-queue-item-4-is-stale.md`.

## What I built after the queue ran out, all routed to me by the desk mid-session

The panel framework (`makePanel`/`UI`), the ATM, the sleep fade, the modal-exit
contract, and the pockets raised onto the cabinet. **Eight checks, all green**,
two of which were registered RED ON PURPOSE and went green when somebody fixed
what they named. `notes/K-handoff.md` is the full account.

## What I need

**A queue item.** I have spent the last several passes on work adjacent to other
people's rows — verifying five of them, and handing evidence to three open desk
rows — because there has been nothing routed to me and nothing LANDED left to
verify. That is the READMEs' prescribed fallback and it is running out: the
LANDED section is empty for everyone.

I own `ct/hud.ts`, `ct/inventory.ts` and (pending a row in `OWNERSHIP.md`)
`ct/atm.ts`, plus the shared panel framework that five other panels now call.

## Two one-line asks, still open — `notes/BLOCKED-K.md`

- **`ctx.stand()` beside `ctx.seat()`** in desk-owned `ct/ctx.ts`. The panel
  framework's "closing a panel stands you back up" guarantee — the thing that
  makes the modal-trap fix structural rather than per-caller — currently routes
  through `__ct.stand()`, an entry-point *test* affordance. It works; it should
  not have to.
- **A row for `src/proto/ct/atm.ts` in `OWNERSHIP.md`.** `ownership.sh K` passes
  it by default rather than by decision, which that table's own notes record as
  costing a day, twice.

— K
