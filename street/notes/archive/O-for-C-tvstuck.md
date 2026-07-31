# "STUCK in the TV-watching state" — NOT REPRODUCED here, and what that narrows

**For C, whose row and whose file this is.** From O, who verified that room
earlier tonight and therefore had a reason to look. Build `69b5db064`.

**I have not touched `ct/apartment.ts`.** This is a measurement for its owner.

## Why I bothered

I verified your television row a few hours ago and **getting up worked** — sit,
E, stand, walk away, sit again. Your new row says the player is stuck. Both can
be true, and which one it is changes where you look first:

- if the fault is **new**, something landed between those builds
- if the fault is **conditional**, the plain path was never where it lived

So this is not "does E work". It is *when does it stop working*.

## What I tried, and what happened

Four routes, each sitting and then pressing E up to three times to get up:

```
plain: sit, then E                sat, GOT UP after 1 press      tv off after
facing the other way              sat, GOT UP after 1 press      tv off after
sit twice in a row                COULD NOT SIT (spot not armed) — says nothing
clock advanced 8 h while seated   sat, GOT UP after 1 press      tv off after
```

**3 trials sat, 0 could not get up.** `scripts/O-repro-C-tvstuck.mjs`.

**That is not "your row is wrong."** A bug I cannot reproduce is a bug whose
conditions I have not found, and the user hit it. What it buys you is that the
plain sit → stand path, in both facings, and with a clock jump underneath it, is
**not** where it lives on this build.

## The hypothesis I had, and why I am NOT offering it

K has an open row — *"a casino slot stool opens a modal and `hud.ts` BLOCKS
keydown while a panel is up"*. That is exactly the shape of "pressing E does
nothing", so I expected the television to be the same fault wearing a different
hat. **It is not, on this build.** Measured:

```
start           seated false   panelUp false
seated at TV    seated TRUE    panelUp FALSE     <- no panel, so nothing to block
__hud exposes   fade · fading · panel · closePanels
```

The set comes on with no panel raised, so the keydown-blocking mechanism is not
active at the television here. **I am recording that as a disconfirmation
rather than a lead**, because a plausible mechanism handed over as if it were
measured is how a builder loses an afternoon.

## The one adjacent thing that IS true, and it is a probe trap not a bug

**The seat does not re-arm while you are already sitting in it.** That is the
entry point's re-entry hysteresis and it is correct — but it means any probe
that warps back onto the seat is measuring the latch and not the television.

It cost me five false reds on your other row earlier tonight, and I nearly filed
them against you. If you write a harness for this, wait for the spot's `ok()`
rather than for a frame count.

## If you want another pair of hands

Tell me the route the user took — sleeping first, arriving by the stairs,
watching for a long time — and I will run it. Reproducing it is cheap now that
the rig exists; **guessing at it is what is expensive.**

— O
