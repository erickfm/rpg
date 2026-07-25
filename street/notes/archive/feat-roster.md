# feat/alley — the block re-cast

Rebased onto `live` first (the merge was already in, so the branch fast-forwarded).
`npm run build` clean; `npm run sweep` reports the same four warnings as the
pre-change baseline — no new page errors. Verified on **4185** (`--strictPort`);
4181 is still the parent checkout's server.

Files: `ct/street.ts`, `ct/tex-world.ts` (shopfront band only), `scripts/roster.mjs` (new).

---

## The roster

Every requested place exists. Placements the user named are exactly where they
asked: **BURGER BARN in the old pawnshop slot**, **PAWN in the old cinema slot**,
**A-1 TAX in the old arcade slot**.

| | west (main st) | east (main st) | side st north | side st south |
|---|---|---|---|---|
| | DINER 9.2 | CAFE 11.2 | *bodega wing 6.05* | **ST BRIGID 18** |
| | MERIDIAN 10 | HARDWARE 12 | FLOWERS 6 | GARAGE 12 |
| | **LIBRARY 16** | **A-1 TAX 13** | CHOP SUEY 11 | BILLIARDS 12 |
| | **BURGER BARN 16** | LIQUOR 13 | **HOTEL ORPHEUS 12** | SMOKES 11 |
| | *alley* | No. 227 18 | **GOLDEN ACES 11.55** | LOANS 11 |
| | LAUNDRY 12 | **PAWN 12** | | |
| | BARBER 12.5 | DELI 11 | | |
| | THRIFT 14 | RECORDS 10 | | |
| | GROCERY 16 | BODEGA 10 | | |

Three runs have to land on an exact number and every roster is balanced to hit
it — **west before the alley = 51.2** (so it ends on AZ0), **west after = 54.5**,
**east before No. 227 = 49.2** (the walk-up's door is at a fixed z in
`ct/apartment.ts`). There is a comment on the rosters saying so. Change a width
and you must pay for it out of a neighbour in the same run.

Both side-street rosters now stop dead on **x = 57**, where the cross building
begins. They used to run to 58.45 and overlap it — that was pre-existing and is
fixed in passing.

## The two civic buildings

They are not shopfronts and they are not built out of shopfront parts. `BldSpec`
gained a `kind`, which takes a building out of `placeBld` entirely and hands it
to its own builder. Shared vocabulary: **ashlar** (9 px courses against brick's
5, with *pale* lime joints so it reads cool and coarse beside the warm brick),
**arched** openings rather than rectangular holes, lettering **cut** into the
stone rather than painted on a band, and a **real projecting profile** — which
is most of what separates civic from commercial at a glance.

**The library** — a Carnegie branch: rusticated plinth, quoins, four tall
round-arched windows with keystones and stained sills, `PVBLIC LIBRARY` cut into
the frieze in Roman capitals (V for U, the way the carvers did it), dentil
cornice, parapet. Then forty years of soot down it, because the grandeur is
inherited and not maintained — which is the line in the brief.

Three changes from the playtest all landed:

- **Real depth.** The entrance is no longer painted on a flat wall. The bay is
  *left out of the mass*: the elevation is three boxes (left, right, and a
  lintel over the opening) and the doors sit on a back wall 1.8 m in, so the
  reveal casts a genuine edge. The whole elevation is painted **once** and
  sampled three times, so coursing, quoins and frieze run dead straight across
  the bay — they would not if each block were painted separately.
- **A walk-up, without eating the sidewalk.** Five risers, cheek walls either
  side, all *inside* the recess. A projecting flight was the wrong answer here:
  the walk is only `WALK` m and this building has no setback. Recessing the bay
  is how a zero-lot civic building buys a climb and a shadow without taking
  pavement.
- **Less tall** — 15.0 → **13.2 m**. Worth knowing: it was already the *shortest*
  thing on its stretch, not the tallest. Its neighbours are 5-storey shops at
  19.6 m (they grew 1 m when the shop band did, see below). It now sits 6.4 m
  below them, which reads as the block having grown past it.

**Sidewalk check:** nothing below head height crosses x = -6.7, which is where
the west wall collider already stops the player — the projecting jambs and
entablature are 0.28 m, ending at -6.73. Only the cornice is deeper (0.45 m) and
it is at 12 m. No colliders were added or changed, so that pavement walks
exactly as it did before.

**The church** — St Brigid, a small urban parish: gabled nave with a real prism
gable (so the silhouette is a gable, not a box), a pointed doorway in three
recessed orders, paired lancets, a rose window, four buttresses standing 0.3 m
proud, and a tower with a louvred belfry, a spire and a cross at **32.4 m** —
the tallest thing for two streets. The gable carries the same coursing as the
wall, mapped with triangular UVs, so the stone runs on across the eaves.

The rose window is deliberately **four** hues, not eight — eight saturated ones
at this texel size read as a beach ball rather than leaded glass.

## The far end of the side street

The casino and hotel are 40 m out, most of the way to `FOG_FAR`. Two things make
them read as *somewhere else* rather than as part of this block:

