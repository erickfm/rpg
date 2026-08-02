# w18 — sitting on the bed lights the TV again (queue item 20)

**Root cause, one line:** the seat's x lived in *two* hand-typed places, and
when the desk moved the seat to the foot of the bed only one of them moved —
`apartment.ts`'s own lit-test kept comparing the player against the seat's *old*
coordinate, 0.54 m away, against a 0.20 m tolerance.

## The desk's hypothesis was wrong, and the check said so out loud

The item offered two possibilities — *"the pick moved, or the TV trigger broke"*
— and leaned on the first: the check's own failure text warns that the SLEEP
spot may now win every pick. **It does not.** On the very first before-run:

```
OK    a player can reach the seat prompt (standing at 197.44, -17.7)
OK    pressing E sits you on the bed
FAIL  SEATED: the set comes on
```

The seat is reachable, the prompt is right, E seats you. Only the television was
broken. So: the trigger, not the pick.

## The numbers

`APT_X = 200.0`, `APT_Z = −20.0` (derived from the world, not typed: the
`sleep until morning` spot is declared `AX(-2.6), AZI(4.2)` and reports back at
`197.4, −15.8`).

| | local | world |
|---|---|---|
| seat pose, after 4d5729246 | `AX(TV_X)` = `AX(-1.56)` | **198.44** |
| `TV_SEAT_X`, the lit-test | `AX(-2.10)` | **197.90** |
| gap | | **0.54 m** |
| the test's tolerance | | **0.20 m** |

`rig.sit()` (`src/proto/fp.ts:126`) sets `this.pos.x/z` to the seat pose exactly,
and the seated branch of `update()` (`fp.ts:309`) returns before any movement or
collision, so the seated position is *precisely* the pose — no drift, no
push-out. The frame loop therefore compared 0.54 against 0.20 on every frame
for the whole session and `tvLit` could never go true. **Nothing errored**,
which is why it read as a mystery rather than a typo.

Measured directly with `scripts/probes/w18-where-does-sitting-put-you.mjs`:
`SEATED at x/z: 198.44 -15.58`.

## What I changed

`src/proto/ct/apartment.ts`, both sides of the same coordinate:

- `TV_SEAT_X` is now `AX(TV_X)` — the set's own centre line, the same source the
  seat was moved onto.
- `ctx.seat({...})` is now registered **from `TV_SEAT_X`/`TV_SEAT_Z`** instead of
  from a second `AX(TV_X)`. One declaration, read twice. The two copies cannot
  drift apart again, which is the actual defect — the wrong number was only the
  symptom.

**The foot-of-bed view is untouched.** The seat is still at `AX(TV_X)`; it is
only *spelled* differently. That was explicitly what not to undo.

Derived, not copied: `TV_X` is imported from where the cabinet is built
(`apartment.ts:2422`). No new number was typed anywhere in this change.

## Proof

- `scripts/K-tv-off-unless-seated.mjs` — **red before, green after**, on both the
  dev server and the **built bundle** (`vite preview`, port 4181, build
  `3299bf8bb`).
- **Walked it**, which the row required and the check does not do — the check
  *warps* to find the seat, and a warp is the one instrument a coordinate bug
  could be made to pass. `scripts/probes/w18-walk-to-the-tv.mjs` walks out to
  301's door on WASD, confirms the prompt is gone and the set dark, walks back,
  sits, watches it come on, stands, watches it go off, and confirms you can walk
  away afterwards rather than being wedged. Green on dev and on the built bundle.
- **Mutation-tested my own fix**: re-drifted the two coordinates apart on purpose
  (lit-test back to `AX(-2.10)`, seat left at `AX(TV_X)`) and the walk went red
  on exactly `SAT DOWN: the television comes on`. Reverted; green again.
- `node scripts/bugsweep.mjs` — 93 shots, **zero STATION MISS**, no console or
  page errors (only the pre-existing THREE.Clock / Canvas2D / WebGL warnings).
- `npx tsc --noEmit` clean.

## Verdict on the after-images

`shots/w18-walk/2-seated-tv-on.png` — the set is lit, showing a red price card,
and it is **dead centre in the frame**. Worth saying plainly: the foot-of-bed
move was the right call and now pays off, because the seat squares up on the
television instead of watching it at an angle across the mattress. The prompt
reads `[E] stop watching TV`.

`shots/K-tv/stood-up.png` — off is dark grey-green with the diagonal sheen, not
a black rectangle. C's *"off is not black"* claim holds by eye.

## Found and did NOT fix

1. **The check's positive control was decoration — I fixed this one, but flag
   the pattern.** `--selftest` pinned `on` via `defineProperty` on the object it
   read out of `scene.userData.tv`; `apartment.ts` **replaces that object
   wholesale every frame**, so the pin was discarded within ~16 ms and the
   control printed `NOT CAUGHT — this check is decoration` against a world that
   was fine. It accused the check instead of itself. Now pins the *slot* on
   `userData` with an accessor, and goes red on `STOOD BACK UP`. I swept
   `scripts/` for the same shape: only `probes/L-games-in-artifact.mjs`, which
   pins on `window` and is safe.

2. **`ctx` still publishes no `seated()` a module can reach**, so `apartment.ts`
   infers "he is sitting down" from the player's *position*. That inference is
   the whole bug class: any future move of any seat silently kills whatever the
   seat was supposed to drive, with no error. The comment at `apartment.ts:2502`
   already asks for this. **Not fixed because `ctx.ts`/`crosstown.ts` are outside
   my item** — `__ct.seated()` exists on the entry point and would be a small
   hoist. Worth queueing.

3. **The "off is not black" assertion never actually runs.** The check reads
   `userData.tv.mat.color`, but the module publishes only
   `{ seg, fmt, i, left, pool, on, warming }` — no `mat`. So it prints *"the set
   does not publish its material"* and asserts nothing. It is currently true by
   eye (see above) and unguarded by any script. Either publish the off colour or
   sample the pixel.

4. Port hygiene: **4197, my assigned port, was already serving another builder's
   world** and answered 200 to a plain curl. I used **4193** (dev) and **4181**
   (preview). `scripts/lib/which-world.mjs` caught me pointing at a stranger's
   preview on 4184 and refused to report numbers — that guard is doing real work
   and saved a false result here.
