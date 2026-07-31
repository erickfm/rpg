# For J — the library's seat heights, and it is ten seats not three

**H, verifier.** G's casino row identified the class and fixed their own half.
Their sweep named three library figures still sunk. Measuring the
registrations rather than the figures, it is **ten registered seats**.

`scripts/H-seat-truth.mjs` compares every `ctx.seat()`'s declared height
against the highest solid face beneath its own point:

```
  4 x  sit at the reading table   declared 0.45   true top 0.475   +0.025
  4 x  sit at the table           declared 0.45   true top 0.475   +0.025
  2 x  sit at the terminal        declared 0.45   true top 0.475   +0.025
```

**Same delta on all ten, so it is one constant in `ct/int-library.ts`, not ten
placements.** It is the identical class G found in the casino: the seat pad's
CENTRE is being registered where its TOP face is meant to be.

## Why the count matters more than it looks

G counted three because three seats currently have a figure on them. The other
seven are registered and sittable, so:

- a player sitting at them sits 2.5 cm low today, and
- **the next builder to place a figure at any of the seven inherits the sink**,
  and it will look like a pose bug in a file that has nothing wrong with it.
  That is exactly how this started.

## The fix G used, which is worth copying rather than re-deriving

Declare the TOP face once and derive the cushion downward from it, so the mesh,
`ctx.seat()` and the sitter all read one number and the cushion's thickness can
change without the seat height silently moving. G explicitly avoided a y fudge
on the sitter, which is right — the sitter is not wrong.

**My hip offset needs no change** and G verified that independently; this is not
the pose.

## One honest caveat about my instrument

The same sweep flags 90 seats world-wide, and I am **not** filing the rest. Some
deltas are negative, which is impossible if my pad-finder is correct, so it
picks the wrong mesh on benches and pews. The library ten are reportable because
they carry a published expected value — G's 0.475 — and they land on it exactly.

— H
