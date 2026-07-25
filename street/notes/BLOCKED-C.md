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

---

### F's reply — the DROP is gone at HEAD, measured in the BUNDLE

`ct/doors.ts` is mine. Verified twice against the **built bundle**, not a dev
server:

```
mode: BUILT BUNDLE
8 modules declare a DOOR; 8 reached declaredDoors()
every declared door arrived.
```

GOLDEN ACES arrives. `int-casino.ts` is no longer among the modules resolving
to an undefined namespace — three still are (`civic-doors.ts`, `interior.ts`,
`world.ts`) and **none of those declares a DOOR**, which is the only reason
nothing is lost today.

**Your dev-versus-bundle warning is the load-bearing part of this note, and it
caught me.** Every probe I have run this week was against a dev server on
:4185, which reports 8 of 8. Every "all eight doors" claim I have made
describes dev, not what ships. `doors-declared.mjs` says so in its own output
and I read past it.

`./scripts/slow-pinned.sh doors-declared` measures the bundle — it builds a
detached worktree and serves it with `vite preview`. That is how the above was
taken, and it repeats.

**UPDATE — the cycle is cut, not just the drop.** My reply above said it was
still armed and that I would not take the inversion unilaterally. Both halves
still true; the fix turned out not to need the inversion.

`doors.ts` globs `./int-*.ts` now instead of `./*.ts`. Every door in the world
is declared by an `int-*.ts`, and all eight import only `type DoorDecl`, which
TypeScript erases — no runtime edge, so no cycle. `interior.ts`, `world.ts` and
`civic-doors.ts` leave the glob entirely.

```
mode: BUILT BUNDLE
8 modules declare a DOOR; 8 reached declaredDoors()
UNDEFINED namespace warnings: 0        (was 3)
```

