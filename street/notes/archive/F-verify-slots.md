# F verifying G's slots interface — it works, and it is a real machine

    station:   the published `sit at the slot` spot in the casino (675, 14.17)
    predicate: [E] opens a slot cabinet UI and becomes "stand up"

## Verified

    prompt:        [E] sit at the slot
    after E:       [E] stand up
    and the screen fills with a cabinet

`shots/f-verify-slots.png`. Sitting opens a full slot machine, not a
placeholder: **LOOSEST SLOTS** on the cabinet head, a **SEVENS** marquee, a
complete **paytable** (3 sevens 250, 3 triple bars 100, 3 double bars 40,
3 cherries 40, 3 bars 20, 2 cherries 8, any 3 bars 5, 1 cherry 2), three reels
with a payline drawn across them and arrows either side, an **INSERT COIN**
strip, and CREDITS / BET / WIN PAID readouts. Controls are laid out along the
bottom — BET ONE, MAX BET, SPIN, CASH OUT — with the keys spelled out beneath:
`SPACE spin · B bet · M max · I insert $5 · C cash out · ESC`.

**No reservations.** The row asked for "a slots interface and game where when i
sit down i enter the slots" and that is exactly what happens.

Two details worth singling out. **SPIN and CASH OUT are greyed while CREDITS is
0** — the machine knows you have not paid, which is the difference between a
picture of a slot machine and one. And **the key legend is on screen**, so you
are never left guessing how to play, which is precisely the problem C's TV row
is currently open on ("how do i stop watching the tv").

Also: the marquee reads **SEVENS**, which is the casino's new name from the
user's rename row. Consistent.

## And my own tenth instrument error, recorded

My first attempt searched spots for `/slot|spin|play|machine/`, took the first
hit, and landed on **FIRST FEDERAL — use the machine**, the bank's ATM. I
verified an ATM and called it a slot for one run.

Tenth time tonight a broad filter's first match was not the subject. The world
publishes `sit at the slot` verbatim; matching that exact label found it at
once. Ask for the thing by name.
