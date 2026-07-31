# The slot-stool trap is HALF closed — E still does nothing, Escape now works

**For K and F, whose files these are, and for the desk, because this changes
the severity.** From O, a second verifier. Build `f306499a7`.
**Row left at LANDED — its central claim is no longer true as written.**

## What the row says

> *"A player who sits at a slot machine cannot leave by any key, and reloading
> is the only exit."* — on **96 of 225 seats, 43% of every seat in the game.**

## What I measure now

Re-counted the blast radius rather than quoting it: **225 seats, 96 labelled
`sit at the slot` — 43%.** That part is unchanged and correct.

At I's own station, and with **eight keys instead of two**, because *"cannot
leave by any key"* deserves more than the two that were tried:

```
sat down            seated true    #ct-panelback present
pressed e      ->   seated TRUE    <- STILL DOES NOTHING
pressed Escape ->   seated FALSE   <- THIS NOW WORKS
```

**So it is no longer an unrecoverable trap.** Reloading is not the only exit;
Escape is an exit. That is a real change in severity and the desk should have
it before prioritising.

## But do not close it, for two reasons

**1. `E` is the key the whole world uses, and it is the key the player presses.**
Every other seat in this game releases on E. A player at a slot stool presses E,
nothing happens, and there is no way for them to learn that this one seat wants
a different key. The user has already asked *"how do i stop watching the tv"*
about a seat whose exit merely had the wrong LABEL — this one has the wrong KEY.

**2. The mechanism the row names is still there.** `ct/hud.ts:168` lists
`keydown` in `BLOCKED`, so `input.keys` never sees `e` while a panel is open.
Escape working is Escape being handled somewhere the block does not reach; it
is not the block being lifted.

## Two things I checked so they would not be reported wrongly

**Movement fully recovers.** My first measurement said the player walked
**0.00 m** after escaping, which looks exactly like a still-trapped player. It
is not — it is walking into the slot machine. Against a never-sat control at
the same stool:

```
                  +z     -z     +x     -x
CONTROL never sat 0.00   0.16   4.17   2.58
AFTER sit+Escape  0.00   0.16   4.29   3.96
```

**They match.** I would have filed a false alarm on somebody else's severe row
without that control.

**The leftover `#ct-panelback` is harmless.** It stays in the document after you
stand, but at `opacity: 0` and `pointer-events: none`. Residue, not a blocker.

## What I have not done

`ct/hud.ts` is K's, `crosstown.ts` is the desk's, and the slots are L's. This is
a measurement for their owners. `scripts/O-verify-K-slottrap.mjs` reproduces all
of it, tries eight keys, and re-counts the blast radius from `__ct.seats()`
rather than trusting the number in the row.

— O
