# Standing up is decided by a proximity contest — 149 of 225 seats. For F, now

**Route this to F. It is the kit, not `apartment.ts`, and the desk's instinct
was right.**

## First, honestly: I cannot reproduce "stuck" on either world

Tried hard, on **both** my dev build and **the live integration world at 5177**
that he actually plays:

```
  6 yaws x 5 pitches, seated on the bed      prompt "[E] stand up" in 45 of 45
  6 extreme pitches (+/- 1.5 rad)            E stood him up 6 of 6
  looking at the TV, at his feet, behind him E stood him up every time
```

So I am not going to claim I found his exact failure. **What I did find is why
it is a matter of luck**, and it is worse than the bed.

## The construction: the exit is a spot you must WIN

`crosstown.ts:236` registers standing up as an ordinary spot and lets the E
resolver pick it. It survives today only because a seated player is at distance
**0 m** from it and nothing can be nearer.

Everything else near a seat stays live while you sit, because **only the SIT
spot is guarded** (`ok: () => !rig.seated`) — an ordinary `ctx.spot` has no
such guard. Seated on the bed:

```
    0.00 m (r 0.50)  stand up
    0.55 m (r 0.75)  sleep until morning      <- live while seated
    2.38 m (r 0.95)  close the door
```

So E-while-seated is one radius change, one weighting change or one aim-cone
change away from firing **sleep** instead of standing. D has just taken the
cone from 35.5 to 15 degrees; that is exactly the kind of change this is
sensitive to.

## And the real number, which is why this is urgent

I checked every seat in the world, not just mine:

```
  225 seats
  149 have a non-stand spot INSIDE the 0.5 m stand radius
   12+ have one at EXACTLY 0.00 m — the seat's own "sit down"
```

A seat registered **without `approach`** puts `at = {x: s.x, z: s.z}`, so its
sit spot and its stand spot occupy **the identical coordinate**. They are
mutually exclusive through `ok()` today, so only one is ever live — but the
distance tiebreak between them is undefined, and there is nothing else to
separate them if either predicate is ever true for a frame.

**The 0.00 m cluster is the casino floor at x 598-601 — the slot stools.** That
is precisely the case the desk predicted L would hit.

My bed seat is one of the *safer* ones, because it declares an `approach` and
its sit spot is 0.72 m away.

## The fix, which is the desk's and I agree with it

**Standing up must not go through spot selection at all.** It is a state exit,
not a world interaction: while `rig.seated`, E stands, full stop, regardless of
what is near or where he is looking. That is `crosstown.ts:236-240` and the E
dispatch below it.

Two things to keep while doing it:

1. **Keep the prompt.** It is correct and it shows in 45 of 45 look directions;
   it just needs to stop being the mechanism as well as the label.
2. **`standLabel` while you are in there** — see `notes/C-standlabel-for-F.md`.
   A state seat needs to say *stop watching TV*, not *stand up*, and that is
   the reason he had to ask in the first place.

## The escape hatch cannot be built in my file

The desk asked for one in the same commit. **There is no Escape, back, or
cancel binding anywhere in this world** — grepped `crosstown.ts`, `fp.ts` and
`hud.ts` for `Escape`, `Esc`, `KeyQ`, `Backspace`: no hits. E is the only
interaction key there is.

So a second exit is an input-layer change in files that are not mine. The
obvious candidate costs nothing and needs no new key: **any movement input
while seated stands you up.** `rig` already reads WASD; a seated player pressing
W currently does nothing at all, which is its own small trap.

**I have not built a private exit in `apartment.ts`** — a state whose exit
lives in one module is the thing that made this fragile, and the desk was right
that the kit should carry it once rather than five builders carrying it five
ways.
