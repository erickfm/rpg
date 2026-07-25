# BLOCKED — builder C

## 0. The doors.ts import cycle: the crash is fixed, the DROP is not

The original crash (`publishDeclaredDoors` throwing on an undefined namespace)
was fixed at source in `db76dc26`, and §0.2's ask — *warn rather than skip
silently* — landed too: `ct/doors.ts:91` now names the module and cites this
note. Both good.

**The cycle itself is still there, and it has grown from one module to four.**
At HEAD the browser console carries:

```
[doors] ./civic-doors.ts  resolved to an UNDEFINED namespace at collection time
[doors] ./int-casino.ts   resolved to an UNDEFINED namespace at collection time
[doors] ./interior.ts     resolved to an UNDEFINED namespace at collection time
[doors] ./world.ts        resolved to an UNDEFINED namespace at collection time
```

**And one of them is losing a real declaration.** `int-casino.ts:50` exports
`DOOR: { building: 'GOLDEN ACES', … }`. Eight modules declare a door; seven
reach `declaredDoors()`. GOLDEN ACES is the one that does not:

```
node scripts/doors-declared.mjs
  8 modules declare a DOOR; 7 reached declaredDoors()
  DECLARED BUT NEVER COLLECTED:
    GOLDEN ACES      src/proto/ct/int-casino.ts
```

So the facade painter, the `[E]` census and anything else driven by
`declaredDoors()` does not know the casino has a door. `int-casino.ts`'s own
comment says *"declaring it publishes it to tooling without moving anything"* —
it does not, and there was no way to notice.

**For whoever owns `ct/doors.ts` and `ct/int-casino.ts`.** The warning was the
right first step and it is what made this findable, but a console warning is
not read on the way past — `scripts/doors-declared.mjs` counts both ends and
exits 1, so it can go in `npm run checks`. The fix is still the cycle: either
those four stop importing `./doors`, or the glob stops being eager, or DOOR
declarations move to a leaf module nobody imports back.

## 1. ~~The curb cut~~ — LANDED, and it lines up

**Resolved by B.** `ct/tex-ground.ts` now breaks the kerb across the lot's
mouth, keeps a 35 mm lip at the gutter so the gutter still carries water past
the drive, flares back to full reveal over 0.9 m either side, and carries the
walk over it on a ramped apron sampled from the same `apronY()` the
ground-height function uses — so what you see and what you walk on cannot
drift apart.

It is built to the aisle rather than to a guess: `{ x: ROAD_HALF, z: 2.6,
hw: 3.4 }` is the same centre and the same half-width as `ct/lot.ts`'s
`AISLE_HW`. If I ever move the aisle, that is the one line that has to follow.

Verified from my side (`shots/curbcut/`, and `scripts/lotwalk.mjs`): you still
enter across z −0.5 to 6.0 and the fence still stops you at every other z; the
road, gutter, dropped kerb, apron and lot asphalt run continuously with no step
and nothing floating; and nothing this module builds sits on the apron —
everything of mine is at x ≥ 7.18 and the apron ends at x = 7.

That closes "how does a car get on and off", which was the oldest open thing
on this lot.

## 2. ~~Three car variants~~ — LANDED, and all three are in

**Resolved by H.** `ct/cars.ts` exports `CarState`: `hood`, `wheelsOff`,
`jack: Corner` and `blocks`. Every option is additive and a car built with no
state is byte-identical to before, which H did deliberately — three.js burns
four `Math.random()` calls per object in `generateUUID`, so one extra mesh
re-grains every unseeded texture painted after it and the whole world's
fingerprint moves (GOTCHAS §1). A lot full of jacked cars must not be able to
change the pigeons.

All three are placed, each where its reason is:

| variant | bay | why there |
|---|---|---|
| `hood: true` | bay 1, south flank, first slot | you pass it on the way in; a lot always has one being looked at, and that is what makes the place read as WORKING rather than as thirteen parked cars |
| `jack: 'rl'` | back, north corner | beside the tyre stacks, which have stood there since the first pass with nothing to explain them |
| `blocks: true` | the furthest bay from the street | not stock — a donor |

