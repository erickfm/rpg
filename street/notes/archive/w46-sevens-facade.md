# w46 — item 97, the SEVENS facade (the user's THIRD complaint)

> *"sevens casino front looks so messed up. take influence from vegas thanks."*

File: `src/proto/ct/vice.ts` only. Port **4180** (dev) and **4181** (`vite preview`,
the built bundle). Both shut down at the end.

## Why it read as messed up, in one line

**The lettering was sized off the panel's HEIGHT on a panel that is taller than
it is wide, and the tallest object on the frontage was showing the street its
one unlit face.**

---

## The three filed defects — two real, one misdiagnosed

### 1. `SEVENS` read `EVEN` — REAL, and the cause is arithmetic

`tubeText(g, 'SEVENS', W/2, H*0.38, H*0.30, …)` on the `masonry` skin. The panel
is 11.55 m wide by 12.85 m tall → a **92 x 103** canvas at the block's 8 px/m, so
a cap height taken from `H` is a cap height taken from the LONG side.

Measured (`scripts/probes/w46-does-the-copy-fit.mjs`):

| string | canvas | px | advance | overflow |
|---|---|---|---|---|
| `SEVENS` | 92 | 31 | **112.0** | **+20.0 — 10 texels off EACH end** |
| `777` | 92 | 13 | 23.5 | fits |
| `LOOSEST SLOTS` | 96 | 8 | 62.6 | fits |
| `$2 BLACKJACK  24 HRS` | 96 | 6 | 72.2 | fits |

Ten texels at 31 px is very nearly a whole letter, which is exactly the `EVEN`
in his frame.

**Tightening the tracking cannot rescue it** and that was worth measuring before
designing around it (`scripts/probes/w46-glyph-ink.mjs`): bold monospace inks
**0.62 px** against an advance of **0.602 px**, so the letters already touch.
There is no slack. The size has to come from the width the sign has.

Fix: `fitPx` / `fitTube` / `fitFlat` / `track` — new, exported, next to `tube`,
so both buildings and `ct/int-casino.ts` keep ONE signage hand. The size is
derived from `measureText` at a reference size and scaled, **including `tube`'s
own `0.30 * px` stroke**, which puts casing outside the ink and is how a
"fitted" string still loses its ends.

`SEVENS` is now 21 px, not 31 — **smaller letters and four more of them**. The
previous fix's note (*"fewer, bigger letters rather than a bigger texture"*) was
right and is kept; it simply never checked the resulting width. You could read
four letters before. You can read six now, and they span the whole 11.55 m.

### 2. The marquee's second line — **THE FILED CAUSE IS WRONG**

Filed as clipped (`$1 BLACKJA`). **It is not clipped.** `$2 BLACKJACK  24 HRS`
measures **72.2 texels inside a 96-texel canvas — 12 texels of clear margin at
each end.** The whole string was on the sign.

It was **under-resolved**. 96 texels over 6.0 m is 16 px/m, so 20 characters at
6 px cap height gives a **3.6-texel glyph** whose stems are one texel — and
`hardLayer` snapping alpha at 128 then keeps or drops each of those stems
depending on where the anti-aliaser happened to land it. Half a letterform
survives. From the pavement, illegible and truncated look identical.

Fix: the fascia canvas doubled to **192 x 52 — exactly 2x in both axes**, 32 px/m,
the family the blade art (35 px/m) and rooftop board (27 px/m) already live in.
Both lines then go through the fitter. **This is not the soft direction**: every
glyph still goes through `hardLayer`, so a letter edge is still a texel edge —
there are simply twice as many texels to put the edge on. The line went from a
3.6-texel glyph to a 7-texel one.

This mattered for the fitter's design too. A fitter that silently shrank a
too-long string would have converted defect 1 into defect 2, so `fitTube` /
`fitFlat` **throw** below an 8 px legibility floor rather than drawing mush.

### 3. The floating black bar — REAL, and it is why this is the THIRD complaint

It is **the blade cabinet**, and the diagnosis is geometric rather than a matter
of taste (`scripts/probes/w46-what-is-the-black-bar.mjs`):

