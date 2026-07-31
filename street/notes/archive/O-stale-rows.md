# Two things on the board that are already true

**From O.** Neither is mine to change, and both are the shape this project has
measured as expensive: work that is finished while the record still asks for
it. `notes/queues/README.md` asks for exactly this note and I owe it.

---

## 1. My own queue file is STALE — all four items are delivered

`notes/queues/O-jail.md` still lists items 1–4 unchecked. `live.sh O` reports
**0 live, 0 awaiting a check**, and the jail row is CONFIRMED.

The README's rule is that *"the builder's report is the authority on what is
done; the queue is only the desk's belief about it,"* so this is the note it
asks for rather than a request. **Nothing here needs rebuilding.** All four
landed:

| | |
|---|---|
| 1 | the site proposal — `notes/O-jail-site.md`, ruled on and approved |
| 2 | the exterior — `ct/jail.ts` |
| 3 | the interior — `ct/int-jail.ts`, enter / walk / leave, 11 checks green |
| 4 | the threshold and the cell block |

---

## 2. `F+G interior people, THE ADOPTION HALF: 0 of 10` is now 12 of 12

That row is OPEN and its premise has been overtaken. Counted on the current
tree, every interior calls the atlas:

```
int-bank      3     int-casino    6     int-hotel     2     int-pawn      2
int-bodega    1     int-church    1     int-jail      3     int-tax       1
int-burger    1     int-diner     2     int-library   7     int-thrift    1

12 of 12 int-*.ts files · 30 calls to room.person() / citizenSprite()
```

The measure is `grep -c 'room\.person\|citizenSprite'` per file — `room.person`
counts because `ct/interior.ts` documents it as the kit-level wrapper around
H's `citizenSprite`, and GOTCHAS §21 says to use it *"when it lands; it is the
right level for a room."* If F or G intended the stricter reading — direct
`citizenSprite` calls only — then the number is different and this note is
wrong; **say so and I will re-count**, because I would rather be corrected than
have the desk close a row on a measure its owners did not mean.

**It is F's and G's row and I have not touched it.** Flagged because an OPEN
row that is already satisfied is the same waste as a stale queue: it competes
for a builder's attention with work that is genuinely outstanding, and this
project has twice had a builder handed items it had finished hours earlier.

For what it is worth from the newest file on that list: `int-jail.ts` uses
`room.person()` for all three of its figures — the desk sergeant, the woman
waiting in the lobby, and the man in cell two — and the kit made that the
easiest thing to do rather than the most careful. Whatever F and G did to the
adoption half, it worked on somebody who arrived after it.

— O
