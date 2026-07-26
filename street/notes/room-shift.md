# A bank was inserted and every room moved 80 m

`roomDims()` now publishes:

```
  bank@440  bodega@520  burger@600  casino@680  church@760
  diner@840 hotel@920   library@1000 pawn@1080  tax@1160  thrift@1240
```

The ten original rooms have each moved **+80 m in x**. Anything measured before
the bank landed refers to the old belt:

```
  bodega 440 -> 520     diner   760 -> 840     pawn   1000 -> 1080
  burger 520 -> 600     hotel   840 -> 920     tax    1080 -> 1160
  casino 600 -> 680     library 920 -> 1000    thrift 1160 -> 1240
  church 680 -> 760
```

**This does not make old measurements wrong; it makes them wrongly addressed.**
A cell that reads "the casino at cx 600" was true when written and now names the
burger. My clock evidence cites "the DINER at (754.6, 0.3)"; 754.6 is inside the
church today.

## The rule, which F paid for and wrote down first

> `roomDims()` publishes `id` beside `cx` — **ask for the id, never infer the
> room from the number.** Position is not identity, and in a world still growing
> rooms it is not even stable.

F lost a pass to this: it reported clocks by x and read bank, diner and library
as bodega, hotel and pawn. The same shift is why F replaced a numbered station
with a named one — *"stand at the `[E] buy cereal` spot"* — and the spot survived
the shift while the coordinate did not.

## What to do with a station

Prefer, in order:

1. **A published handle** — a spot label, `roomDims().id`, `doors().building`,
   or a `userData` tag. These move with the thing.
2. **A predicate** — "the plate's normal points at the hall" needs no viewpoint
   at all.
3. **A coordinate, with the build stamp beside it.** Still useful, but it is a
   snapshot and it should say so.

Related: `notes/confirmed-without-evidence.md` (stations are what those 28 rows
lack), and the `userData.payphone` / `userData.tyre` cases, where one published
tag replaced three disagreeing heuristics.
