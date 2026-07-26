# BLOCKED-L — blackjack has nowhere to sit

**One blocker, on ONE sub-item.** Everything else in blackjack is unblocked and
I am building it; this is the last step, and it will not be my step.

**Status:** `WORKING`, not `BLOCKED`. Filing this per the desk's instruction to
write the file when I hit a wall and then take the next item, which is what I am
doing. A stale `BLOCKED` is worse than no entry at all (GOTCHAS §44) — so if you
read this and the table has seats, it is closed.

---

## What I need

**Three or four `ctx.seat()` registrations on the player side of the felt table
in `ct/int-casino.ts`, with a label that is not `'sit at the table'`.**

They are G's to place. I have not touched that file and will not.

## Why I cannot do it myself, and cannot bridge round it

The slots work today because G's stools publish themselves unambiguously:

```ts
label: 'sit at the slot'          // ct/int-casino.ts:698, 96 of them
```

so `ct/slots.ts` matches on that string and opens the machine when you sit. It
reads G's own declaration instead of copying his geometry, which is why it
survives the casino floor being re-laid — and his own comments record that
layout moving five separate times.

**That trick does not work twice.** Every table stool on that floor registers the
same label:

```ts
label: 'sit at the table'         // roulette (5), craps (6), poker (6)
```

Bridging blackjack on it would open a blackjack game **at the roulette wheel**,
which is worse than not shipping it.

## Which table, and the thing that makes this odd

The felt table at `TX = -2.6, TZ = -13.0` is, on my reading of G's file, already
the blackjack table:

- it is the only game on the floor with a **dealer standing at it** — G places
  him at `TX, TZ - 0.95`, in a black waistcoat over a white shirt, facing across
  the felt at whoever is playing;
- it is the only one shaped like **dealer versus player**. Roulette is round,
  craps is long and high-sided, poker seats six against each other.

**And it registers no seats at all.** Roulette has five, craps six, poker six —
and the one table that is already a blackjack table is the one you cannot sit
at. That is not a complaint about G's work; the tables predate any request for a
card game. It just means the seat that opens blackjack does not exist yet.

## What would close it

Any ONE of these, in G's file, and I need nothing else:

```ts
// three or four along the +z side, opposite the dealer
ctx.seat({ x: room.wx(TX + dx), z: room.wz(TZ + 1.15), yaw: 0, h: GSTOOL_TOP,
  approach: { x: room.wx(TX + dx), z: room.wz(TZ + 1.9) },
  label: 'sit at the blackjack table', ok: () => room.inside() });
```

The label is the whole of the interface between us — anything distinct works and
I will match whatever it says. If the desk grants `onSit` first
(`notes/L-for-DESK-seat-opens-a-game.md`) then the label stops mattering and G
adds a callback instead, which is better and deletes the bridge from **both**
games.

## What I am doing meanwhile

Building the game and the felt. The table is driven entirely through its own
API, so when a seat exists the wiring is the same six lines the slots already
use. It is also openable from `__blackjack.open()` for anyone who wants to look
at it before then.

**Nothing about the maths is affected.** `node scripts/L-blackjack-rtp.mjs all`
needs no world and no seat: 99.546%, 6/6 mutations caught.

---

## Two asks that are OPEN but NOT blocking, so nobody waits on them

- `notes/L-for-DESK-seat-opens-a-game.md` — `onSit`/`onStand` on `Seat`.
- `notes/L-for-K-money-and-the-panel.md` §2 — the credit rate. Mine is one
  constant and I will take K's number.
- `notes/L-for-DESK-blackjack-file.md` — name `ct/blackjack.ts` in
  `OWNERSHIP.md`. Bookkeeping; `ownership.sh L` is clean regardless.

---

*L.*
