# w11 → desk: item 9c, "a dead dais box left in the church"

## Root cause, in one line

`ct/int-church.ts` built the chancel platform **twice**: once as a lone
`dais` box (`BoxGeometry(6.4, 0.18, 2.6)`) placed at local `(0, 0.09, hd -
2.2)` — the **door end** of the nave — from the room's original, wrong-end
chancel attempt (before the altar-end convention got corrected), and again,
correctly, as the nave-width platform later in the same file (`"Altar and
chancel step"`, local `z` from `-hd` to `CHANCEL_Z`, its own dedicated
`slabTex`). The first one never got deleted when the second, correct one was
built; it just sat there, geometrically stranded 19.4 m from the altar it was
originally meant to be, with no functional role.

## Why it is safe to delete

- **Unreferenced beyond its own declaration.** `grep -n "dais\|stoneTop"` on
  the file, before the edit, showed the `dais` variable and the `stoneTop`
  texture it alone consumed used nowhere else — no `solid()` collider, no
  later mesh reads either name. (Two unrelated later uses of the word "dais"
  in prose comments, lines 108 and 188, are informal references to the altar
  area in general, not to this variable — left alone, out of this item's
  scope.)
- **The real platform already covers the ground it stood on.** The
  nave-width box built later (`room.W x CHANCEL_Y x (CHANCEL_Z - (-hd))`)
  spans the whole sanctuary depth and is what the altar, rail and pews
  actually key off (`CHANCEL_Y = 0.18`, the same step height, added manually
  by every real sanctuary object per the file's own comment at line 188).
  Nothing depended on the door-end box for elevation, geometry or texture.
- **`altar`'s own placement comment independently confirms the same historical
  bug**: it documents the altar itself once sitting at the wrong end
  (`hd - 2.4`) before being corrected to `-hd + 2.4`. The `dais` box's
  coordinate (`hd - 2.2`) was simply never given the same correction.

## Verified

- `grep -n "dais\|stoneTop"` after the edit: no code references remain (only
  the two pre-existing unrelated prose mentions).
- `npx tsc --noEmit`: clean.
- `npm run build`: clean (same pre-existing bundle-size/dynamic-import
  warnings as before the edit, unrelated).
- `node scripts/interiors-walk.mjs church` on dev: **25/25 passed**, identical
  to before the edit (queue item 5d recorded 25/25 too).
- `node scripts/bugsweep.mjs` on dev: 0 STATION MISS, 0 console errors.
- New `scripts/w11-dais-gone.mjs`: a structural scan of `window.__ct.scene()`
  for any mesh still carrying `BoxGeometry(6.4, 0.18, 2.6)` — **0 matches**
  after the edit (script exits 1 if any are found, so it stays a real check,
  not a description). Also warps to the door-end nave floor for a look;
  `shots/w11-church-rear.png` (gitignored, not attached) shows flat flagstone
  with no floating slab.

## Found but not fixed

Nothing further found in this file worth flagging beyond what item 5d already
routed. The comment at line 188 ("the dais, the rail, the tabernacle") reads
slightly oddly now that there is no local `dais` variable — it was already
using the word informally for the altar table before this edit, so left as
is; a future pass through this file could rename it for clarity but it is
not a defect.

## Derived vs. copied

Nothing copied. The removed box's dimensions and position were read directly
out of the file being edited, not retyped from a screenshot or another note.

---

*w11. Touched: `ct/int-church.ts` (the file this item grants). New file:
`scripts/w11-dais-gone.mjs`.*
