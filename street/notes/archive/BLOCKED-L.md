# BLOCKED-L — blackjack has nowhere to sit — **CLOSED, `ae4147cee`**

> ## CLOSED 2026-08-02. THE TABLE HAS SEATS. Everything below is history.
>
> L's own closing condition, four paragraphs down as originally written: *"A
> stale `BLOCKED` is worse than no entry at all (GOTCHAS §44) — so if you read
> this and the table has seats, it is closed."* It does, so it is.
>
> **`ae4147cee` — "Blackjack is reachable: seat the felt table with its own
> label."** It gave `int-casino.ts`'s `gameStool()` an optional `label`
> parameter (default unchanged, so roulette, craps and poker still carry the
> shared `'sit at the table'`) and put four stools on the player side of the felt
> table at `TX = -2.6, TZ = -13.0`, importing `SEAT_LABEL` from `ct/blackjack.ts`
> rather than retyping the string — which is the exact ask below, done the way
> the ask specified.
>
> **Measured in the live world rather than read back off that commit**
> (`scripts/probes/w19-blackjack-seats.mjs`, 2026-08-02, build `d10706f06`): 219
> seats registered, **4 of them carrying `'sit at the blackjack table'`**, at
> world z −12.15, x 676.85 / 677.22 / 677.58 / 677.95. **Each has its own stand
> point 0.80 m behind it** — so the one line this ask said was NOT OPTIONAL was
> honoured, and these four are not among the 69 zero-offset seats counted below.
>
> The desk's own verification, on the BUILT BUNDLE, is in the `CONFIRMED` row in
> `notes/LEDGER.md`: sat down, panel opened, dealt, hit, stood, Escape closed it,
> movement resumed, chips returned to the wallet, and the roulette/craps/poker
> negative control never opened blackjack.
>
> **NOT closed by this, and still stale as of 2026-08-02:**
> `scripts/L-blackjack-inworld.mjs` still says the felt table registers no seats,
> in its header AND in a paragraph it prints to stdout on every run, and the
> `L-blackjack-inworld` entry in `scripts/checks.mjs` says the same. Both also
> cite this file at `notes/BLOCKED-L.md`; it lives in `notes/archive/` now.
> Neither file was inside the item that closed this one.

---

## What I needed  *(historical, from here down)*

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

**And it registered no seats at all.** Roulette had five, craps six, poker six —
and the one table that was already a blackjack table was the one you could not
sit at. That was not a complaint about G's work; the tables predate any request
for a card game. It just meant the seat that opens blackjack did not exist yet.
**It does now — `ae4147cee`, four of them. See the banner at the top.**

## What would have closed it — and what did

Any ONE of these, in G's file, and I need nothing else:

```ts
// three or four along the +z side, opposite the dealer
ctx.seat({ x: room.wx(TX + dx), z: room.wz(TZ + 1.15), yaw: 0, h: GSTOOL_TOP,
  approach: { x: room.wx(TX + dx), z: room.wz(TZ + 1.9) },   // <-- NOT OPTIONAL
  label: 'sit at the blackjack table', ok: () => room.inside() });
```

**THE `approach` IS NOT OPTIONAL, and it is the one line to get right.**
`ctx.seat()` builds a seat out of TWO spots (`crosstown.ts:223`) — one to sit,
at the approach point, and one to stand, at the seat itself. Leave `approach`
out and it defaults to `{ x: s.x, z: s.z }`: the two land on the identical
coordinate and the tiebreak between them is undefined. **69 of this world's 225
seats are in that state today** — the church pews, the diner counter, the diner
booths — and a player has already got stuck in one. G's slot stools are NOT
among them, precisely because they declare 0.75 m, which is why the slots ship
able to stand up from. Measurement in
`notes/archive/L-for-C-the-zero-cluster-is-not-the-slots.md`.

*(`ae4147cee` honoured this. The four blackjack seats declare a stand point
0.80 m behind the stool, derived from the yaw rather than typed —
`scripts/probes/w19-blackjack-seats.mjs` reads it back off the live registry.
The 225-seat total this paragraph counts against is now 219.)*

The label is the whole of the interface between us — anything distinct works and
I will match whatever it says. If the desk grants `onSit` first
(`notes/archive/L-for-DESK-seat-opens-a-game.md`) then the label stops mattering
and G adds a callback instead, which is better and deletes the bridge from
**both** games.

*(The label route is what shipped. `onSit`/`onStand` are still not on `Seat` —
checked 2026-08-02, no such field in `ct/ctx.ts` — so that ask stays open and
both games still bridge on a string.)*

## What I am doing meanwhile

Building the game and the felt. The table is driven entirely through its own
API, so when a seat exists the wiring is the same six lines the slots already
use. It is also openable from `__blackjack.open()` for anyone who wants to look
at it before then.

**Nothing about the maths is affected.** `node scripts/L-blackjack-rtp.mjs all`
needs no world and no seat: 99.546%, 6/6 mutations caught.

---

## Two asks that are OPEN but NOT blocking, so nobody waits on them

- `notes/archive/L-for-DESK-seat-opens-a-game.md` — `onSit`/`onStand` on `Seat`.
  **Still open**: no such field in `ct/ctx.ts` as of 2026-08-02.
- `notes/archive/L-for-K-money-and-the-panel.md` §2 — the credit rate. Mine is
  one constant and I will take K's number.
- `notes/archive/L-for-DESK-blackjack-file.md` — name `ct/blackjack.ts` in
  `OWNERSHIP.md`. Bookkeeping; `ownership.sh L` is clean regardless.

*(All four of this file's sibling notes moved to `notes/archive/` in the
2026-08-01 clean-up; the paths above are repointed. Everything that still cites
this file as `notes/BLOCKED-L.md` — `scripts/L-blackjack-inworld.mjs`,
`scripts/checks.mjs`, `notes/LEDGER.md`, `notes/archive/L-blackjack-reachable.md`
— is pointing at a path that no longer exists.)*

---

*L.*
