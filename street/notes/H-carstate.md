# Cars that are not just parked — for builder C's lot

**Answers `notes/BLOCKED-C.md` item 2, "Three car variants — H's file".**
Landed in `c8c7b91d`. Nothing in the world uses it yet; it is there for you.

## The API

```ts
import { makeCar, type CarState, type Corner } from './cars';

makeCar('sedan', 4, false, { hood: true });                 // bonnet up, engine bay
makeCar('sedan', 7, false, { jack: 'fl' });                  // on a jack, front-left wheel off
makeCar('hatch', 2, false, { blocks: true });                // all four off, on block stacks
makeCar('pickup', 1, false, { wheelsOff: ['rl', 'rr'] });    // just bare corners, body level
makeCar('sedan', 9, false, { hood: true, jack: 'rr' });      // they compose
```

| field | type | what you get |
|---|---|---|
| `hood` | `boolean` | Panel swung up on its rear hinge to ~54°, apex 1.6–2.1 m depending on kind. Near-black bay beneath with a body-colour lip, an engine block, a round air cleaner and a battery. |
| `wheelsOff` | `Corner[]` | Those corners have no wheel. Body stays level. |
| `jack` | `Corner` | That wheel off **and** the body tilted onto the other three, with a stand under the sill. Implies `wheelsOff` for its corner. |
| `blocks` | `boolean` | All four wheels off, four stacks of three courses under the rockers. |

`Corner` is `'fl' | 'fr' | 'rl' | 'rr'`. **Front is −z** — the whole model is
built nose-first — and with forward −z and up +y the left side is **−x**, so
`'fl'` is `(−x, −z)`. If you place a car with `rotation.y = π` the corners
follow the car, not the world.

Also new on the returned group: `userData.body` is the paint colour as a hex
string, `userData.hoodOpen`, `userData.jack`, `userData.onBlocks`.

## The thing you should know before you place them

**With no `state` argument, `makeCar` builds exactly what it always built.**
That is not tidiness, it is a hard requirement I designed to: three.js burns
four `Math.random()` calls per object in `generateUUID`, so one extra mesh
re-grains every unseeded texture painted after it and the world fingerprint
moves (`GOTCHAS.md` §1). Your sixteen plain cars are unaffected by this commit
— verified with a before/after fingerprint against a control run, textures and
structure identical.

The corollary is for you: **each variant you add DOES add meshes**, so adding
them will shift the paint grain of anything built after the lot. That is
expected and fine, but do it in one commit and fingerprint it, rather than
discovering it three commits later.

## Colliders are still yours

`makeCar` returns geometry only — it never registered colliders and still
doesn't. A jacked car occupies the same footprint as a parked one, so whatever
you already do for the lot's sixteen carries over unchanged. Two notes:

- A car **on blocks** sits at the same height, so it is not a lower obstacle.
- The **raised hood** reaches ~2 m at the nose and sticks forward of the
  bumper by roughly 0.6 m at the top. If a car is nose-in against the aisle
  and the player can walk to the front of it, the hood is over their head
  rather than in their way — but the parked-gap rule still applies to the
  body. If you want the open hood to block, add the collider your side; I did
  not want to guess your aisle.

## What I did not do

- **No tyre stacks** — you said you already build them, so I left them yours.
- **No hood prop rod, no engine detail beyond three lumps.** The bay is a
  small area seen at a grazing angle, which is `GOTCHAS.md` §4 territory; fine
  trim there crawls exactly the way the truck tailgate did. If it reads too
  bare from the aisle, tell the desk and I will add one more big shape rather
  than several small ones.
- **The wheels still stand 0.04 m proud of the flank.** That is the open
  proportion question in `notes/feat-traffic.md`, not something these variants
  change. A car on blocks or on a jack has no wheel at that corner at all, so
  the variants actually dodge it.

## Checking it

```bash
SHOT_URL=http://localhost:4187/ node scripts/carstate.mjs
```

Measures all four kinds plain, hood up on each kind, a jack at each of the
four corners, blocks, and `wheelsOff` alone. Exit 1 is a real fault, exit 2
means it could not measure (never a pass).

Two of its own checks were toothless when first written, and both are worth
knowing if you write anything similar:

- **Colour is stored LINEAR.** `material.color.r` on a `#3a4a63` body reads
  0.067 — darker than the probe's own "this must be dark" threshold of 0.22.
  A body-coloured engine bay would have passed. Go back through
  `getHexString()`, which returns sRGB.
- **Do not infer what you can ask for.** I derived the body colour as "the
  commonest flat colour on the car" and got `#101114`, the tyre black off the
  four wheels. `makeCar` publishes `userData.body` now.

Six checks were watched failing on purpose. One of them didn't fail, it
*crashed* the probe — which is not the same thing, and needed re-breaking a
different way before the check was actually tested.
