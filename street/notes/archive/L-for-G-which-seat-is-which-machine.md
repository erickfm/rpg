# L → G: which seat belongs to which machine, and which seats are the blackjack table

I am builder L. I own `src/proto/ct/slots.ts` and nothing else. I am building
the playable slot machine, and after it a playable blackjack table. Both live in
YOUR room and I will not touch `ct/int-casino.ts` — this note is the ask.

I have read `int-casino.ts` end to end. Everything below is quoted from it, so
if I have misread it the correction is cheap.

**Status:** the maths is landed (`ccc94df56`, RTP 92.834%, enumerated). Nothing
in this note blocks that. It blocks the wiring, which is the item after next.

---

## 1. The mechanism, and why the seat is the whole of it

The user: *"when i sit down i enter the slots interface."* So the seat IS the
trigger — not a second `[E]` once seated. That makes your stool registrations
the entry point to my game, which is why I am asking rather than guessing.

You register a seat per machine, `int-casino.ts:695`:

```ts
ctx.seat({
  x: room.wx(sx2), z: room.wz(sz2), yaw: face > 0 ? Math.PI : 0, h: STOOL_TOP,
  approach: { x: room.wx(sx2), z: room.wz(sz2 + face * 0.75) },
  label: 'sit at the slot', ok: () => room.inside(),
});
```

with `sx2 = x0 + i * SLOT_PITCH` and `sz2 = bz + face * 1.02`, and the cabinet
itself at `bz + face * 0.35`. So the stool is 0.67 m in front of the machine it
faces, on the same x. That reads unambiguously and I could derive every machine
from it.

**I would rather not derive it, and here is the specific reason.** GOTCHAS §33's
last section is a bench whose facing was derived correctly from what it faces
and was still backwards, because this world has two yaw conventions that differ
by a z-flip and `ctx.seat`'s yaw is the CAMERA one. Your `face > 0 ? Math.PI : 0`
is doing exactly that translation. If I re-derive "which machine is this stool
in front of" from `face` in my own file, I have re-authored your mapping, and the
two copies drift the first time anything about the bank layout moves — which it
has moved five times already by the comments in your own file (nine to a row,
then six; seven rows, then five, then three, then five, then four).

**So the ask is that the machine's identity comes from your file, once.**

## 2. What I actually need, in order of how little it costs you

**(a) Cheapest, and my preference.** Add one field to the seat you already
register — nothing else changes:

```ts
ctx.seat({ ...as now..., game: 'slot' });
```

I do not need to know WHICH machine. Every reel machine on your floor is the
same machine, and the game does not care which cabinet you are at — it cares
that you are at one. A single string on 96 seats is the whole of it.

I have asked the desk for `game?: string` on `Seat` in `ct/ctx.ts` (see
`notes/L-for-DESK-seat-opens-a-game.md`); it is not yours to grant and it is not
yours to add. If the desk says no, (b).

**(b) If you would rather not touch the seat call.** Publish the machine
positions the way `ct/lot.ts` publishes `LOT.bounds` — GOTCHAS §22's own advice,
*"if your module can publish its own footprint, do that instead of writing
coordinates into a document"*:

```ts
export const CASINO_SLOTS: { x: number; z: number }[] = [];   // world coords, the STOOL
```

pushed from inside the loop you already have. I read it, I match a seat to it,
and no number is authored twice. Same for the tables in §4 below.

**(c) What I will do if neither happens, and why I would rather not.** Match
the player's position against a list of stool coordinates I compute in my own
file from `AVENUE`, `SLOT_PITCH`, `SLOT_N` and `BANK_Z`. That is five of your
constants copied into my file. It works today and it is `AUDIT-hash-recovery`
bait: the first time you change `BANK_Z` my machines detach from your cabinets
and nothing goes red, because a slot machine that opens over empty carpet still
opens.

## 3. One thing I need to know either way

**Is `room.wx/wz` stable, or does the room's origin move when the floor is
re-laid?** If I hold world coordinates and you re-centre the room, my machines
are in the road. If it can move, I want (a) or (b) and not (c) at all.

## 4. Blackjack — the second game, and the same question about the tables

The user, in his own words: *"i would like a black jack interface. very nice and
impressive and try hard."* Ranked after slots, deliberately: the second game
should be cheap, and it is only cheap if the seat mechanism, the panel and the
money are shared rather than rebuilt.

Your floor has, by my reading:

| | where | seats | |
|---|---|---|---|
| the felt table | `TX = -2.6, TZ = -13.0` | **none registered** | has a DEALER already |
| the second table | `T2X = 2.6, T2Z = -13.0` | **none registered** | no dealer |
| roulette | `RX = -3.1, RZ = 0.2` | 5, `'sit at the table'` | |
| craps | `CX2 = 3.0, CZ2 = 0.2` | 6, `'sit at the table'` | |
| poker | `PX2 = -3.0, PZ2 = -3.6` | 6, `'sit at the table'` | |

**Which one is blackjack?** My read is that it should be the felt table at
`TX, TZ`, because it is the one with a dealer standing at it — you place him at
`TX, TZ - 0.95` facing across the felt, uniformed, and a blackjack table is
exactly "one dealer, players opposite". Everything else on the floor has the
wrong shape: roulette is round, craps is long and high-sided, poker seats six
against each other rather than against a house hand.

But that table **registers no seats at all**, so today you cannot sit at the one
game that is a dealer and a player. If you agree it is blackjack, it needs
three or four seats along its player side — the +z side, opposite the dealer —
and the same `game:` field or roster entry.

I am not asking you to build them yet. I am asking **which table**, so that when
I get to blackjack I am not the one deciding where in your room it lives.

## 5. What I am NOT asking for

Not asking you to change any geometry, any collider, any stool height, or the
`ok: () => room.inside()` gate. Not asking for a machine per cabinet. Not
asking about the video poker run — six screens against the east wall is a
different game and I am not building it.

And a note on the pit rail: it opens on the avenue centreline
(`Math.abs(mid) < 1.5`), so a player can reach both tables at `z = -13.0`.
I walked that in my head off your source; if it is wrong, say, because it is the
approach corridor for blackjack.

---

*L. Ask through notes, land my own file — I have not edited yours and will not.*
