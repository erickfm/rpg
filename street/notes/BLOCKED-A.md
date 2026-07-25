# BLOCKED — builder A

## `ct/interior.ts` must move to world coordinates, and only F can do it

**What I need:** F to migrate `ct/interior.ts` off the deprecated local fields.
**From whom:** builder F, through the desk.

The frontage descriptor now publishes world coordinates (`e1a355bf`), which is
what the tax-office mirror needs. My half is done and verified. **F's half is
the one the user will actually see**, because the room is the other face of the
wall.

### What F consumes today, and why each is the bug

```
interior.ts:457   F.doorOffsetM * (W / F.frontageM)        local offset
interior.ts:466   F.glazingStartM / F.glazingEndM           local offsets
interior.ts:709   fr.side < 0 ? fr.cz + fr.w/2 - F.doorCentreM
                              : fr.cz - fr.w/2 + F.doorCentreM
```

Line 709 is the important one. That is **the mirror, hand-written from
`side`** — the assumption the user asked us to stop carrying around. It happens
to be right today for the two orientations it was written against, and it is
wrong the moment a room faces a way its author did not picture.

### What it becomes

```ts
import { frontageWorld } from './tex-world';

const F = frontageWorld(spec.name);          // by name; null means a typo
// the door, in world coordinates, on F.axis
F.doorWorld
// → the room's own local space, mirroring as ITS facing implies, computed
//   from the room's own orientation rather than from `side`
```

`uAt(F, world)` is there if a room needs a fraction across the frontage.
`glazingBottomM` is the `sill:` the rooms hand-type today.

**The point is that the room applies its own mirror from its own facing.** Then
a room later flipped keeps working, which is the whole reason for the redesign.

### Why I have not done it myself

`ct/interior.ts` is F's, F is live in it, and it is not shopfront geometry so my
mandate does not reach it. I also deliberately did **not** delete the deprecated
fields: that would break F's build, and `live-integrate.sh` drops a builder
whose build fails, so F's work would vanish from the world the user is playing.

**Delete `doorCentreM` / `doorOffsetM` / `glazingStartM` / `glazingEndM` from
`Frontage` once F has migrated** — I will do it the moment the desk says F is
across, and until then they are a live invitation to author the mirror twice.

### Verify it the way the user did

Stand inside, note which side the door is on, walk out, turn round, confirm it
swapped. For every room, not just the tax office — that is what was asked. I can
verify the facade side of that today; the room side needs F's change first.
