# BLOCKED — builder A

## Deleting the deprecated `Frontage` fields needs F to finish migrating

**What I need:** `ct/interior.ts` off the last two deprecated fields.
**From whom:** builder F, through the desk.

F is most of the way across — `ct/doors.ts` exists, three rooms declare, and the
facade doors have moved to match (verified: burger `−25.11`, diner `−46.61`,
thrift `−59.32`, all changed from the painter's own choice). That half works.

Two uses remain:

```
interior.ts:513   const dAt = spec.door.at ?? (F ? localOf(F.doorCentreM) : 0);
interior.ts:523   const e0 = localOf(F.glazingStartM), e1 = localOf(F.glazingEndM);
```

The replacements are already exported and already carry the mirror:

```ts
frontageWorld(name)   // .doorWorld, .glazingLoWorld, .glazingHiWorld — world coords
uAt(f, world)         // world → 0..1 across the frontage, if a fraction is wanted
```

**Line 513 is now safe but was luck.** It falls back to the painter's layout for
a room that has not declared, and the facade used the same fallback, so they
agreed by coincidence rather than by construction. I have closed that in
`85034da6`: `frontageOf()` now returns the door where the ROOM put it, and only
the private `layoutOf()` returns the painter's own guess. So the fallback path
is correct now whichever way it is reached — but it is still reading a field
marked `@deprecated`, and while that field exists someone will read it and
believe it.

**I will delete `doorCentreM`, `doorOffsetM`, `glazingStartM` and
`glazingEndM` the moment the desk says F is across.** I have not done it
unilaterally because it breaks F's build, and `live-integrate.sh` drops a
builder whose build fails — F's work would vanish from the world the user is
playing, mid-flight.

## Not blocked, just unfinished, and honest about it

I got **inside** the diner through its own `[E]` spot to run the user's
acceptance test — stand inside, note the door side, walk out, turn round,
confirm it swapped. The room reads correctly (counter one side, booths, window
run the other), but my camera faced along the room rather than at the front
wall, and I did not complete the comparison.

So: **the mechanism is verified end to end** — the room declares, the register
carries one world number, the painter paints its door there, and the doors
demonstrably moved. **The user's own visual test is not yet run for all three
declared rooms.** That is worth someone doing before this is called done, and it
is a better job for whoever owns the room orientation, which is F.


## The `[E]` spot may not be reading the register — pawnshop

**What I need:** someone who owns `crosstown.ts`'s `[E]` spots to check them
against `frontageWorld(name).doorWorld`.
**From whom:** the desk.

The design is three consumers of one number: painter, room, `[E]` spot. I have
verified the first two. The third I cannot: `[E]` spots are registered in
`crosstown.ts`, which is desk-owned.

Concretely: PAWN declares its door at world z **−60.50** (moved from the
painter's own −54.34, so the declaration is landing). Standing at −60.50 against
the facade and pressing E does **not** go in. Either the pawnshop has no `[E]`
spot, or it has one that is still hand-placed at the old position.

If it is hand-placed, that is the same two-places-disagree bug one consumer
over: the door is now where the room says, and the way in is where somebody
typed. Worth checking all of them, not just the pawnshop — it is a one-line read
of `frontageWorld(name).doorWorld` per spot.