- The lit parts are **`fog: false`**. Everything else dissolves into the haze on
  the fog curve, so neon that refuses to is read as neon. The boards they are
  mounted on *do* take fog, so the sign hangs in the murk instead of looking
  pasted on top of it.
- `GOLDEN ACES` is a **rooftop pylon**, not a fascia sign, and it faces **along**
  the street. A sign at the casino's own roofline is hidden behind the hotel next
  door, and a sign hung parallel to its own facade is edge-on to everyone
  approaching — and down the street is the only way this one is ever seen.

## The mirrored sign — root cause, not a glyph patch

The blade read `HOTEL` with a backwards E and L from the west. The cause was
**not** rotation or UVs. `neonM` had `transparent: true` *and* `alphaTest`, which
puts both faces of the sign into the sorted transparent pass, where the far face
can paint over the near one — so from the west you were seeing the **east
plane's reverse**.

Three transform-level fixes (flipping rotation, `scale.x = -1`, painting the
texture mirrored) all changed nothing, which is what proved it was a
*sorting* problem and not an orientation one.

The fix: **drop `transparent`** — `alphaTest` resolves the cutout in the opaque
pass, where the depth buffer decides — and use `FrontSide`, so each face can only
ever be seen from its own side. Both faces of both signs now read correctly,
checked straight-on from east and west.

**Audit, as asked.** Every other sign in `street.ts` is clear: the graffiti tags
are single-sided against opaque walls; the bodega OPEN sign and bay panels are
opaque and single-sided; the cat sprites are billboards that always face the
player. One latent case outside this branch: **`ct/props.ts:288` has the same
redundant `alphaTest: 0.5, transparent: true` pair**. It is a player-facing
billboard so it cannot show the bug today, but it is the same hazard and that
file is not mine — flagging for the desk.

## Shop scale

The measurement in the brief was right. Shops and the walk-up shared a 3.2 m
ground band, which left **1.92 m of glazing** — shorter than the door beside it.

- `SHOP_BAND_H = 4.2` (exported from `tex-world.ts`); the ground band is now
  **per building**: `b.res ? ENTRANCE.BAND_H : SHOP_BAND_H`. The walk-up stays at
  3.2, so `ct/apartment.ts` and its door are untouched — the user was right that
  it is already correctly sized.
- `shopfrontTex` is **52 texels** over that 4.2 m, so the texel stays ~0.08 m and
  the shopfront is exactly as coarse as the brick above it. The extra height went
  where it was missing: **2.59 m of glazing**, a **0.32 m stallriser** (the
  panelled bulkhead every real shopfront has and this one lacked, so the glass
  used to run into the pavement), sign band held at **0.89 m**, plus a transom bar.
- Checked after the change: the bodega chamfer bay was rebuilt on the same
  52-texel grid so it lines up with the two shopfronts it turns between; its
  awning moved 2.15 → 2.99 m to stay under the fascia (there is a comment saying
  to recheck it whenever `SHOP_BAND_H` moves); the corner shops and the casino /
  hotel sign heights all derive from the band rather than a literal 3.2.

Shops are 1 m taller overall as a result, which is correct.

## Three shopfronts that are not the block default

`BldSpec.front` swaps in a custom painter. All three keep 8 px/m and the same
band grid, so they line up with their neighbours. The spread between them is the
point:

- **BURGER BARN** — the loudest thing on the block. Saturated red fascia at
  double the usual depth, mustard stripe, yellow lettering, more glass than
  anyone else and lit right through, booths in silhouette, a menu board.
- **A-1 TAX** — the least designed. No illuminated sign at all: a vinyl banner
  sagging a texel in the middle with grommets at the corners, flat fluorescent
  interior, and REFUNDS / FAST / E-FILE on paper taped up inside the glass.
- **PAWN** — the most defended. Hand-painted board rather than a light box, the
  three gold balls, security bars across the glass, and a crowded window.

## Screenshots

`node scripts/roster.mjs` (with `SHOT_URL`) writes all of these; the `user-*`
names are fixed so re-running updates them in place.

| what | file |
|---|---|
| library, recessed entrance | `street/shots/user-library.png`, `user-library-far.png` |
| church | `street/shots/user-church.png`, `user-church-far.png` |
| casino + hotel down the street | `street/shots/user-farend.png` |
| the blade sign, from the side that was mirrored | `street/shots/user-hotelsign.png` |
| shopfront scale | `street/shots/user-shopscale.png` |
| the three characters | `street/shots/user-burger.png`, `user-tax.png`, `user-pawn.png` |

## Left undone

- **The six-cat rig is still in the alley**, as instructed — waiting on the
  user's pick. To keep one: delete `CAT_DESIGNS` and the loop under it and call
  the winner's `draw` once at `(-10.55, AZ1 + 0.6)`.
- The bodega `[E]` trigger move from the previous handoff (`notes/feat-alley.md`)
  is still outstanding in `crosstown.ts` — unchanged by this work.
- `facadeTex` floors its width at 64 px, which is why the bodega bay and the
  corner pier use a local copy of the same recipe. Worth lifting into
  `tex-world.ts` as a `minW` parameter; I left the desk's file alone beyond the
  shop band.
