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

## 1b. FOUND: the player cannot pass local z 13.00 inside a room

Filed twice as "a room deeper than ~20 m loses its way-out door, and I cannot see
why", with a theory attached. The theory was wrong and bisecting killed it. Here
is the actual shape, for whoever owns the movement code.

**Walking at the way-out door from inside, casino, one depth per run:**

| d | player comes to rest | way-out spot | E |
|---|---|---|---|
| 22 | 10.82 — its own front wall | 10.45 r 1.05 | out |
| 24 | 11.81 — its own front wall | 11.45 r 1.05 | out |
| 26 | 12.80 — its own front wall | 12.45 r 1.05 | out |
| 28 | **13.00** | 13.45 r 1.05 | out |
| 29 | **13.00** | 13.95 r 1.05 | out |
| 30 | **13.00** | 14.45 r 1.05 | **STUCK** |

**The player is clamped at local z 13.00.** Below about 26 m the front wall is
nearer than that, so the clamp never shows and every room behaves. Above it the
player stops 1–2 m short of their own wall, and the room keeps working only for
as long as the trigger is wide enough to reach someone stranded there: at d 30
the spot starts at 13.40 and the player is at 13.00, so the door is 0.40 m out of
reach and **you can enter that room and not leave it**.

Note d 28 and d 29 pass *by luck* — the trigger happens to still cover 13.00.
Only up to 26 does the player actually reach the wall.

**Not the room.** The wall colliders derive correctly from `hd`
(`ct/interior.ts:778`); the only colliders across the doorway are the front wall
and the threshold; the trigger radius is not it (1.75 covers it and breaks the
outside landing instead). The clamp is in whatever bounds the player inside the
interior belt.

**What I did with it.** The casino ships at **26 m**, the deepest value where the
player reaches their own front wall rather than relying on the clamp being
covered — up from the 19 m I had shipped on the strength of the wrong theory.
The hotel at 26 m was checked and is fine.

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
