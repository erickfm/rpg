# w2 — item 0 (urgent): "the jail has empty gaps around it"

**Root cause, one line:** the walkability fix that shrank `JAIL.DEPTH` from
12 m to 4 m (correctly — the old value made two-thirds of the site solid and
unwalkable) left the building's own north/south end walls only 4 m deep, so
past them is 9.65 m of open yard and then only a 2.4 m fence — nothing fills
the other 11+ m of height for the rest of that run, so from any angle that
is not dead-centre down the side street you look straight past the building
into open sky where 8 m of solid building used to stand.

## Measured before touching anything

`scripts/w2-jail-look.mjs` (new) walks a set of oblique/3-quarter camera
stations around the site and screenshots each. Station `along-south-flank`
(58, -111), looking east along the flank line, showed the building's stone
pier ending abruptly on the right with **open sky filling roughly 55% of the
frame** to the left — no ground horizon, no fence, no wall, just sky, for
the full height of the building. `down-the-yard` (68, -103, facing south)
showed the same: a wall of open pale blue filling most of the frame.

`scripts/w2-jail-aerial.mjs` (new) confirmed structurally what the shots
showed: filtering scene meshes to "tall" (`y1 > 1.5`, i.e. actual walls, not
ground paving) near the site, `jail`'s tall envelope was `x 60.5..74.7` —
which LOOKS like it covers the gap until you look at the individual meshes:
the only things in `x > 65` were the 2 m yard-fence panel and its four thin
posts (`y1` 2.4–2.6 m). Nothing taller than 2.6 m stood anywhere past `BX`
(65) — the other roughly 11 m of the building's own height (up to 13.6 m)
had nothing behind it at all.

## The fix — `src/proto/ct/jail.ts`, purely additive (53 insertions, 0 deletions)

**Did not touch `JAIL.DEPTH`.** The item is explicit that restoring it to
12 would reopen the exact unwalkable-mass fault
`notes/O-jail-site-walkable.md` fixed, and the yard is real ground the user
can now reach — regressing that to fix a visual complaint would trade one
user complaint for the one that motivated the walkability fix in the first
place.

Instead: a thin (0.2 m) **flank screen** along each of the two property
lines (`Z_S`, `Z_N`), running from the back of the real building (`BX`) to
the fence it already stops at (`FENCE_X`) — 9.65 m — wearing the same
stone-base-then-brick-upper profile the building itself does, freshly sized
to its own run rather than the building's 4 m textures stretched over it.
Capped with one plain stone band rather than repeating the building's own
cornice-then-parapet break, on purpose: a perimeter wall reads as a wall
partly by being less ornamented than the building it encloses.

**Costs the yard's walkable width nothing.** The yard's own floor plane
already stopped dead at `Z_S`/`Z_N` — nothing was ever walkable past that
line — so this draws a wall exactly where an invisible edge already was,
the same move the existing `FENCE_X` collider already made for the back
edge. `ctx.obstacle` registered for both screens, same thin-at-the-edge
shape.

It also happens to fit the building rather than being bolted onto it: a
real House of Detention's exercise yard is walled, not open to the next
lot.

## Verification

- `npx tsc --noEmit -p .` — clean.
- `scripts/w2-jail-look.mjs` re-run after the fix: `down-the-yard` now shows
  a full stone/brick wall closing the yard (screenshot compared directly
  against the pre-fix shot — night and day). Also checked from **8 stations**
  total: head-on down the middle of the street (unchanged — this was the one
  angle the desk had already verified), four natural walking-approach angles
  along both sidewalks, and two "rounding the corner into the yard" angles.
- `scripts/w2-jail-aerial.mjs` re-run: jail's tall-mesh count went from 126
  to 132 (+6 = 2 flanks × 3 segments each), spanning exactly `x 65..74.65`
  at `z -110..-109.8` and `z -96.2..-96`, heights 4.6/11.2/13.6 m — matching
  the intended profile precisely.
- `SHOT_URL=… node scripts/interiors-walk.mjs jail` — **24/25**, same as
  before my change (confirmed via `git stash` on jail.ts alone and re-running
  — the one FAIL, "the room keeps its own light after dark, 6/501 interior
  materials dimmed," is pre-existing and unrelated to this file; int-jail.ts
  is a separate module at x > 400, untouched here).
- `node scripts/bugsweep.mjs` against dev (4181): 93 shots, **zero STATION
  MISS**, no new console errors.
- `node scripts/world-wired.mjs`: unaffected, 12/12 interiors still build.
- Built the bundle (`npm run build` + `vite preview`) and re-ran
  `bugsweep.mjs` there too: 93 shots, **zero STATION MISS**, same clean
  console.

## Found but not fixed — a second, smaller, unrelated gap

Two of the "walking the sidewalk" stations
(`walking-north-sidewalk-near`/`corner-into-yard-north`) show a **thin**
vertical sliver of sky between the jail's forecourt corner and SEVENS' own
wall, right at the street corner. This is a different fault with a
different cause: `JAIL.FORE` (4 m) sets the building's face back from the
site's front edge into a forecourt, and SEVENS sits flush at `x = 57`, so
the two buildings' setback lines do not meet at that corner — a reveal, not
a void. It is much smaller (a few pixels wide at a walking distance, not
"55% of the frame"), it is not what this item's own diagnosis names (which
is explicitly about `DEPTH`, not `FORE`), and I did not chase it further
given the item's urgency and scope. Worth a follow-up row if the user
reports it separately.

## Derivation note

`SCR_LEN`, `scrCx` and both flank `zLine`s are derived from `BX`, `FENCE_X`,
`Z_S`, `Z_N` — all already-published facts in this same file — rather than
measured and typed. The two fresh textures (`scrBase`, `scrUpper`, `scrCap`)
are generated at the screen's own 9.65 m size rather than reusing
`stoneFlank`/`upperTex`'s already-computed 4 m ones, which would have
stretched the coursing ~2.4× if reused.
