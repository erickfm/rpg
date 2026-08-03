# Item 166 — LIQUOR becomes SLEEP CENTER, a 1997 mattress showroom

Worker eightysix, 2026-08-03. Port 4420, built bundle.

## What changed, and the one line that matters

*"make the liquor store a mattress store."* An **identity** change, not a
geometry one:

| file | change |
|---|---|
| `ct/street.ts:326` | roster row `LIQUOR` → `{ nm: 'SLEEP CENTER', col: '#b8642c', w: 13, front: 'mattress' }` |
| `ct/street.ts:526` | one dispatch arm, `b.front === 'mattress' ? mattressFront(...)` |
| `ct/tex-world.ts:584` | `BANDS.mattress` — the most glass on the block |
| `ct/tex-world.ts:602` | `characterOf('SLEEP CENTER') → 'mattress'` |
| `ct/tex-world.ts:2027` | `mattressFront()`, the painter |
| `ct/civic.ts:29` | `front?:` union gains `'mattress'` |

**`w` is still 13.** `ct/street.ts` says the run before No. 227 must total 49.2
or the walk-up's door and interior — pinned to a fixed z in `ct/apartment.ts` —
move with it. Verified off the colliders rather than argued
(`scripts/probes/w86-east-run-unmoved.mjs`):

```
SLEEP CENTER  -22 .. -35   13 m       No.227  -35 .. -53   18 m
alley2      -53 .. -55.5             PAWN   -55.5 .. -68   12.5 m
bodegaZ0 still -86 · apt301 still cx 198.4, cz -16.25, y 5.4
```

## The design argument, because it decided the whole front

A liquor store **defends** its window. A showroom **gives it away**. So
`BANDS.mattress` carries the smallest opening inset on the street (0.30 against
the block default's 0.40) and the shallowest sill gap (0.44 against 0.57), and
the glass runs nearly to the pavement.

**At 8 px/m nothing on this street reads its name from the far pavement**, so
"unmistakably a mattress store" cannot rest on a word — it rests on
**silhouette**. A mattress is one of the most recognisable there is: a pale slab,
thicker than a shelf and thinner than a table, on a darker base, pillow cocked at
one end. Three of them at three heights, with headboards, is a bed shop from
across the road whether or not you can read anything.

`SLEEP CENTER` rather than the literal word: the neighbours are A-1 TAX and PAWN
— plain, working, slightly desperate — and MATTRESS DISCOUNTERS would be a chain
on an arterial, not a 13 m slot between a tax office and a pawnshop. The word
itself goes hand-lettered on a sale banner taped inside the glass, which is where
a showroom actually puts it. Palette is rust/cream against the wine red it
replaces, which was chosen to say liquor and says it well.

## What looking at the frames caught, and reasoning would not have

**The first cut drew the MATTRESS SALE banner straight across the mattresses.**
Both sat mid-window, so from the opposite pavement the stock came out as three
pale streaks behind a sign — the one thing that had to read did not, in a front
whose entire argument is that you can see the stock.

Fixed by giving signage the **top third** of the glass and stock the **bottom
two**, so they cannot overlap at any width. The mattresses are also drawn deeper
than a real bed on purpose: 0.30 m is five texels at this density and reads as a
line, and the silhouette is the deliverable.

`shots/w86-win-n-far.png` (opposite pavement, the framing a player gets) and
`shots/w86-win-mid-near.png` are the before/after evidence I judged on.

## My own verdict on the after-images

From the far pavement it reads as a bed shop: rust fascia, three pale beds behind
plate glass, a red hand-lettered MATTRESS SALE across the top. It sits correctly
against A-1 TAX's navy-and-cream next door — warmer, cheaper, louder, which is
the intended relationship. Close up the beds carry quilting lines, price cards on
wires, and headboards.

**One thing I did not fix and could not:** a street tree stands directly in front
of the middle of this slot and hides roughly the middle third of the fascia from
straight across the road. It is pre-existing street furniture, not mine, and
every shop on the block takes the same treatment — but it is why the fascia reads
`…CENTER` rather than `SLEEP CENTER` from some angles. If the user complains
about the name being unreadable, **that tree is the reason, not the sign.**

## Found and NOT fixed — for the desk

1. **`scripts/probes/seams2.mjs:44` has a case NAMED `'J-east-liquor-deli'`.**
   Neither seam probe *asserts* on the string `LIQUOR` — the other two hits were
   comments and are updated — but this one is a case **name**, and
   `notes/seventysix-item213-name-keyed-harnesses.md` records harnesses that key
   off case names. I left it alone deliberately rather than risk breaking a
   baseline for a cosmetic rename. It is now a misleading label.

2. **This item could not be done in the file it named.** The row's file column is
   `ct/street.ts:296`, but `burgerFront`/`pawnFront`/`taxFront` live in
   `ct/tex-world.ts` (moved there by a documented refactor — `street.ts:375` says
   so), and the row's own brief asks for plate glass, visible beds and a banner,
   none of which exist in `street.ts`. `ct/civic.ts` also owns the `BldSpec.front`
   union and had to gain `'mattress'` or it would not typecheck. Nobody held
   either file. Flagging it because BUILDER-BRIEF §9 says to.

3. **The shopfront band and the shelf-interior texture are both 208 × 67** for a
   13 m slot, so a probe that dumps "the large texture on this building" gets the
   wrong one half the time. Cost me two rounds. Anything reading facade textures
   should match on the mesh, not the size.

## Verification

- typecheck clean · build `built in 338ms`
- `scripts/masonry.mjs` → **FACES ACTUALLY AUTHORED AT THE WRONG DENSITY: 0**
  (every metre in the painter goes through `surf.m()`, derived from
  `masonry(wM, SHOP_BAND_H, 0, SHOP_MULT)` — BUILDER-BRIEF §7b)
- `seams4.mjs` 50 shots, `seams2.mjs` 49 shots, no page errors
- `npm run sweep` → **0 STATION MISS, 0 COVERAGE** · `health.mjs` → `WORLD OK`
- `w86-east-run-unmoved.mjs` → slot still `-22..-35`, 13 m
