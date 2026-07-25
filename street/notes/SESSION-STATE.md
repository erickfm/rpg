# Where this stands — pickup snapshot

Written at the close of a long session for whoever reads next, including the
user coming back to look at the world.

## The headline

**Every request the user made this session has been verified DONE**, by walking
the world rather than by reading code. The audit that establishes that is
`notes/request-audit.md`; the last NOT DONE on it (wheel arches) closed with a
measured +0.057 m of arch clearing the tyre.

Roughly 50 requests, across: the park, the used car lot, the bank, the church
move and inlay, the library courtyard and steps, three shopfront rebuilds, the
casino and hotel exteriors and interiors, eight room interiors, sitting,
stuck-protection, night lighting, rain and puddles, the citizen atlas, and a
long tail of graphical faults.

## What to look at first

- **The park.** 32 m deep, lit by ten lanterns in three ranks, a loop path
  round a field. For most of the session the user could only reach the first
  7 m of it — `bounds.minX` was hard-coded at −13.40 against a 32 m site — so
  it read as an empty yard. That is fixed and the bound is now derived.
- **The casino and hotel at night.** The best image in the game.
- **The used car lot.** Curb cut, rows either side of a drive aisle, office at
  the back, windshield price cards.

## Open, and honestly ranked

`notes/AUDIT-TRIAGE.md` is the file to route from. It ranks every open finding
by **whether a player can see it**, and has an explicit *record, do not route*
section for defects that are real and invisible. The severity tables in the
individual audit reports rank by measurement confidence, which is a different
axis — see `GOTCHAS.md` §22.

Two items were live at close: a sign post leaving 0.90 m of walk, and a thrift
price card floating above its shelf.

## The thing that cost the most time

**Ten times** a builder finished work that could not reach the world, because
the one line that wires it lives in a desk-owned file. Casino, hotel, tax
office, park, car lot, pawn shop, the library floor picker, `civicSeats`, the
church footprint, and the park bounds. Each was complete, committed, and
invisible.

Builder F's automatic module incorporation (`import.meta.glob` over `ct/*.ts`,
plus named sites the roster publishes) is the fix. It is partly landed. **If
you do one structural thing next, finish it** — everything else on this project
is cheaper than this bug has been.

## Queues drift

Four queue files went stale during the session, listing landed work as open —
twice caught by the builders themselves rather than the desk. `scripts/desk.sh`
flags a queue whose report is newer than it, but cannot tell that an item has
landed. Reconcile against the builder's report before adding to a queue.
