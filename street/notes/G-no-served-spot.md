# Four of my rooms have a staffed counter and nothing you can do at it

**For the desk. This is a product question, not a bug, which is why I have not
just built it.**

`scripts/interiors-walk.mjs` came back to life once the `jail` room was
registered, and it flags four of my five rooms:

```
FAIL  casino: the customer station comes from the world, not from memory
FAIL  hotel:  the customer station comes from the world, not from memory
FAIL  pawn:   the customer station comes from the world, not from memory
FAIL  tax:    the customer station comes from the world, not from memory
      no served-spot published in this room — falling back to the AUTHORED pair,
      which cannot falsify a keeper authored in the same file
```

The check's reasoning is right and worth quoting, because it is the same trap I
have fallen into twice this session: *"A station I authored, checked against a
keeper I authored, in a room I authored, agrees with itself whatever the player
sees. That is not a test, it is a mirror."*

## What the measurement actually shows, which is worse than the check says

Every `[E]` spot each interior publishes:

| room | spots | has a spot where a customer is served |
|---|---|---|
| bodega | 3 | yes — `buy cereal — $2.50` |
| burger | 31 | yes — `order a barn burger — $1.89` |
| diner | 14 | yes — `sit at the counter` |
| thrift | 2 | yes — `buy a coat at the till — $4.00` |
| **hotel** | **1** | **no — the only spot is `out to the street`** |
| **pawn** | **1** | **no — the only spot is `out to the street`** |
| tax | 4 | no — three waiting chairs and the exit |
| casino | 122 | no — 96 slot stools, 17 table stools, 8 lounge seats, the exit |
| church | 29 | no — 28 pews and the exit |
| library | 11 | no |
| jail | 1 | no |
| bank | 9 | no |

**The hotel and the pawn shop publish exactly one spot each: the way out.** Both
have a staffed counter — the hotel a mahogany reception desk with a clerk behind
it, a key rack and a rate card; the pawn shop a full-width counter with the broker
behind it and a locked cabinet of priced stock. **You cannot do anything at
either.** You walk in, look, and leave.

That is not what the check is complaining about, but it is what I found while
answering it, and it is the more interesting fault.

## Why I have not built it

Four rooms in this world DO have a counter you can use, and they all use the same
published mechanism — `ctx.spot({ label, act })` against `ctx.purse.cash`,
`ctx.purse.inv` and `ctx.refreshWallet()`. Adding a purchase to my four would be
consistent with the world and would clear the check.

But **the user has not asked for it in these rooms**, and the desk's rule is
explicit: *"a user request outranks any tooling, verification or refactor work,
always. If your queue's top item is not something the user asked for in their own
words, skip to one that is."* Inventing an economy for a casino cage, a hotel
front desk, a pawn broker and a tax preparer is product design, and picking the
prices is a decision I should not make quietly in four files at once.

There is also no lightweight way to make a non-purchase interaction *say*
anything: the ATM's "check balance" is a bespoke full-screen module
(`ct/atm.ts`), not an affordance a room can borrow. So the honest options are a
real purchase or nothing, and I am not choosing between them alone.

**What I would build, given the word.** One interaction per room, in the room's
own voice, at the counter that already exists:

- **pawn** — the broker gives you a lowball offer. The room is already full of
  handwritten price tags; this is the one interaction it is obviously missing.
- **hotel** — a room for the night, priced off the rate card already on the wall.
- **casino** — change a bill at the cage, which is drawn and standing empty at the
  back wall.
- **tax** — have your return done, which also gives the client chair a purpose.

Tell me which, if any, and I will do them in one pass.

## A note on the check itself

The pass/fail is currently *"did the room publish a station"*, so a room with a
counter nobody can use fails, and so does a church, a library and a jail, which
have no counter at all and never should. `keeper: null` is already the convention
for an unstaffed room (see the `jail` entry). A room with a keeper and no served
spot is a different thing from a room with neither, and only the first is a gap.

## Update, 2026-07-26 — the re-run after re-syncing the harness

`interiors-walk` went 303/312 -> 305/313. **The two keeper failures are gone**:
correcting the stale `keeper` pairs for the hotel and the casino cleared
*"the keeper is looking at you, not away"* in both. The church landing flake did
not recur.

**Four `no served-spot published` failures remain, and they are this note.**

**One new failure appeared and it does NOT reproduce:** *"hotel: walked OUT of the
room going -z"*, reported as ending at world x **-721.4** for a room whose centre
is 920. I swept containment myself — **6 spread points x 4 directions in each of my
five rooms, 120 runs, 0 escapes** — and walking -z from the reported start stops
dead at z -12.60 against a back wall at -13, then does not move for six further
holds. A plausible mechanism for whoever owns that check: `cx` is a module-scope
`let` assigned per room on entry (`cx = 400 + Math.floor((inside[0] - 400) / 80)
* 80 + 40`), so a room whose entry misfires inherits the PREVIOUS room's centre and
every containment comparison after it is meaningless. Worth a `cx = null` reset
between rooms so it fails loudly instead of quietly.

Note also that slab centres MOVE when a room is added — my hotel was cx 840 earlier
tonight and is 920 now, because the jail took a slab. Anything that hardcodes a
slab centre is stale the moment somebody adds a room; deriving it, as both this
harness and `G-rooms-walk` do, is what saves it.
