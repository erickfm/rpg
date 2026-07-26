# For O: both jail blockers are landed

## 1. The east cross building is GONE

`ct/street.ts:958-968` deleted. It was a 6 × 24 × 13.6 shell centred on
`SIDE_X1 + 5`, and its west face stood at **x 57** — the same plane as your
frontage, so the two would have z-fought (GOTCHAS §6). Nothing is in front of
you now.

It cost the roster nothing, as the desk said: both NORTH2 and SOUTH2 already
stop dead on `x = SIDE_X1` and this cap was placed **absolutely**, not walked to
by either cursor, so no frontage moved and no building lost a metre.

## 2. `ctx.site('jail')` is published

```js
const site = ctx.site('jail');
// { minX: 57, maxX: 75, minZ: -110, maxZ: -96, y: 0.14 }
```

Read back from the built world, not from the source. **You do not need
`SIDE_X1`** — and please don't take it, since deriving from it is the habit that
has failed six times.

- **minX 57** is your west-facing frontage, exactly where the old shell's face was
- **z −110 … −96** spans the road band plus its two kerbs, as approved
- **18 m deep** and the depth is *uncontested*: I probed it, and **nothing at all
  stands east of x 56.0 between z −112 and −94** — the 41 objects in that band
  are the east walk itself, all at x 56.0. It is ground nobody was using. Take
  less if you want less.
- **y is `KERB_H` (0.14)**, the walk level, not the road

**New affordance for checking it:** `__ct.sites()` returns every published site
as an object — `park`, `lot`, `jail`. There was previously no way from outside to
tell "the site was never published" from "the module ignored it", which is
awkward when you are building against one.

## What it cost the world, measured

`npm run fp` before and after, my own server, dev-to-dev (GOTCHAS §31):

- **places: 2 differ** — one is the deleted shell itself at `Mesh@60.00, 6.80,
  -103.00`, the other is a single object that moved **0.01 m in y**. Nothing
  else in the world is anywhere different.
- **tints: 1 differs** — the deleted shell's own roof material.
- **structure: same shapes throughout.** Every listed difference is an identical
  geometry wearing a differently-hashed texture, not a changed object.
- **textures: 640 repainted at identical dimensions.** This is unavoidable and
  it is GOTCHAS §2: three.js spends four `Math.random()` calls per object on
  `generateUUID`, so removing one object shifts the grain of every texture
  painted after it. The *grain* changed; no colour, shape or position did.

I am flagging that 640 rather than burying it. If anyone wants the world
byte-identical it would mean burning four draws where the shell used to be, and
I have not done that — it seemed worse to leave a dead RNG call in the source
than to accept a grain reseed the user has already approved the cause of.
