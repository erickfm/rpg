# The bank's two door faces didn't match — fixed. Eleven other rooms checked on the same axis.

Build at the start of this work: `caa3f18ce` (the row that logged this ask —
*"door of the bank doesnt match the inner door of the bank"* — after the desk's
12-of-12 "exteriors match interiors" measurement turned out to be checking
**which side** the door is on, per GOTCHAS 45, and never whether the two faces
are **the same object**: same leaf count, same material, same glazing, same
hardware).

## 1. The bank, fixed

**Before:** outside was a double door — two dark glass leaves in a brass frame
with brass push-bars, under a granite portal (`ct/bank.ts`, A's, approved and
untouched in its geometry). Inside was the kit's default: a single brown
timber leaf, a glass vision panel, and a small round pull — `ct/interior.ts`
line ~1209's hardcoded canvas, which every room gets unless it overrides it.
Different leaf count, different material, different hardware. Walk through it
and the door changed behind you.

**After**, both faces read as one design:

- `shots/M-bankdoor-outside.png` — the double brass/glass door, unchanged (A's
  approved geometry, only its paint now reads from one place instead of two).
- `shots/M-bankdoor-inside.png` and `shots/M-bankdoor-inside-close.png` — the
  interior now hangs the SAME double brass/glass door with brass push-bars at
  the meeting edge, propped open the way the kit's default was, but drawn from
  the bank's own design instead of the kit's generic one.

(Both PNGs are local-only — `shots/` is gitignored, same as every other
screenshot referenced in this repo's notes.)

### How it was single-sourced, not duplicated

Before this fix the door's LOOK was authored **twice**, matched by eye:
`ct/bank.ts`'s `placeBank` painted a 60x82 canvas with its own hex literals,
and `ct/int-bank.ts`'s `DOOR.leaf` typed `0x7a6a44`, `clearW: 1.9`, `h: 2.6`,
`leaves: 2` a second time — with a comment claiming it was "read from there
rather than matched by eye" that was **not actually true**; nothing imported
anything. That is the exact "two authorings of one fact" shape already solved
for door *position* (`VICE_DOOR_X`, `JAIL_DOOR`) and never solved for what the
door *is*.

Fix: `ct/bank.ts` now exports `BANK_DOOR` — clear width, height, leaf count,
frame colour, glass colour, glazing highlight, hardware colour, kick-rail
colour — as the **one place** this is written down. `placeBank`'s own canvas
paint reads from it instead of hand-typed hex. `ct/int-bank.ts` imports it for
two things: its `DOOR.leaf` declaration (used by the shared interior kit to
size the wall opening — this part already worked before this fix, since the
declared numbers happened to be typed correctly), and for the **visual** leaf
it now hangs in place of the kit's default. The two faces cannot drift apart
by a builder matching one to the other by eye, because there is only one
object to read.

The interior leaf itself follows the pattern four other rooms already
established for the same problem (casino, hotel, pawn, library): hide the
kit's default single-leaf mesh (`ct/interior.ts` draws it regardless of what a
room declares — it only reads `LEAF` for width/height, never for colour, leaf
count or glazing) and hang the room's own, built with `leafPair` from
`ct/vice.ts` for the mirrored-leaf geometry (a general helper, already used
cross-owner by casino and hotel; importing it does not edit `vice.ts`).

**Ownership:** `int-bank.ts` is M's, `ct/bank.ts` is A's. Both were edited
under the bounded exception granted for this task, scoped to the bank's two
door faces — nothing else in either file was touched, and `git status` shows
only `src/proto/ct/bank.ts` and `src/proto/ct/int-bank.ts` changed, plus two
new **add-only** investigation scripts (`scripts/M-bank-door-faces.mjs`,
`scripts/doorlook12.mjs` — the latter is the general "outside + inside, every
room" rig used for part 2 below, kept because nothing like it existed and it
is generally useful, not just to this task).

