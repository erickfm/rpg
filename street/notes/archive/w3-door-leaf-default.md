# The kit's default door leaf ignored its own room's declaration — partly fixed

Item 2 from `notes/QUEUE.md`, file `ct/interior.ts`. Build at commit
`917522823`.

## Root cause, one line

`ct/interior.ts`'s default door-leaf mesh (~line 1210) painted a hardcoded
brown-timber-with-a-vision-panel canvas for every room, reading the room's
declared `LEAF` (from `doorLeafFor`, `ct/doors.ts`) only for `clearW`/`h`
(sizing the wall opening) and never for `frame.colour` or `glazing` — the
two fields that decide what the leaf actually looks like. So every room
that had not already hidden-and-replaced this mesh itself showed the exact
same brown timber leaf regardless of what its exterior showed.

## What changed

The default leaf's canvas now reads `LEAF.frame.colour` for its fill and
`LEAF.glazing` (`none` / `vision-panel` / `half` / `full`) for how much
glass to draw, each mapped to a rect in the 32x64 texel canvas. A room that
has never declared a `leaf` gets exactly the previous default (`doorLeafFor`
falls back to timber/vision-panel), so this is additive — nothing changes
for a room until its own `DOOR` speaks up.

**jail** is the only currently-declared room this visibly changes (it
already declares `frame: steel, glazing: 'none'`, matching its real riveted
grey double door): before, brown timber with a window; after, a plain
steel-grey leaf with no glazing. Verified by eye,
`shots/doorlook-jail-in.png` vs the pre-fix description in
`notes/door-faces-match.md`.

## What I tried and reverted, and why — read this before extending it

The item also asked for `LEAF.leaves` (1 vs 2) to be honoured, which would
have fully fixed jail's leaf COUNT (it declares 2). I built that version
using `leafPair` (imported from `ct/vice.ts`, general helper, not owned by
me) to hang a real mirrored pair when `LEAF.leaves === 2`.

**It broke three rooms that were correct before this task**: bank, casino,
library. All three already hide this kit's default leaf and hang their own
custom one — they `room.group.traverse` for a `PlaneGeometry` mesh whose
material's texture image is 32×64, and hide it **only when they find
exactly one**. Once the kit itself started drawing two meshes for a
`leaves: 2` room, their traversal found two, hid neither, and their own
leafPair door rendered on top — two visible doors stacked in each room.
Measured, not guessed: `SHOT_URL=http://localhost:4182/ node
scripts/bugsweep.mjs` printed `[interior:bank] expected 1 kit door leaf to
hide, found 2` (and the same for casino, library) the moment the two-mesh
version landed. Screenshots of `doorlook-bank-in.png` etc. confirmed the
visual duplicate before I reverted.

I reverted to a single mesh (frame colour + glazing only) specifically to
preserve the "exactly one hideable kit mesh" contract those three rooms'
own files depend on — a contract this item does not have license to change,
since it lives in `int-bank.ts` (M), `int-casino.ts` (G) and
`int-library.ts` (J), none of which this item names.

**Consequence: jail's leaf COUNT is still wrong** — one leaf, correctly
coloured and glazed now, where the real door has two. Closing that needs
one of:
- give `int-jail.ts` (O's file) the same "hide the kit's one leaf, hang
  `leafPair`'s own" recipe the other five already use — proven, low-risk,
  bounded to one file the desk already trusts with this pattern; or
- add an explicit opt-out the kit understands (e.g. a `spec.hideDefaultLeaf`
  flag) so a room can tell the kit not to draw a leaf at all, removing the
  count-based guessing entirely — a slightly larger, more durable fix that
  touches the same four files (`ct/interior.ts` plus the three overriding
  rooms) in one coordinated commit.

Not touched: burger, church, diner, tax, thrift. None of them has declared
a `leaf` in its own `DOOR` yet (confirmed by grep — only jail, casino,
hotel, library, pawn declare one), so `doorLeafFor` still falls back to the
old default for all five and this fix has no effect on them yet. Each
still needs its own owner (burger/diner/thrift = F, tax = G, church =
unclear/E-adjacent) to declare what its real door is, in its own file —
this item names only `ct/interior.ts`.

## Verified

- `npx tsc --noEmit`: clean.
- `npx vite build`: clean (pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` /
  chunk-size warnings only, unrelated).
- `SHOT_URL=http://localhost:4182/ node scripts/doorlook12.mjs`: all 12
  rooms shot without error. Looked at every `-in.png` by eye: jail improved
  (steel, no glazing), bank/casino/library/hotel/pawn/burger unchanged from
  their pre-fix appearance, no duplicates.
- `SHOT_URL=http://localhost:4182/ node scripts/bugsweep.mjs`: 93 shots,
  zero STATION MISS, zero new console warnings (checked specifically for
  the `kit door leaf` warning family — none).
- Repeated the same bugsweep against `npx vite preview` on port 4183 (the
  **built** bundle, not just dev) — same result, zero STATION MISS, zero
  new warnings.

## Derivation

`frame.colour` and `glazing` are read directly from the `DoorLeaf` object
`doorLeafFor()` already returns (`ct/doors.ts`) — no value was duplicated or
hand-retyped. The glass-rect table (`GLASS`) is new geometry I chose (pixel
rects in the existing 32×64 canvas), not a copy of anything else in the
codebase.
