# Queue — builder L  ·  worktree `../rpg-slots`  ·  port 4193

**Owns:** `ct/slots.ts` — the slot machine game, end to end.
**Desk writes this file. Do not edit it.**

You exist for one request, and he asked for effort:

> *"add a slots interface and game where when i sit down i enter the slots
> interface and i can play slots. fully make a slots game that works well and
> pays out and everything. high effort here."*

Rebase on `add-stick-and-city98` before each item. Commit each item alone.
Keep `notes/status/L` current — one line, `STATE | what I am on | waiting on`.

## Read first

- `street/START-HERE.md`, then `notes/GOTCHAS.md`.
- **`ct/int-casino.ts` is G's.** The machines, the stools and the `ctx.seat()`
  registrations are already built and confirmed — the user has sat on them.
  **Read it, never edit it.** You need one thing from G: which seat is which
  machine. Ask through a note.
- **`ct/hud.ts` and `ct/inventory.ts` are K's.** K has landed a pockets model
  that the wallet is a view onto, and a panel. **The player's money lives
  there — do not invent a second wallet.** Ask K for the take/give call.
- The world is unlit `MeshBasicMaterial`, pixel textures at ~8–32 px/m, and
  everything is hand-drawn to a period. **It is 1997.**

## What "works well" means here

This is a **three-reel mechanical-style machine**, not a modern video slot. No
megaways, no cascading, no bonus wheel. Cherries, bars, sevens. It should feel
like a machine with physical reels behind glass.

**The maths has to be real.** Build a paytable and a reel strip, then COMPUTE
the return to player from them — do not guess it. Aim for roughly **90–95% RTP**:
the player should be able to sit and play for a while, win sometimes, and drift
down slowly. A machine that takes everything in ten spins is not fun, and one
that prints money makes the wallet meaningless. **Put the computed RTP in your
report.** Simulate a hundred thousand spins and show the distribution.

**The feel is most of the job:**
- reels that **spin and stop one at a time, left to right** — the stagger is
  what creates tension, and stopping them together kills it
- **near misses that are honest** — a seven landing on the payline of reel 3
  after two sevens should be a real outcome of the strip, not a rigged tease
- credits going in, the spin, the reels, the line check, the payout counting up
- the machine's own state visible: credits, bet, last win

**The interface is a full-screen panel, and it is 1997.** Chunky bezel, the
glass, the paytable printed on it, a lever or a SPIN button. It should look like
the machine you were just sitting in front of, seen from the stool.

## Now, in this order

- [ ] **1. The maths, alone, with no interface.** Reel strips, paytable, an RTP
      simulation you can run. Commit it with the computed number. If the number
      is wrong the rest is wasted.

- [ ] **2. Sit down and enter it.** He said *"when i sit down i enter the slots
      interface"* — so taking the seat is what opens it, not a separate prompt.
      G's stools already register with `ctx.seat()`; the seat must know which
      machine it belongs to. **Ask G, do not guess.**

      Getting up must leave cleanly, and the player must not be able to move or
      interact with the world while the panel is up.

- [ ] **3. Play it.** Spin, reels, payline, payout. Money in and out through
      **K's pockets**, so what you win is in your wallet when you stand up. If
      the player is broke, say so on the machine rather than failing silently.

- [ ] **4. Then make it feel good.** The stagger, the near miss, the payout
      count-up, the idle attract state. This is where the "high effort" is.

## How it gets confirmed

Rows you move to LANDED name **where to stand, or what predicate settles it** —
policy, and it was paid for. And **grade it yourself, skeptically, before you
report**: he asked for that by name — *"take screenshots yourself and grade it
and make sure you are impressed with it. be skeptical."*

**Play it for twenty spins yourself.** If you are not enjoying it, it is not done.