```
BoxGeometry  x 55.88..56.22  y 5.6..21.4  z -97.35..-96   0.34 x 15.8 x 1.35
   mat #24222a  map=-  transparent=false  fog=true
```

A blade projects from the wall, so **all** of its artwork is on the two ±x
faces — that is what a blade is for. But the user is standing in the ROAD looking
at the facade straight on, and from there those faces are edge-on and project to
nothing. What faces him is the box's own front: **0.34 m wide, 15.8 m tall of
unlit `boardM`**, laid over the brightest wall in the world, with 2.5 m of clear
air between its bottom and the marquee. Sixteen metres of black stripe attached
to nothing you can see.

**Both earlier fixes on this facade moved the blade** — first for occlusion
against the hotel's blade, then out to the far end of its own frontage — and
neither could ever have helped, because **the bar is not WHERE the blade is, it
is WHICH FACE of it you are looking at.**

Fix, in the idiom a real blade uses: the leading edge is exactly where the chase
bulbs go, because it is the edge everyone sees. 31 sockets on the shared chase
plus a `riser` tube behind them. The tallest black thing on the frontage is now
the brightest vertical on it, running downward, pointing at the door.

**And a fourth dead face I found in my own after-frame, not by reasoning**: the
rooftop board is 0.5 x 6.6 x 7.2 m standing at 19.4 m, so from the pavement you
look steeply UP at its **underside** — 0.5 x 7.2 m of the same unlit `boardM`,
receding away from the newly-lit front edge and reading as a black shaft hanging
off it. A leading edge is obvious; a soffit only shows from below. Both long
bottom edges outlined in bulbs.

---

## Then: Vegas

The composition was one caption and one small mark floating in eight metres of
empty maroon. Every band now does a job (texel rows on the 92 x 103 skin):

```
  0..4    cornice rule, under the real crown bulbs at 17.38 m
  6..12   painted socket run, full frontage
 14..25   CASINO, letterspaced wide  — what the building IS
 27..29   double rule
 31..70   THE NAME BOARD: inset lit panel, gold framed, sockets top and bottom,
          SEVENS filling it
 72..74   rule
 76..94   777 (0.13 H -> 0.52 W, ~4x the area) with the blade's chevron in the wings
```

Below texel 95 the marquee stands in front of the middle 6 m (measured: the
marquee top at 5.35 m maps to texel 95.0), so nothing that must be read is put
there.

**A starburst behind the 777 was tried first and is not what shipped.** At
8 px/m every ray inside the 777's own ink is invisible, the vertical ones run out
of band before they clear it, and what survived read as damage rather than as
light. The chevron is the motif `bladeArt` already runs down the blade, so it is
the same hand by construction rather than by resemblance, and an arrow is a shape
8 px/m can hold.

**The three riser tubes had to move.** They were at `cxm`, `x0+2.6`, `x1-2.6` —
the middle of the elevation, i.e. straight down the middle of SEVENS and through
the 777. Both readings were true at different times: they were authored when this
was a blank maroon slab, and the sign has since grown into the space they used.
They now **pair at the party edges** (gold outside, red inside, over the bulb
column already there) and **break at the name board**, running the parapet above
and the base below. The east pair is set 1.35/2.05 m in rather than 0.55/1.25
because the blade would occlude anything nearer that corner.

`4.35` / `17.2` and the name board's extent are each now authored **once**
(`SKIN_Y0`, `SKIN_Y1`, `NAME_T`, `NAME_B`, `skinY`) and read by both the painter
and the tubes. They had been hand-typed twice and this change needed a third
reader. `riser` gained defaulted `z`/`w` so the blade's leading edge runs the
*same* tube rather than one that merely resembles it.

---

## Proof

- `scripts/probes/w46-nothing-is-clipped.mjs` — **the check that can fail.** Reads
  the finished texture and asserts no lit texel in column 0 or W-1 across each
  lettering band. **Positive control run**: against `46f01affd`'s `vice.ts` it
  reports `SEVENS ink 0..91, margin 0/0, 33 texels in edge column — CLIPPED` and
  exits 1. On this build all four bands are clear and it exits 0. Verified on the
  **built bundle** (`vite preview`, port 4181), not only dev.
