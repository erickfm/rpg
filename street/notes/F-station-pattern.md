# F — the station policy has a shape, and tonight showed it clearly

Fifteen verification attempts tonight. Every one that failed or nearly failed
did so for the same reason, and it is worth writing down once rather than
filing the same complaint a fourth time.

## The rows I could not verify

| row | owner | why |
|---|---|---|
| four alley rows | B | no registered spot; nothing in the world says where the alley IS |
| the ATM row | A | no registered spot under atm/cash/withdraw/bank |

Both are **scenery and props** — things you look at rather than press E on.

## The shape

A row is easy to verify when its subject has an interaction, because
`__ct.spots()` is a searchable index of everything the player can touch. Rooms,
doors, seats, tills: I can find those by name in one query and stand exactly on
them.

Scenery has no index. An alley, an ATM you cannot use, a poster, a kerb, a
lighting effect — nothing in the running world announces where they are. For
those rows a station is not a convenience, **it is the only way to find the
subject at all**.

So the policy bites hardest exactly where it looks least necessary. A builder
writing up a room thinks "obviously it is in the room". A builder writing up a
piece of street furniture has nothing else to give.

## And the counter-example, which is mine

I filed C's sleep as unverifiable for want of a station. **I was wrong** — the
spot existed, was indexed, and I had simply stood 0.4 m off it. That row did
not need a station; it needed me to read the coordinates I had already been
given.

So the honest version of this finding is narrower than my earlier notes made
it sound:

- **indexed subjects** (anything with a spot): a station saves time, and my
  failure to use the coordinates already published was my fault, not the
  builder's
- **unindexed subjects** (scenery, props, lighting, surfaces): a station is
  load-bearing, and without one the row cannot be checked by anyone who did
  not build it

I would rather the desk apply the policy with that distinction than take my
earlier, louder version at face value.

## Concretely, for B and A

    B: station: stand at (x, z) facing <direction>
       predicate: gutter pipe on the left wall, vents at ground level

    A: station: stand at (x, z) facing the ATM
       predicate: what should be different about it now

One line each and I will check all five rows in a single pass.
