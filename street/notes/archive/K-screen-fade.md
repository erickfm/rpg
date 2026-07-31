# The screen fade — for C's sleep verb, and for anything else that cuts away

**C: this is the one line you asked the desk for.** *"when the player goes to
sleep i want the screen to fade to black"*. It is mine because it is a
full-screen overlay and I own `ct/hud.ts`; the verb is yours and I have not
touched `ct/apartment.ts`.

**Status: LANDED on `feat/inv`** (my own branch, so rebase before citing a hash
— GOTCHAS §36).

---

## Call it

```ts
import { screenFade } from './hud';

// in the sleep spot's act():
act: () => {
  screenFade({ mid: () => ctx.clock.advance(minsToMorning, { overSeconds: 0 }) });
},
```

That is the whole integration. `screenFade` is exported from `ct/hud.ts`
directly rather than hung off `ctx`, because `ct/ctx.ts` is desk-owned and
blocking a user request on a coordination step is how this project loses hours.
Same pattern as `takeable` in `ct/inventory.ts`: the kit does the work, the
caller states intent, nobody edits anybody else's file.

| | |
|---|---|
| `mid` | runs **while the screen is black**. Put the clock advance here. |
| `outMs` | fade to black. Default **850** |
| `holdMs` | how long it stays black after `mid`. Default **750** |
| `inMs` | fade back. Default **1000** |

Returns a promise that resolves when the screen is genuinely back — not when
the transition was *asked* to finish. `screenFading()` answers "is a cut running
right now" for anything that must not fire during one.

## Three things it does that you should not re-do

1. **`mid` runs inside the black, never before it.** Advance the clock first and
   the fade-in reveals a room that has already changed, which reads as a loading
   screen rather than as sleeping. The check's `--selftest` is exactly that
   mistake, so it cannot come back quietly.
2. **Black is held for a beat.** A fade straight from black to bright is a
   blink, not a night.
3. **Nothing moves or interacts while it runs** — including a key that was
   already **held down** when it started. That second half is the one an
   ordinary implementation misses: blocking new keypresses does nothing about a
   key already sitting in `main.ts`'s input Set, so the fade dispatches
   synthetic keyups to clear them. Otherwise walking into your own bed walks you
   across the room in the dark.

## **Pass `overSeconds: 0`. Snap the clock, do not ramp it.**

`ctx.clock.advance` ramps over 1.5 s by default, and that default was right when
it was written: with no fade, a snap would jump the sky, the lamps and the rain
schedule in a single frame in full view of the player. **The ramp existed
because there was nothing to hide the jump behind.** There is now. Behind a
black screen a ramp buys nothing and costs the one thing that matters — it can
still be running when the fade-in starts, and then the player watches the sky
sweep, which is the loading-screen feeling again by another route.

## A ruling of the desk's is superseded here, on purpose

When you asked the desk to decide the sleep verb, it ruled **NO FADE — jump the
clock**, on the grounds that a full-screen overlay was HUD work and not worth
blocking a gameplay verb on. That was a reasonable call to unblock you and it is
now overtaken: the user has walked it and asked for the fade by name. Nothing
you built needs revisiting — the verb, `ctx.clock.advance` and the 07:00 target
are all unchanged. One argument, one line.

## How it is checked

`scripts/K-sleep-fade.mjs`, registered in `checks.mjs`. It reads the overlay's
**computed opacity** rather than a `fading()` flag, because a boolean going true
is not the same claim as the screen being black.

Two controls, because its central verdict is an absence and an absence is free
over an empty set (GOTCHAS §34):

- a held W with **no fade** — 2.7 m, so the driver's keys really do reach the
  page and "did not move" is not passing because nothing was pressed
- a whole fade with **no keys** — the residual drift, which is collider settling
  after a warp and not input. I read 0.132 m of it as a broken input lock and
  spent a round on it

**Two things it caught that are worth your time**, because both are traps you
could hit in `apartment.ts` too:

- **A synthetic `KeyboardEvent` dispatched on `window` is not a key.** When you
  dispatch *on* window, window is the TARGET, so its capture and bubble
  listeners fire in registration order and `main.ts` (registered first) wins. A
  real key lands on `document.body`, so a window capture listener runs a whole
  phase earlier. My first probe reported the input lock broken and the lock was
  fine. Drive real keys.
- **A CSS transition does not start when you set the property** — it starts when
  a frame is served. Timing the middle of the fade with a `setTimeout` from t0
  ran the world change at **opacity 0.842** on a loaded machine. It waits for
  `transitionend` now, with a timeout only as a fallback, because a fade that
  never finishes leaves the player locked out in the dark. GOTCHAS §30, in a
  costume.

Green 4 of 4 run concurrently.

**STATION:** stand anywhere, `window.__hud.fade({ mid: () => window.__ct.advanceClock(8*60, 0) })`.
Or from the world: sleep in 301. `shots/K/fade-{0-before,1-going,3-after}.png`
are 22:30 → half faded → 06:37, dawn on the block with the lamp still lit.

— K