**Verified:**
- `npx tsc --noEmit` clean, `npx vite build` clean.
- `node scripts/M-bank-int-walk.mjs` (the room's own assertion suite):
  **54 of 54 passed**, including "no page errors and no kit warnings for this
  room" — the leaf-hide traversal found exactly one kit mesh to hide, as
  expected.
- `node scripts/bugsweep.mjs`: 93 shots, **zero STATION MISS**, zero new
  console errors (only pre-existing THREE.Clock/Canvas2D/WebGL driver
  warnings that appear on an unmodified tree too).
- `node scripts/doormatch12.mjs`: unchanged — still 12/12 on the position
  axis it measures, as expected, since no door moved.

## 2. The twelve-room survey — leaf count, material, glazing, hardware

Method: `scripts/doorlook12.mjs` stands outside each door (using
`window.__ct.doors()`, so the camera is aimed from the world, not from a
typed coordinate) and looks at it, then stands inside each room (using
`window.__ct.roomDims()`) and looks back at the same door. Read by eye, the
same way the user's own before/after screenshots settled the bank. Shots:
`shots/doorlook-<room>-out.png` / `-out-close.png` / `-in.png` (gitignored,
local-only, all 12 rooms captured on build `caa3f18ce+`).

| room | outside | inside | verdict |
|---|---|---|---|
| **bank** | 2 leaves, brass frame, dark glass, brass push-bars | 2 leaves, brass frame, dark glass, brass push-bars | **MATCH — fixed this session** |
| bodega | 1 leaf, tan/aluminium frame, full glass, OPEN sign, no visible hardware | **no leaf at all** — chamfered door, kit draws only a frame + daylight panel + threshold, permanently "open" | **MISMATCH — leaf presence** |
| burger | 1 leaf, dark plastic frame, full glass, horizontal plastic push bar | 1 leaf, brown timber frame (kit default), partial glass (vision-panel), small gold pull | MISMATCH — material + hardware |
| casino | 2 leaves, gold frame, bronzed glass, gold pulls | 2 leaves, gold frame, bronzed glass, gold pulls | **MATCH** (already fixed by G, `int-casino.ts`) |
| church | 2 leaves, dark wood, no glazing, brass strap hinges/pulls | 1 leaf, brown timber (kit default), large glass pane, small gold knob | MISMATCH — leaf count + glazing + hardware |
| diner | 1 leaf, steel/aluminium frame, full tinted glass, chrome bar | 1 leaf, brown timber (kit default), partial glass, small gold knob | MISMATCH — material + hardware |
| hotel | 2 leaves, bronze frame, full glass, gold pulls | 2 leaves, bronze/black frame, full glass, gold pulls | **MATCH** (already fixed, `int-hotel.ts`) |
| jail | 2 leaves, steel, riveted, **no glazing** | 1 leaf, brown timber (kit default), glass vision panel, small gold knob | **MISMATCH — leaf count + material + glazing** (same shape the bank had) |
| library | 2 leaves, dark wood, brass push-plates, no glazing in leaves | 2 leaves, dark wood, brass push-plates, no glazing | **MATCH** (already fixed, `int-library.ts`) |
| pawn | 1 leaf, solid dark panel, barred squint, small pull | 1 leaf, solid dark panel, barred squint, gold pull | **MATCH** (already fixed, `int-pawn.ts`) |
| tax | 1 leaf, aluminium/grey frame, full glass (blinds visible) | 1 leaf, brown timber (kit default), partial glass, small gold knob | MISMATCH — material + hardware |
| thrift | 1 leaf, dark frame, horizontal light band across mid-height | 1 leaf, brown timber (kit default), partial glass, small gold knob | MISMATCH — material + hardware |

**5 of 12 match. 7 of 12 don't** — more than the "name one room" that started
this, as the task predicted.

### The pattern behind six of the seven

`ct/interior.ts`'s default door leaf (~line 1202-1229 as of this build) is a
**hardcoded** canvas — brown fill, a glass rectangle, a small gold pull — and
it is drawn **regardless of what the room declares**. `doorLeafFor()` /
`DoorLeaf` (`ct/doors.ts`) already exists and is already read for **sizing**
the wall opening (`clearW`, `h`), but the kit never reads `leaves`, `frame` or
`glazing` for the VISUAL. Five rooms now escape this by hiding the kit's mesh
and hanging their own (casino, hotel, pawn, library, and — as of this
session — bank). **Six do not**: burger, church, diner, jail, tax, thrift all
show the same brown-timber-with-a-knob leaf inside, whatever their actual
front door looks like. jail is the sharpest case — it already **declares** the
correct leaf (`leaves: 2, frame: steel, glazing: 'none'`, matching its real
riveted double door) but nothing in `int-jail.ts` applies it, so the
declaration is dead weight and the room still shows the kit default. That is
the exact bug the bank had, in a room whose owner (O) already did the hard
part.

**This is not mine to fix.** `ct/interior.ts` is F's; `int-jail.ts`/`jail.ts`
are O's; the four shopfront exteriors (burger, diner, tax, thrift) paint
through `ct/street.ts` (D) and shared painters in `ct/tex-world.ts` (A);
church's exterior is `ct/civic.ts` (E). Reported, not touched — this survey
crosses eleven owners' files by reading them, none by editing them.

**One fix in `ct/interior.ts`** — make the kit's default leaf actually read
`LEAF.leaves` / `LEAF.frame.colour` / `LEAF.glazing` instead of hardcoding
brown/glass/knob — would very likely close burger, church, diner, jail, tax
and thrift's mismatches in one pass, and make the five existing per-room
"hide the kit leaf, draw our own" workarounds (now six, counting the bank)
no longer necessary duplication. That is a judgement call for F, not
something done here — `ct/interior.ts` is outside every exception this task
granted.

### bodega, separately

Not the same root cause. The bodega's door sits on a 45-degree chamfer
(`chamfer: { door: true }`), and `ct/interior.ts`'s chamfer branch **never
draws a leaf at all** — by its own comment, it gives a chamfered opening
"daylight beyond, a frame around, and a threshold underfoot" instead, because
the alternative (a blank corner of wall) tested worse. That means every
chamfered room's doorway reads as permanently open from inside, which is a
defensible design choice in general but does not match a real closed glass
door with an OPEN sign on the outside. Flagged as a design question, not
asserted as a bug — jail is also chamfered and its interior ALSO shows no
leaf at its threshold, independent of the timber-vs-steel mismatch reported
above for jail's visible default leaf; the two jail findings are different
things.

## 3. What was and wasn't touched

- Fixed: `src/proto/ct/bank.ts`, `src/proto/ct/int-bank.ts` — the bank's two
  door faces, under the bounded exception this task granted.
- Added (not owned by anyone, add-only per project convention): two
  investigation scripts, `scripts/M-bank-door-faces.mjs` and
  `scripts/doorlook12.mjs`.
- Not touched: every other room. Reported above with file + owner for each of
  the six mismatches plus bodega's separate finding.
- `notes/LEDGER.md` not edited, per instructions — the desk moves rows.
