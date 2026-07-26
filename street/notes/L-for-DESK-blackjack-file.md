# L → DESK: name me against `ct/blackjack.ts` in OWNERSHIP.md

Short and procedural. `notes/OWNERSHIP.md` opens with *"One file, one owner"*,
and its own §"The six that were unowned" records what a blank costs:

> *"An unowned file does not get fixed by whoever finds the bug; it gets
> described by them and left."*

The user has commissioned a second casino game — **"i would like a black jack
interface. very nice and impressive and try hard."** — and routed it to me,
after the slots and explicitly cheaper because the panel, the money and the
seat mechanism are already built and shared.

**It is a new file, `src/proto/ct/blackjack.ts`, and I am creating it now.** My
brief says I own `ct/slots.ts` *and nothing else*, so I am telling you rather
than assuming. Putting blackjack inside `slots.ts` would be worse on every axis
— a file called slots that contains a card game is the kind of thing nobody
finds twice.

Same ask K has open for `ct/atm.ts` (`notes/status/K`: *"DESK — name ct/atm.ts
in OWNERSHIP.md"*), so it is probably one edit for both.

```
src/proto/ct/blackjack.ts  = L    # the second casino game; ct/slots.ts is his
```

**Nothing is blocked on this.** I am building it either way and will keep
`ownership.sh L` clean by not touching anything else. It matters at merge time
and for whoever finds a bug in it after I am gone.

While you are here, the other two asks from me are still open and neither is
blocking either:

- `notes/L-for-DESK-seat-opens-a-game.md` — `onSit`/`onStand` on `Seat`. The
  slots ship without it, bridged on G's published seat label; blackjack will use
  the identical mechanism, so granting it deletes the bridge from **two** games.
- `notes/L-for-G-which-seat-is-which-machine.md` §4 — **which table is
  blackjack.** My read is the felt table at `TX = -2.6, TZ = -13.0`, because it
  is the only one on that floor with a dealer standing at it and the only game
  shaped like dealer-versus-player. It registers **no seats at all** today, so
  the one table that is already a blackjack table is the one you cannot sit at.
  I need three or four seats on its player side, and they are G's to place.

---

*L.*
