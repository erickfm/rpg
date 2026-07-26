# BLOCKED — builder G

Two blockers, both one line in somebody else's file, both on the library and
church that just moved to me. I am building everything that does not depend on
them meanwhile; this file exists so the two asks are visible rather than buried
in prose.

---

## 1. ~~The library's stair~~ DONE — and my "blocked one layer down" was wrong

F delivered `RoomSpec.floor` in `bd3ee7d7a` and it works end to end. The library
has its stair and gallery: you climb 2.65 m and look down over a balustrade into
the reading room.

**I filed a blocker against it that did not exist, and the mistake is worth
keeping.** I reported that room levels reached the world's picker but not the
player, with a trace showing `groundAt` returning 1.33 / 2.41 / 2.90 up the
flight while "the player's y stayed at 1.62 for the whole climb". Both numbers
were real. The second was not the player's height.

`__ct.pos()` returns **four** values — `[x, y, z, gy]` — and the fourth is the
ground height. `y` is the camera's eye height, which is constant *by
construction* because it is measured from the floor the player is standing on.
So the quantity I was watching for a change is the one quantity in that tuple
that cannot change. Read `pos()[3]` and the climb is there: 0.25 at the foot,
2.90 at the top.

I then took working geometry back out of the room on the strength of it, and
wrote a paragraph in `ct/int-library.ts` explaining why the stair could not be
built. All of it had to be undone.

**The lesson is the same one as GOTCHAS §26 and §34, in a new place:** a
measurement that never moves is not evidence of a stuck world, it is a reason to
check what you are measuring. A constant is exactly what a correct eye height
looks like. My own harness reads `(await pos())[3]` for landings — the right
value was already being used ten lines from code I wrote — and I reached for
`[1]` because it is called `y`.

## 2. Window numbers for the library and the church

The user's instruction was *"the interior windows must agree with the exterior E
built — ask me for numbers rather than reading E's file"*, so I have asked twice
and am recording it here rather than asking a third time in prose.

**Library — the high arched windows:**

- sill height and head height above the interior floor
- clear width of each opening, and the arch's rise
- how many, on which walls, and their spacing or centres

**Church — the lancets and the rose:**

- lancets: sill and head height, clear width, count per wall, spacing
- the rose: centre height, diameter, and which wall it is in

Everything in both rooms that is not a window is being built now. The openings
are the only thing waiting, and they are the thing that has to agree with what E
already put on the outside.

---

## Not blockers, but still open and not mine

- **`ct/doors.ts` has no owner** and the door-drop class is still live:
  `civic-doors.ts`, `interior.ts` and `world.ts` resolve to an UNDEFINED
  namespace at collection time in the built bundle. Nothing is dropped today —
  `doors-declared` reads 10 of 10 — but the mechanism that lost GOLDEN ACES' door
  once is still there.
- **`props.ts:420`** computes `selfLit` from a material's texture only, so an
  untextured author-driven light cannot declare itself. One line, B's call:
  `const selfLit = isSelfLit(m.map) || m.userData.selfLit === true;`. Measurements
  in `notes/G-nightgrade-bulbs.md`.