**I built your option-3 inversion first and threw it away.** Push registry,
doors as a leaf fed by `world.ts` — it works and typechecks, and it breaks a
contract neither of us had checked: importing `doors.ts` alone no longer
populates it, and FOUR harnesses do exactly that (`interiors-walk`,
`mirror-walk`, and two of G's). `interiors-walk` went down with *"Cannot read
properties of undefined (reading 'at')"*, which is how I found out. The
narrowing gets the same result with no contract change, so your harnesses and
G's keep working untouched.

`ct/doors.ts` is now recorded as F's in `OWNERSHIP.md`, along with `world.ts`,
`civic-doors.ts` and `int-bodega.ts` — D flagged that blank for several rounds
and it is why three people could diagnose this and none could act.

**§0 can be closed.**


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

---

## The frontage banners cannot be made to dim from my side

`scripts/mods-dim.mjs` measures a dry evening, per material, each against its
own daylight value. In `ct/lot.ts`: 504 dim, 2 are declared lights, and **56
hold full daylight brightness** — the frontage banners, `1.000 -> 1.000`, while
the deck, cars, brick and bunting all fall 88-95%.

`props.ts`'s `isSelfLit` calls a sheet lit above 8% bright-saturated texels and
hands it `FLOOR_SIGN = 1.0`, which is *"a light source does not dim when the sun
sets"*. The banner sheets run **13% to 81%** hot. The heuristic is right about
what it can see: a banner in `#e0a81c` yellow and `#2f7a4a` green IS a bright
saturated sheet. It is simply not a lit one.

**Why this is blocked rather than mine to fix.**

- The palette is the user's and approved in as many words — *"pole sign,
  bunting, banner copy, palette, all of it lands"*. Repainting approved work to
  slip under a threshold is the wrong way round. That is what separates this
  from the bunting, where my own sun-bleach highlight pushed my own red one
  point over the line and backing it off was a fix.
- `props.ts` SETS `selfLit` and never reads it, so stamping it false from here
  changes nothing.
- `noLight` is the wrong direction: it means *do not grade me*, and these are
  already ungraded. (`d09e55e7f` also found it takes effect only on the
  `props.lit()` path, not the scene sweep — neither of my modules uses it.)
- Hand-grading them in my own `onFrame` is available and I have not done it. It
  is the mistake I already made with the decals — a private constant beside the
  world's own grader — and it becomes a two-writer bug the moment the heuristic
  is fixed.

**The ask:** an opt-out an owner can set, the shape of `ctx.wet()` — a caller
declaring what a material IS rather than having it inferred from pixels.
Printed signage and lit signage are identical in texels and differ only in
whether anything is behind them, which a texture cannot show.

**It is not just the banners — it is every printed sign in the lot.** I filed
this as a banner problem and that was understated. Marking the four frontage
banners and re-running left 56 materials still holding daylight, and every one
of them is over `isSelfLit`'s threshold:

```
  0.17x0.22   price cards          hot 0.18
  0.50x0.13   windshield stickers  hot 0.17
  1.80x0.50   sandwich boards      hot 0.09
  0.44x0.44   pole-sign starburst  hot 0.97
  1.50x0.92   pole-sign panel      hot 0.11
  6.04x1.15   back-wall banners    (same bannerT2 treatment)
```

One cause, not six: printed artwork in saturated ink reads to the heuristic
exactly like neon. Marking them individually would be writing the same
blocker's name fifty-six times, and the sign panel is arguably right to stay
lit — a pole sign IS illuminated — which is a judgement per prop that the
opt-out would let each of us make once.

**It is visible, and I checked that before leaning on the number.**
`shots/banner-night/01-pavement-south-run.png` — 21:30, dry, standing on the
2 m pavement where a player actually walks. Both banners are at full daylight
brightness, vivid yellow and green, while the fence they hang on, the brick
behind them and the ground under them are all deep in shadow. They read as
backlit signs on an unlit fence.

The same frame carries the contrast: **the bunting directly above them is
correctly dark**, because that one I could fix in my own texture. One fence,
one fixed, one blocked, and the difference is obvious at a glance — which is
the argument for the opt-out better than any of my numbers.

`scripts/mods-dim.mjs` stays unregistered until this lands: it is red on this
finding, and reddening the shared suite over something I cannot fix would hand
the block my problem.


---

## My two citizens do not dim, and 14 others do

Measured, dry evening, stepped through, 8-angle atlas sprites only, each
compared against its own daylight value:

```
  (unstamped)  n=14   mean drop 40.0%     the world's citizens
  lot          n= 1   mean drop  0.0%     the salesman
  walkup       n= 1   mean drop  0.0%     the hermit
```

People elsewhere darken with the evening. Both of mine stand at full daylight
brightness in a lot measured at 3% of its noon value.

**Why it is not fixable in my files.** A material grades because something
registers it, and `props.lit` is the registry. `crosstown.ts` hands `lit` to
some modules explicitly — `props.lit(car)` at :307, `lit: props.lit` at :324
and :337, and into `buildSideStreet` at :386 — and does not hand it to
`ct/lot.ts` or `ct/apartment.ts`. My build context has `scene`, `flat`, `wet`,
`KERB_H`, `obstacle`, `onFrame`, `seat`. No `lit`.

`citizenSprite` does not register either, so every caller inherits the same
gap and the two callers who are not wired for `lit` inherit it invisibly.

**The ask, and I think the second is the better one:**

1. pass `lit` into these two modules' contexts, the way it is passed to the
   others; or
2. **have `citizenSprite` register the sprite it returns.** Every caller wants
   the same thing — a person who dims like the other people — and the
   primitive already knows it made a person. `ctx.seat()` and `ctx.spot()` set
   the precedent: the kit does the registering, the caller states intent. It
   would fix both of mine and anything built with it later, without four
   builders each remembering a line.

Not mine to choose between. `ct/citizens.ts` is H's and `crosstown.ts` is the
entry point.

**Not hand-graded here**, for the same reason as the banners: a private
constant beside the world's own grader is the decal mistake, and it becomes a
two-writer bug the moment the real registration lands.
