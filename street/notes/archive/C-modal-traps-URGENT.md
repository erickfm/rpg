# A seat that opens a MODAL is still a trap — and it is probably the one he hit

**This is not the seat exit.** That is fixed and green. This is a second,
independent trap in the same shape, and I found it while testing the first.

## Reproduced, on a casino slot stool

```
  warped to (675.0, 14.2)   seated=false   prompt "[E] sit at the slot"
  after E                   seated=TRUE    prompt "[E] stand up"
  after E again             seated=TRUE    <- stuck
  after Escape              seated=TRUE    <- stuck
```

Held keys rather than taps, so it is not a missed edge. Both keys fail, which
is the tell: **the input never reaches the world at all.**

## Why

Sitting there adds `#ct-panelback` to the document — a modal panel opens. And
`ct/hud.ts:168`:

```js
const BLOCKED = ['keydown', 'mousedown', 'mousemove', 'wheel'];
```

While a panel is open, keydown is blocked. So `input.keys` never sees `e` or
`escape`, the E dispatch never runs, and `fp.ts`'s escape hatch never runs
either. **Neither of tonight's two fixes can help, because both live downstream
of an event that is being swallowed.**

## Why I think this is the user's report

He said *"pressing e doesnt get me out of it."* On the bed I could not
reproduce that in 45 look directions or at any pitch, before or after my fix.
Here it reproduces every single time, and Escape fails too — which matches
"pressing e doesnt get me out" better than anything I found on the TV seat.

The slots interface is being wired right now, so a seat that opens it is new
tonight, the same as the TV seat is.

## Whose, and what I have not done

`ct/hud.ts`'s panel gate and the slots panel are **not mine** — my mandate was
`crosstown.ts:236-240`, the E dispatch, and one binding in `fp.ts`, all of
which are done. I have not touched the gate.

The fix is the panel's, and there are two honest shapes:

1. **The panel owns its own exit** — Escape closes it, and closing it stands
   the player up. That is the normal contract for a modal and it needs the gate
   to let Escape through, or the panel to listen for it itself.
2. **The gate stops blocking Escape specifically.** `BLOCKED` swallows every
   keydown; a cancel key is the one that should always get through, because it
   is the key you press when something has gone wrong.

I would do both. A modal that can only be left by clicking the right pixel is
the same fault as a seat with one exit, and this world now has several panels
— ATM, pockets, letter, slots.

## Guarded

`scripts/seatexit.mjs` asserts the seat exit and, on a seat that opens a panel,
**names the panel as the cause rather than failing against the wrong module.**
It is green today: the bed lets go from 6 of 6 directions, Escape works, and
the stool case reports the modal explicitly.