Verified: `userData.jack` and `userData.onBlocks` read back at (24.4, 7.3) and
(24.4, −2.1), the hood-up car photographed at `shots/variants/02-hood-close.png`
with its bonnet on the hinge and the dark bay under it, and all nine checks in
`npm run checks` still green — including `density` and `seampairs`, so the
fingerprint warning did not bite.

## 3. "Sleep in your room" needs a way to advance the clock — nobody has one

**What I need:** a way for a module to move game time forward.
**From whom:** whoever owns `ct/ctx.ts` and `crosstown.ts` — the desk.

This is an outstanding request in the user's own words
(`FEATURE-REQUESTS.md`): *"Sleep in your room… a real gameplay verb, not just
a lit interior. Implies a bed to interact with, an `[E] sleep` prompt, and
time passing (advance the clock, fade out/in)."* It has never been queued, it
is in my file — room 301's bed, `ct/apartment.ts` — and I flagged it as
missing in `notes/C-lot.md` a while back.

**Everything except the time is mine and I can build it today.** The bed
exists, `ctx.spot()` is how the prompt gets registered, and gating it to floor
3 is the same `lastGy` check the door already uses.

**What I cannot do is the part that makes it sleep.** `totalMin` is a closure
local in `crosstown.ts`. The only thing that writes it is the `__ct.clock()`
TEST affordance; `ctx` exposes the clock read-only, as `hourAbs`, `hourF` and
`night` on the frame. No module can move it, and I checked — nothing in the
tree does.

I am not shipping the half of it I can reach. A sleep verb that does not pass
time is not a partial feature, it is a prompt that appears to do nothing, and
that reads as broken rather than unfinished.

**The smallest thing that unblocks it**, and it is one line plus a field:

```ts
// ctx.ts
/** move the game clock forward, in minutes. For anything that costs TIME —
 *  sleeping, a long wait, a bus you let go past. */
advanceTime: (minutes: number) => void;
```

wired in `crosstown.ts` to `totalMin += minutes`. Two callers will want it
immediately: this, and G's hotel.

**Two things to decide with it, which are not mine either:**

1. **The fade.** The request says "fade out/in". That is a full-screen
   overlay, so it belongs with the HUD, not in a world module. If it is not
   worth doing, jumping the clock with no transition is jarring but shippable
   — say which and I will build to it.
2. **How long a sleep is.** "Until morning" (snap to 07:00) reads better than
   a fixed eight hours, because it makes the verb mean something at any hour.
   I would default to that unless told otherwise.


---

## A second kit gap, same file, same shape as the clock

**`Frame` carries `night` and no `wetness`.** `ctx.ts:117` gives a per-frame
hook `dt, t, px, pz, gy, hourAbs, hourF, night`. Wetness is a closure local in
`props.ts` and is not among them.

The cost is not hypothetical, and it is not only mine:

- My lot's decals could not react to rain in their own loop, so they went to
  `ctx.wet()` — which was the better home anyway, but the choice was forced
  rather than made.
- Every builder measuring rain this week has had to infer a hidden state from
  material colour. That inference produced a wrong published answer three
  times: my own withdrawn "wet does nothing at night", my failed dry-down
  measurement, and two in `adc7d208`.

`wet: number` on `Frame`, alongside `night`, turns all of that into reading a
number. It would also make `props.ts`'s own drying model — *"wet fast, dry
slow, longer after a long storm and longer again at night"* — testable from
outside for the first time; today nothing can assert it.

Not a patch: `ct/ctx.ts` and `ct/props.ts` are not mine.


---

## Who owns `ct/lot.ts`?

Not blocking work — I have been editing it all week and will continue — but it
is unrecorded, and I would rather ask than assume:

- `OWNERSHIP.md` does not list it.
- My queue header lists `ct/apartment.ts` and `resGroundTex` and not it.
- The desk routes all of its tasks to me.

`scripts/ownership.sh C` therefore clears my edits to it by default rather than
by decision, and would clear anyone else's too — see `notes/C-ownership-hole.md`
for the measurement, which is a general defect in the guard rather than a
question about this one file.

One line in the table settles it either way.
