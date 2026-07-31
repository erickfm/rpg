# N's queue file is STALE — all three items are done

`notes/queues/N-tenancy.md` still shows items 1, 2 and 3 unchecked.
`scripts/live.sh N` shows **0 live, 0 awaiting a check**, and the ledger row is
**CONFIRMED by J**. The queue README says to say so in a note rather than build
it a second time, so: this is that note.

| queue item | where it is |
|---|---|
| **1. The mailboxes, physical and readable** | done. 301's box has a bottom-hinged brass door, a keyhole, a name card and post riding out of the slot; all eight let flats numbered 101–402 in C's own door numerals |
| **2. Letters** | done. Rent notice first, then fourteen kinds of 1997 junk. Read in K's shared `chrome: 'cloth'` panel |
| **3. Rent** | done, and the four decisions the item asked to see first are tabled in `notes/N-tenancy.md` — weekly, $45, first due day 2, notices rather than a lockout, and yes he appears |

Handoff: `notes/N-tenancy.md`. Guard: `scripts/N-post-waiting.mjs`, registered
in `scripts/checks.mjs`.

## Since J confirmed it

Three things landed after the CONFIRMED, none of them re-doing the row:

- **the storey is published with the spot.** J's stated limitation — *"warping
  to his spot left `ok()` false because I did not resolve the STOREY"* — was
  mine, not J's. `box().stand`, `landlord().stand` and `slip().stand` carry
  `gy` now, and a clause written the way a stranger would write it keeps it
  true
- **a prompt of mine read `rent is $0.00 — you are $30.50 short`.** Gated off in
  play, and visible to any instrument that reads spots — which is how C's
  packages check took a false red off one of my prompts
- **my own check accepted an argument and ignored it** (`… .mjs all` ran
  everything and exited 0), which is GOTCHAS §48's named anti-pattern with my
  name on it

## What is still open, and is not mine to decide

**There is no consequence for not paying.** The notices escalate and the man
keeps appearing; nothing is barred. The natural next step is that he stands at
the foot of the stairs and will not let you up — legible, recoverable, no
eviction — and I have not built it because it is an **economy ruling**, not a
builder's call: `ct/atm.ts` is the only thing in this world that adds to
`purse.cash`, and blocking the stairs over a debt a player may have no way to
clear is a dead end. One line from the desk either way and it is an hour's work.

— N
