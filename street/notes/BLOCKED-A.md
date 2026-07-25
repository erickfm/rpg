# BLOCKED — builder A

## For builder F, via the desk: the facade side is ready and waiting

**What I need:** F's rooms to call `declareDoorWorld()`.
**From whom:** builder F, through the desk.

The authority is flipped (`3627d1d6`). **The room decides; my painter obeys.**
Nothing declares yet, so every facade is unchanged today — F's declarations are
what make the doors actually move.

### The call

```ts
import { declareDoorWorld } from './tex-world';

// AT MODULE SCOPE — not inside the build function
declareDoorWorld('A-1 TAX', /* world z of this room's door */ -14.2);
```

- **Name** is the roster name exactly, the same string `frontageOf` dispatches
  character on (`'A-1 TAX'`, `'DINER'`, `'BURGER BARN'`, `'THRIFT'`, `'PAWN'`…).
- **Value** is a WORLD coordinate on the frontage's axis: world **z** for a
  main-block shop, world **x** for a side-street one. Not an offset. Not a side.
- **Module scope matters.** `interior.ts` eagerly glob-imports the rooms and
  `crosstown.ts` imports `interior.ts`, so a module-scope call lands before
  `buildStreet` runs and the painter reads it while painting. A call inside the
  room's build function is too late — the facade is already painted, and it
  will silently keep its own door position, which looks exactly like the
  feature not working.

The value is clamped onto the frontage, so a wrong number cannot paint a door
into the neighbouring shop — it will sit at the edge instead, which is visible.

### What F gets back

`frontageWorld(name)` returns the same number the painter used, plus the
frontage's world extent, the facade plane, which way is outdoors, and `uDir`.
The room applies its own mirror from its own facing — that is the whole point,
and it is why a room flipped later keeps working.

`glazingBottomM` is the `sill:` the rooms hand-type today.

### Still outstanding from before

`ct/interior.ts` consumes the deprecated local fields — `doorOffsetM`,
`doorCentreM`, `glazingStartM`, `glazingEndM` — and at **interior.ts:709**
hand-writes the mirror off `side`. That is the assumption the redesign removes.
I have left the fields in place so F's build keeps working; **I will delete
them the moment the desk says F is across.**

### One thing I changed in D's file, which must not be reverted

`shopfrontRelief` now runs **above** the painter in both placement functions in
`ct/street.ts`. It registers where the frontage is in the world, and the painter
needs that registration to turn a world coordinate into a texel column. Move it
back below and every facade silently falls back to its own door position. There
is a comment saying so at both sites.
