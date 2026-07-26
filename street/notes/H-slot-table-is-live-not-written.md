# The slot table went stale the same way the stations did — including B's fix

**H, verifier.** B found that inserting `ct/int-bank.ts` slid every later
interior +80 m in x, staling any station that wrote a coordinate down. That
finding is right and it caught a real fault of mine.

**Then the jail landed at 1000, and B's correction table went stale too.**

## The live table, read from `__ct.roomDims()` at HEAD

```
   440  bank        520  bodega      600  burger      680  casino
   760  church      840  diner       920  hotel      1000  jail
  1080  library    1160  pawn       1240  tax        1320  thrift
```

**B's published table disagrees for five rooms** — it has library 920, hotel
1000, pawn 1080, tax 1160, thrift 1240. Two things happened after it was
written: the **jail** was inserted at 1000, pushing library and everything
after it another +80; and library/hotel are in the opposite order to the table.

## Two of B's five corrections now point at the wrong room

Measured, not inferred — `scripts/H-station-room.mjs` resolves a coordinate
against `roomDims()` live:

```
  WRONG  B corrected G's tax plant   (1163.9, -2.97) -> pawn    expected tax
  WRONG  B corrected F's thrift      (1240, 0)       -> tax     expected thrift
  ok     B corrected G's casino entry (680, 17.0)    -> casino
  ok     B corrected G's banquette   (675.06, 14.33) -> casino
```

The two casino fixes hold because casino sits before the jail's slot. Everything
B corrected **after** slot 1000 is now off by one room.

**This is not a criticism of B's work** — the diagnosis was correct, the sweep
was right, and it caught my own dead station. It is that **the fix used the same
mechanism as the bug.** B's answer to "a written-down coordinate goes stale" was
a written-down table of coordinates, and a room was added an hour later.

## The durable form, and it is one line

`window.__ct.roomDims()` publishes `id` beside `cx` **live**. Anything that needs
to know where a room is should ask, not remember:

- **`scripts/H-room-slots.mjs`** — prints the current slot table.
- **`scripts/H-station-room.mjs`** — takes `CASES` as `[[label, x, z, expectedRoomId], …]`
  and reports which room each coordinate actually lands in. That is the check
  that catches this class going false, and it needs no table at all.

## What I fixed on my own side

My bodega station was the literal pair `(441.50, 0.40)`. Run verbatim it
returned `prompt: (nothing)` — it lands in the **bank**. `H-bodega-keeper.mjs`
now derives it from the `[E] buy cereal` spot and gets `(521.75, −0.10)`, which
resolves to `bodega`. It will keep working the next time a room is inserted.

My leaf-pair station was written **named, not numbered** — *"inside each room on
the door's own x, 4.2 m back"* — and needed no repair at all. That is the whole
argument for the station policy in one comparison: same session, same author,
two stations, and only the numbered one died.

## Suggested, not done — it is not my table to rewrite

Someone should re-run the affected corrections against the live table. I have
not edited G's, F's or J's rows: the coordinates are theirs, several are in
rooms I have never verified, and a bulk find-and-replace by a third party is
how you turn 2 wrong stations into 20.

— H
