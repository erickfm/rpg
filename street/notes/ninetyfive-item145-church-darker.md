# Item 145 — *"church could be darker."* Dim the stone, not just the palette

Worker ninetyfive. `src/proto/ct/int-church.ts`, commit `fc0f6bb35`. Measured on
the **built bundle**, port 4510.

---

## Root cause, one line

The church was the brightest big stone room in the world because **only its
shell palette was ever tuned** — the flagstone floor, narthex, chancel, font and
altar each carry their own hex literals, so there was no single thing that
"the church's tone" meant.

## The world is unlit, so tone is the only tool

`light:` in a `RoomSpec` builds a fixture and a weak additive halo decal and
nothing else. `ct/interior.ts:1425` says it outright: *"the room is lit by its
flat materials."* There is no lamp to turn down. A room's brightness **is** its
palette.

## Measured before touching it

`scripts/probes/w95-interior-tone.mjs` — 16 frames per room (4 stations × 4
yaws), mean luminance over a crop that excludes the wristwatch HUD:

```
hotel 0.191 | casino 0.243 | pawn 0.407 | CHURCH 0.589
            | library 0.624 | diner 0.645 | thrift 0.675 | bank 0.689
```

The church sat between the pawn shop and the **library reading room**, 0.056 off
the diner. A nave lit like a sandwich counter. The user is right.

## Dimming the palette alone was wrong, and the first frame said so

`palette.floor` is only the slab *under* the flagstones. The floor the player
sees is `flagT`, a canvas texture with its own five hex literals a hundred lines
away, and the narthex/chancel/font/altar carry nine more.

Shell-only dimming pulled the walls to ~123 luminance while the flagstones stayed
at ~106, and **the wall/floor step — 56 points — nearly vanished.** Darker *and*
unreadable: the one trade the item explicitly forbids. Caught by looking at
`shots/church-dim076-nave.png`, where the floor reads brighter than the walls.

So `STONE_DIM = 0.76` is applied wherever stone is declared, through
`dim()`/`dimS()` helpers, so the authored colours stay legible in the source and
**one number retunes the room**.

**Not dimmed, deliberately:** stained glass, candle flames, the sanctuary lamp,
gold, and the altar cloth. Those are the light *sources* — *"a church is lit by
its windows"* is this file's own line — and scaling them down with the stone
would darken the room by turning its lights off. Holding them fixed is what makes
the glass read **stronger** afterwards than before, which is visible in the pair.

## Result — five runs a side, with an untouched control

| | before | after | |
|---|---|---|---|
| church lum | 0.5890 | **0.4647** | **−21.1%**, spreads 0.0005 / 0.0003 |
| church sd | 0.1197 | 0.0820 | |
| **pawn lum (control)** | 0.4067 | 0.4066 | **unmoved** |

The pawn shop was carried through every run precisely so the church's move could
be attributed to the change rather than to the weather. It did not budge.

### `sd` falls, and that is arithmetic rather than damage

I briefly wrote in the file that a uniform factor keeps `sd/lum` fixed. **It does
not** — measured, 0.203 → 0.177 — and the wrong claim is worth keeping for its
reason: these are **flat unlit materials**, so a surface's contribution to
contrast is proportional to its brightness. Scaling stone by *k* scales the
differences *between* stone surfaces by *k* too, while the mean is held up by
everything deliberately not dimmed. **Absolute contrast has to fall when an unlit
room is darkened; no choice of factors avoids it.**

So `sd` is not the legibility test — **surface separation** is:

| | before | after |
|---|---|---|
| wall − floor | 55.9 | 42.1 |
| wall − trim | 31.4 | 23.7 |
| ceil − wall | 21.8 | 16.8 |

Smallest is still ~17 levels on flat colour, an obvious step. The ceiling remains
the brightest surface, so the 9.5 m height still reads — confirmed in the `-up`
pair, where the ceiling/wall edge stays crisp and the perspective converges.

## ⚠ My own probe lied first, and in the direction that mattered

It waited on `waitForTimeout`, not a painted frame. A sibling probe on the
**identical warp** wrote a **solid white nave**
(`shots/church-after076-nave.png` — kept as the evidence). GOTCHAS 78/80.

An unpainted frame reads luminance ≈ 1.0, so every one that slipped through
dragged a room's mean **toward white** — understating how bright this room
already was. The baseline first read **0.552; it is truly 0.589.** Had I not
looked at a frame, I would have calibrated the whole change against a number that
was wrong by a quarter of the effect I was trying to produce.

Both probes now call `waitPainted` and **throw** on a void frame rather than
averaging it in — a silent skip would have left the mean quietly wrong.

## Verdict on the after-images, which I looked at

`shots/church-before-nave.png` reads as a bright municipal hall.
`shots/church-stone076-nave.png` reads as a church: dark flagstone underfoot,
cold pale stone walls, and stained glass that now carries the room. The pews and
altar are unambiguous. I am satisfied it answers the three words.

## Green

`tsc --noEmit` 0 · `health.mjs` WORLD OK · `npm run sweep` 0 STATION MISS, 0
COVERAGE · `bugsweep.mjs` 0 STATION MISS, 0 COVERAGE.

No geometry was added, moved or removed — colour literals only — so collision,
floors and seats are untouched by construction.

## Found and NOT fixed

**`STONE_DIM` is one knob and 0.76 is my judgement, not a measurement.** It puts
the church just above the pawn shop (0.465 vs 0.407) and well clear of the
casino/hotel dark end. If the user wants it darker still, that constant is the
only edit required — nothing else needs re-deriving. Worth showing him the pair
before assuming 0.76 is the answer.

**The other eleven interiors have never been tone-checked against each other.**
`w95-interior-tone.mjs` will rank all of them in one run, and the spread it found
is wide: 0.191 (hotel) to 0.689 (bank). The library at 0.624 with `sd` 0.212 is
the outlier worth a look — brightest-but-one and by far the highest contrast in
the world. No row exists for any of this; I am not inventing one.
