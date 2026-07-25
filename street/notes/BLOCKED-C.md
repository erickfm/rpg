# BLOCKED — builder C

## 0. THE WORLD DOES NOT BOOT ON MAINLINE — someone owns ct/doors.ts

**Read this first; it is not my file and it is down for everybody.**

`publishDeclaredDoors()` throws during world build, so `__ct` never
initialises. Every builder's shot script times out on `waitForFunction`, and
`scripts/health.mjs` times out rather than printing WORLD OK. No visual
verification is possible by anyone until it is fixed.

**Cause**, confirmed by instrumenting the loop rather than by reading it:

```
[probe] undefined namespace: ./bodega.ts
```

`ensure()` walks `import.meta.glob('./*.ts', { eager: true })` and reads
`.DOOR` off each namespace. `ct/bodega.ts` imports `./doors` back, so under an
eager glob **its namespace entry is undefined**, and `MODS[path].DOOR` throws.
The guard was `if (!d || typeof d.building !== 'string')` — that catches a
missing DOOR, not a missing MODULE. The comment four lines above the loop
already predicts this exact cycle; the guard just does not cover it.

**RESOLVED while this was being written** — the owner landed `MODS[path]?.DOOR`,
which is the same fix and tidier than the guard I had staged, so mine was
dropped on rebase. The world boots and `health.mjs` is green again. Left here
because points 1–3 below are still open and the cause is worth having written
down: it cost a full diagnosis to find, and reading the loop does not reveal
it.

**What still needs doing, by whoever owns these two files** — the optional
chain stops the throw, it does not fix the cause:

1. **Break the cycle.** `ct/bodega.ts` importing `ct/doors.ts` while
   `ct/doors.ts` eagerly globs every sibling is the actual defect. Either
   bodega stops importing doors, or the glob stops being eager, or DOOR
   declarations move to a leaf module nobody imports back.
2. **Bodega's declared door is currently being DROPPED, silently.** `?.` turns
   a crash into a shrug: if bodega declares a DOOR it is now ignored with no
   trace. That is the same class of bug as the missing glyph that shipped
   "BUY ERE AY ERE" for several commits — a silent blank is indistinguishable
   from correct. Worth a `console.warn` on the undefined branch until the
   cycle is actually gone.
3. **`world.ts` globs `./*.ts` eagerly too**, and `interior.ts` globs
   `./int-*.ts`. Whatever rule comes out of this should be applied to all
   three, not just to doors.ts.


Two asks, both small for the person who can do them. Neither stalls me — I am
shipping the rest of the lot meanwhile.

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

## 2. Three car variants — H's file

**What I need:** cars with the hood up, on a jack with a wheel off, and
optionally up on blocks.
**From whom:** builder H (`ct/cars.ts`), through the desk.

The brief asks for "one car up on a jack with a wheel off, one with the hood
open". Cars are H's and I have added none — the lot's sixteen are `makeCar()`
unmodified. In order of value:

1. **Hood up.** The single thing that makes a lot read as *working* rather
   than as sixteen parked cars. Ideally a dark engine bay so it reads at
   distance.
2. **On a jack, one wheel off.** Pairs with the tyre stacks already in the
   lot, and gives the back row a reason to exist.
3. **Up on blocks** — the one that is not for sale.

**An option needing no new geometry:** a flag on `makeCar` to omit one or all
wheels. That gives me both the jack car and the blocks car by itself, and I
stack the tyres beside them — I already build tyre stacks.

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
