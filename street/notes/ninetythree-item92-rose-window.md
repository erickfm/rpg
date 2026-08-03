# ninetythree / item 92 — the rose window, and the wall it hangs on

**The user, 2026-08-02:** *"[screenshot] would love more detail here, also the
window is misaligned?"* — `FEATURE-REQUESTS.md:2449`.

Bundle, port **4490**, builds `e2b0eb322` → `5b8cb28bf`. Dev 4491 for the walk.

---

## Root cause, one line

**The window was off-centre inside its own texture, not on the wall.** The rose's
painter tested the ellipse against each tile's **top-left corner** and then drew
the tile down-and-right of it, so the painted glass landed half a tile off centre
— **115 mm across, on a 2.4 m window seen head-on down the nave.**

## The desk's diagnosis was wrong, and the user was right

The row said the rose *"is visibly off the crucifix's axis, so one of the two is
wrong"*. `w93-item92-eastwall.mjs` measured **every mesh standing against the
altar wall**:

```
14 meshes against the altar wall
centred within 5 mm: 14 of 14        (every dx = 0.0000)
self-test: displaced 0.4 m the widest item reads dx 0.4 — PASS
```

The rose **plane** and every part of the crucifix sit on x = 680.0000, the room's
own centre line. Both helpers bottom out in the same `place(m, lx, y, lz)`
(`ct/interior.ts:1788, 1828`), so the source could not have put them apart.
**Neither of the two was wrong. The paint was.**

### Measured, off the running texture

`w93-item92-rose-centroid.mjs` reads the canvas back out of the world:

| | painted | canvas centre | offset |
|---|---|---|---|
| centroid x | 26.308 px | 24 | **+2.308 px** |
| centroid y | 38.780 px | 36 | **+2.780 px** |

48 px over 2.4 m is **50 mm a pixel**, so that is **115 mm across and 139 mm up**.

```js
const dx = (x - 24) / 22, dy = (y - 36) / 34;   // (x, y) is the tile's CORNER
if (dx * dx + dy * dy > 1) continue;
g.fillRect(x, y, 4, 4);                          // …but the tile is drawn from it
```

A tile whose corner was just inside the rim got painted 4 px further out on the
+x/+y side; one whose corner was just outside was dropped even where most of its
body lay within. **Fixed by asking the ellipse about the tile's centre**, with
`HALF` derived from `CELL` so a change of cell size cannot re-open it.

After: **x is 0 mm.** y keeps **25 mm**, and that is irreducible — 14 tile rows
on a 5 px pitch span 69 px in a 72 px canvas, and no integer start centres 69 in
72. The probe's bar is therefore **half a source pixel, derived**, not a number I
lowered until it passed (BUILDER-BRIEF §7).

The synthetic control in the probe reproduces the whole story: the shipped
corner test gives **+2.308 px**, the fix gives **+0.000 px**.

---

## AND THE ROSE WAS PAINTING IN ONE COLOUR — the second half, found by looking

Five jewel colours are declared. **Exactly one was ever drawn.**

```js
g.fillStyle = cols[(x * 7 + y * 3) % cols.length];
```

Both loops step by 5 from a start of 2, so `x ≡ y ≡ 2 (mod 5)` at **every** tile:

```
x*7 mod 5 = 14 mod 5 = 4     constant
y*3 mod 5 =  6 mod 5 = 1     constant
(4 + 1) mod 5 = 0            ALWAYS cols[0], the blue
```

A hash over coordinates that share the loop's own stride is not a hash, it is a
constant. The comment eight lines above promises *"a rose reads as jewels in a
dark room, which is exactly what it is for"* and what shipped was **a flat blue
disc** — visible in `shots/w93-92-day-mid.png`. Indexed by tile `(i, j)` with
multipliers coprime to 5 instead; `shots/w93-92c-day-mid.png` is a rose.

**This is the same fault twice in one four-line loop** — a pixel coordinate used
where a tile index was meant.

---

## "More detail here" — what I added, and what it is not

All against the altar wall, all **decoration**: `solid()` is never called, so
there is **no collider**, and the lowest piece is at y 1.44 flat against a wall.
Nothing here can trap anyone.

- a **hood mould** round the rose, its band derived from the 2.4 × 3.6 opening so
  the frame cannot drift off the glass the way the glass drifted off the plane
- a **sill**, standing a little further proud, because a sill does
- a **string course** at y 1.50 — threaded **under** the crucifix. The cross runs
  y 1.745–4.355 and the tabernacle tops out at 1.27, so that is the only clear
  band on the wall. The natural 2.6 m would have cut the corpus in half.
- **four blind lancets**, two a side, answering the real lancets in the facade
  outside. The innermost pair stands at x ±2.0 against a cross whose arms reach
  ±0.75, so a metre of plaster is left between them.

**No new textures**, deliberately: every piece takes a stone tone the file
already mixes, so there is no canvas to declare a density for and nothing that
can land at the wrong px/m (BUILDER-BRIEF §7b).

### My first attempt at this was invisible, and I only found out by looking

I used the sanctuary's `stoneLM` 0xa8a094 for the mould, reasoning that dressed
stone is paler than plaster. **In the frame the head and both jambs could not be
seen at all** — only the darker sill read. This world is unlit
`MeshBasicMaterial`, so material colour **is** rendered colour and there is no
shading to rescue a near-miss. It is the same trap that hid the flat-301 mug
handle by painting it the colour of the sill behind it
(`notes/eightyseven-item167-mug-handle.md`). Darkened, rebuilt, re-shot,
re-looked.

## My verdict on the after-images, having looked at them

`shots/w93-92c-day-near.png` and `-mid.png`. The rose now reads as a jewelled
rose window, framed, dead on the crucifix's axis; the wall has a horizontal to
give its 9.5 m a scale. Honest reservation: **at nave distance the blind lancets
read a little like pale panels rather than lancets**, because a box cannot come
to a point. That is the world's idiom everywhere, and I would rather leave it
than fake an arch out of steps.

## Verification

| | |
|---|---|
| `interiors-walk church` (dev 4491) | **29/29 passed** |
| `npm run sweep` (bundle 4490) | **96 shots, 0 STATION MISS, 0 COVERAGE** |
| `node scripts/health.mjs` | `WORLD OK — __ct initialised` |
| `npx tsc --noEmit` | clean |
| rose centroid | **0 mm in x**, 25 mm in y (the quantisation floor) |

**`fp` was NOT used and must not be here.** This adds 18 meshes; the texture hash
cannot survive added geometry (CLAUDE.md, BUILDER-BRIEF §10).

## FOUND AND NOT FIXED

- **The lancets do not come to a point.** See above — an idiom limit, not a bug.
- **`(x * 7 + y * 3) % n` over a strided loop is almost certainly elsewhere.**
  This one painted a whole window in one colour for weeks and nothing caught it,
  because the result looks deliberate. Worth a sweep of `pixTex` painters for
  colour indices computed from pixel coordinates rather than tile indices — I
  did not do it, and it is a real class.
