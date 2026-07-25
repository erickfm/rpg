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


## CORRECTION, and one real gap: the pawnshop has no way in

**I got the location wrong in the previous version of this note** and am
fixing it rather than leaving the desk chasing the wrong file. The `[E]`
spots are NOT in `crosstown.ts`. They are registered in `ct/interior.ts`
(F's), and its own comment says they are *"derived from the SAME published
door centre the painter draws with"*. So the third consumer of the frontage
number is wired correctly by design — the mechanism is fine and I was wrong
to suggest otherwise.

The real observation stands, though, and it is narrower:

**PAWN declares its door at world z −60.50** — the declaration lands, the
facade moved there from the painter's own −54.34. But standing against that
facade and looking at it produces **no `[E]` prompt at all**, at 6.25, 6.1 or
5.9 m out (the spot is documented as standing 0.75 m off the plane, and the
trigger radius is 1.05, so all three should have caught it).

So the pawnshop has no way in. That is consistent with `BLOCKED-G.md`, which
described `int-pawn` as finished but door-blocked. It is F's or G's to close,
not the desk's, and not mine — I only note that of the five declared rooms it
is the one you cannot reach, so its mirror cannot be checked by walking in.

**What I verified instead:** three of five rooms mirror correctly (A-1 TAX,
diner, burger barn), reached through their own `[E]` spots. THRIFT is
reachable but its front wall cannot be framed from inside without the camera
ending up in a clothing rack.