- `npm run build` clean, `npx tsc --noEmit` clean.
- `node scripts/bugsweep.mjs` on the built bundle: **0 STATION MISS, 0 COVERAGE**,
  96 shots, no new console errors.
- `node scripts/health.mjs`: `WORLD OK`, exit 0.
- Night frames from the user's own viewing position, before and after:
  `shots/w46/before-hero.png` → `after-hero.png`, and `before-name.png` →
  `after-name.png`. Day frames at `shots/w46/day-*.png`.
- No colliders added or moved; everything new is at 5.9 m or above. The 2 m lane
  is untouched.

### My own verdict on the after-images

`after-hero.png` is the shot I would defend. From his position the frontage now
reads top-to-bottom as one lit sign — CASINO, the framed name, the 777 between
two chevrons, the marquee — instead of a caption stranded in maroon, and the
name is the first thing you read rather than the thing you decode. The blade is
the change I am most confident about: it went from the worst object in the frame
to the strongest vertical, and it is a genuine fix rather than a cover-up. The
marquee's small print is the sharpest text on the building now.

Not perfect: the blade cabinet still shows a short dark stub below its lowest
socket at ~5.6 m, and the rooftop board's soffit is a dark strip *between* two
bulb runs rather than a lit surface. Both are small, both are honest sign
structure, and I would rather record them than over-light them.

---

## Found and NOT fixed — for the desk to queue

1. **`npm run fpdiff` over-reports on any change that adds a texture, and the
   over-report is enormous.** This change came back `849 of 1461 textures differ,
   1906 of 8324 structure entries differ`, which read as a facade repaint having
   repainted half the city. It is not noise — two runs of the same build are
   byte-identical, verified. `scripts/scenedump.mjs` seeds ONE global
   `Math.random` and the whole world then paints off that single stream
   (`paint.ts:141-170`, `dither`/`grain`), so **adding seven textures anywhere
   shifts the sequence for every texture painted afterwards**: same art,
   different grain, different hash.

   Measured with the grain PINNED instead of seeded
   (`scripts/probes/w46-art-without-grain.mjs`), the real diff is:

   ```
   - 92x103   (the SEVENS skin, replaced)
   - 96x26    (the marquee fascia, replaced by 192x52)
   + 192x52, + 7 x 8x16 tube textures (the extra risers)
   ```

   Nothing else in the world changed. `tints` was 0-differ and `places` showed
   only my three intended riser moves plus the documented 2-object noise floor —
   so the two grain-independent fingerprints already agreed; it is `textures` and
   `structure` that mislead. **CLAUDE.md and BUILDER-BRIEF §10 both tell every
   builder that "textures and structure must match", which is currently
   unachievable for any change that creates a texture.** Worth fixing in
   `scenedump.mjs` (re-seed per texture from a stable key, e.g. the canvas
   dimensions plus a draw counter) — otherwise builders will learn to wave real
   texture differences away.

2. A trap for whoever writes the next probe here: **three.js builds `Texture.uuid`
   from `Math.random`**, so any harness that pins the RNG and then dedupes by
   uuid collapses the entire scene to one texture. Mine did, and reported "1
   unique texture" against a real 1461 without erroring. Dedupe by object
   reference.

3. `scripts/probes/w46-facade-shot.mjs`'s `wide` station (x 51.2, z -112) fails
   its own warp-landed-where-I-asked check by 9.12 m at night and 1.35 m by day —
   something is pushing the camera out of that point. It refuses to file the
   frame rather than photographing somewhere else, so it cost nothing here, but
   the point itself is presumably inside a collider that varies with the hour.
   Not investigated.

4. Nothing was changed on **HOTEL ORPHEUS**, which shares this file. Its blade
   (`x 44.22..44.48`, `y 5..19.2`) and its rooftop board have **the same dead
   leading edge** as the casino's did — I could see it in every frame. It is not
   in the user's words and not in this item, so I left it. It is a ~6-line change
   in the same idiom now that `riser` takes a `z`.
