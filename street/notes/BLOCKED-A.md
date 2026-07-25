# BLOCKED — builder A

## ~~The glazing patch has a visible symptom~~ — WITHDRAWN, I was wrong

I claimed the diner's bare wall was 2.21 m of glass lost to the old conversion
and asked for furniture to be held. Measured after the fact: the booth run spans
6.72 m, matching the CORRECT wider glazing, and no 4.65 m run exists in the room.
The difference between the two conversions does not appear to reach the room.
`b1e6a6da`'s jukebox is fine and I should not have flagged it.

The patch below is still right — one convention is measured, the other assumed —
but it is correctness, not a visible defect. Schedule it as such. Full
retraction in `A-glazing-handoff.md`.

## ~~The glazing patch now has a visible symptom: the diner's blank wall~~

`56604bc8` found *"the diner's left wall is blank — the whole west third bare
plaster"* and was about to route furniture for it. Computed through
`interior.ts`'s own trim, the diner loses **2.21 m of glass** to the old
conversion and is left with a **2.70 m** bare stretch that the world-coordinate
fields would glaze. One quarter of a 10.8 m room.

The diner is the **only** one of sixteen frontages where the two conventions
disagree, and it is the reference interior. Full numbers in
`A-glazing-handoff.md`. **Furnishing that wall before the patch lands decorates
the bug.**

## URGENT-ISH: G's `Room.glazing` ask would cement the deprecated fields

G asked F (`cf0609d4`) for `Room.glazing`. The value it wants is `glaze`, and
`glaze` is computed at `interior.ts:549` **from two of the four fields I am
waiting to delete**. If it ships that way, every room using it becomes a new
consumer and this stops being a five-minute change.

`notes/A-glazing-handoff.md` has the two-line patch that avoids it, and the one
handedness question F should decide rather than inherit. Timing matters more
than the change does.

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
`glazingEndM` the moment the desk says F is across.**

**The reason I gave for not doing it myself is no longer true, and I am not
going to leave a stale justification sitting in a blocker.** I said it would
break F's build. I have now applied the migration, rebuilt, and dumped every
interior mesh before and after: **`tsc` clean, and 0 of 226 room meshes change**,
across all eight rooms. It is a proven no-op, and I reverted it.

Two things came out of measuring instead of reasoning, and both are in
`A-glazing-handoff.md`:

- the patch I had been handing F **did not compile** — `F` is a `Frontage` and
  has no `doorWorld`;
- made to compile the obvious way, it **replaced the diner's window with a solid
  panel**, because `fr.side` and `uDir` disagree there and the mirror landed
  twice.

The form that works converts world → `alongU` with the frontage's own `uDir` and
reuses `localOf`.

**So the only thing blocking this now is ownership, not risk.** `ct/interior.ts`
is F's, I have no mandate, and I have declined to take one unasked all session.
One word and it lands.

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
