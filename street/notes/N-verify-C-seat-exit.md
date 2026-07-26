# VERIFY C's seat-exit row — three claims reproduce, one has gone STALE

Builder N, verifying a row I did not build. **Not marked CONFIRMED** — only the
desk or the auditor may. Built bundle on 4195, build `2bda13fcc+`.

The row is a **measurement and a routing, not a fix** — C says so itself and
routed the fix to F in `notes/C-seat-exit-URGENT-for-F.md`. So what is verifiable
here is whether the measurements hold, and one of them no longer does.

## ✅ "I could not reproduce the stuck state"

Reproduces. On my build, seated on the bed:

```
stand-up live across the look grid   30 of 30   (6 yaws x 5 pitches)
E while seated, 20 look directions   stood 20, STILL SEATED 0, slept instead 0
```

Including straight up and straight down. I could not get stuck either.

**One number in the cell does not multiply, and the row will be quoted.** It
says *"6 yaws x 5 pitches gave `[E] stand up` in 45 of 45 look directions"* —
6 × 5 is 30. Either the sweep was 9 yaws, or the 45 is a typo. **The substance
is unaffected** (stand-up is live in every direction either way) and I am
flagging it only because a figure inside a CONFIRMED row outlives the run that
produced it.

## ✅ "seated on the bed, `sleep until morning` is live at 0.55 m"

Reproduces to the centimetre. Everything live while seated, by distance:

```
stand up              d 0.00   r 0.50
sleep until morning   d 0.55   r 0.75
```

C's point stands exactly as written: standing up survives only because a seated
player is 0 m from it, and it is one radius or weighting change from losing.

## ✅ "149 of 225 seats have a non-stand spot inside the 0.5 m stand radius"

**149 of 225. C's number, to the unit.**

I got this wrong first and it is worth recording why, because it is GOTCHAS §25
exactly — *"before reporting that a checker is wrong about your module, read
what its column is actually asking."* My first predicate excluded sit-spots on
the reasoning that a seat's own sit spot does not count, and reported **7**. C's
sentence says *non-stand*, which read literally is every registered spot whose
label is not `stand up` — and on that reading it is 149. I was one careless
filter away from filing "C's blast radius is off by a factor of twenty."

**The `0.00 m` figure is a floor, correctly hedged.** C wrote *"12+ have one at
EXACTLY 0.00 m"*; I count **69**. And C's prediction of where they are is right —
the largest cluster is:

```
sit at the slot        78
sit down               28
sit in the pew         28
sit at the counter      7
take a booth seat       6
```

`sit at the slot` is the casino floor. C called that *"exactly the case the desk
predicted L would hit"*, and it is the biggest single group in the world.

## ❌ STALE — "there is no Escape, back or cancel binding anywhere in this world"

**There is one now.** `ct/hud.ts:299`, inside the panel framework's
capture-phase gate:

```js
if (k === 'escape') p.close();
```

C grepped `crosstown.ts`, `fp.ts` and `hud.ts` and got no hits, so this was true
when measured — K's `makePanel` landed afterwards and brought a global ESC
handler with it. My own letter panel in `ct/tenancy.ts` relies on it.

**C's underlying point survives and I am not softening it:** a seat is not a
panel, and a seated player still has exactly one way out. But the design C
offered F rests on the premise that a second exit needs a new binding, and it
does not any more:

- there IS a capture-phase key gate in `hud.ts` that already owns ESC and
  already releases keys held down — `releaseHeld()` / `gateUp()`
- so the cheapest escape hatch is to widen what that gate answers for, rather
  than to invent a binding or fall back to C's movement-key suggestion

That is F's call and K's file; I am correcting the premise, not the ruling.

## What I did not do

I did not try to reproduce the user's original stuck state on the **live
integration world at 5177**, which is where he actually plays and where C also
failed to reproduce it. Both of us have now failed to reproduce it on our own
builds, and two negatives from two builders is not the same as knowing it cannot
happen — the 69 seats sharing a coordinate are the standing reason to believe it
can.

— N
