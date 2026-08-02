# Builder A — the shopfronts, and two bugs

All in `ct/tex-world.ts` except the consolidation, which was the granted
two-file move. Commits, oldest first:

| | |
|---|---|
| `d7ff185` | move `burgerFront`/`pawnFront`/`taxFront` into `tex-world.ts` (mandate) |
| `3f5acc3` | depth vocabulary + a character each for the four named fronts |
| `7f9ecfa` | the two bugs: window lattice, tree alpha |
| `6292a4f` | the block default brought up to the same depth |
| `cbdb0c7` | the pawnshop rebuilt; last legacy-texel painter retired |

## The two bugs

**(a) Lit windows on diagonals.** `(f * 7 + c * 3) % 5 === 0` is a linear
congruence in storey and column, so every storey up shifts the lit column by a
fixed amount. Quantified before and after: with the old formula **100 % of lit
windows are followed by a lit window at ONE fixed column offset on the storey
above** — that is the diagonal, exactly. With an avalanche hash of `(f, c)`
seeded per building off its brick, width and height, the worst single offset
drops to 20–40 %, which is what a scatter looks like at that sample size, at the
same ~1 in 5 lit. Left static, so D's night-curve item has something sane to
animate. Deliberately not drawn from the shared `rnd()` stream — that would
shift every tree height and pigeon downstream (GOTCHAS §2).

**(b) Tree crowns see-through.** The queue diagnosed the ragged-edge pass, and
it was half of it. Measured the sprite alpha directly rather than eyeballing:
**every tree had alpha-0 holes as deep as 0.41R**, and the ragged notches at
0.94R can only reach about 0.8R. The deeper holes came from the three
deliberate *"real sky holes, well inside the mass"* at 0.25R–0.60R in the loop
immediately below — not mentioned in the diagnosis. `board()` uses
`alphaTest: 0.5`, a hard cutout, so each one was a hole you read brick through.

Notch centres now start at the full radius (more of them, so the silhouette
stays lively) and the interior sky holes are gone: at 60 px across a crown they
land as wrong-coloured specks, not as sky. **After: 9 of 11 trees have zero
interior holes**, the other two have 1–2 px grazing the 0.8R test threshold,
which is rim.

## The shopfronts

**Consolidated first.** The three specials now sit next to `shopfrontTex`. The
move was verbatim and therefore provable: textures `30bc4ef8` and structure
`a367621` byte-identical before and after.

**Then the depth.** The diagnosis in the brief is right — a shopfront was a
flat painted plane. But the fix at 16 px/m is not modelled geometry: a 50 mm
fascia lip is a third of a texel and would be invisible. It is consistent
shading, so there is now one vocabulary all six fronts share — `reveal()` for an
opening set back from the brick (head dark, cill lit, left jamb dark, right jamb
lit, light from above-left as the doorcase and sills already assume), `proud()`
for a band that stands off the wall and casts under itself, `glazed()` for plate
glass with a raking sky reflection instead of a black rectangle, `mullions()`.

Sharing the vocabulary is also the thing that should stop them drifting apart
again, which is why they were queued.

Characters, rather than one template recoloured:

- **BURGER BARN** — a plastic light box, backlit menu strip, booths as
  silhouettes against a lit ceiling, scuffed kick rail. **The mustard is gone
  for good**: the scheme is two constants now, not four fills scattered through
  the painter, which is why it survived three previous fixes.
- **A-1 TAX** — a sagging vinyl banner cable-tied to the brick, vertical blinds
  half shut, one piece of real gold-leaf signwriting, paper taped up inside.
- **DINER** — fluted stainless fascia, a glass-block panel that glows and shows
  nothing, counter and stools through the glass, chrome kick rail dulled at the
  pavement.
- **THRIFT** — a sun-bleached painted board, a window crammed to the glass,
  hand-lettered cards taped up crooked, tape over a crack.
- **PAWN** — layers: two crowded shelves, dim glass, then the grille in front
  with its own highlight and its own cast shadow.
- **The block default** — deliberately no character. A barber and a deli should
  be quiet next to those five; they just needed to be *built*. Opening, reveal,
  fascia and stallriser that cast, bays, transom, and a room behind the glass.
  What varies per shop is hashed off the name: door position along the front,
  bay count, warmth of the room, so fifteen in a row are not fifteen copies.

**DINER and THRIFT are selected by name inside `shopfrontTex`,** not by a
`front:` flag in `street.ts`'s roster. The shopfront system decides how a named
shop looks — the boundary the consolidation drew — so the next character is a
change in this file and nowhere else. The three roster flags still work; they
can retire whenever D is next in that file.

Checked against D's `cff1464`: the diner moved to the 12 m slot after the alley
while I was working. The painters take width as a parameter, so it cost nothing.

`bandSurf()`/`OLD_SB` are deleted. That scaffolding re-based legacy texel
coordinates during the density work and was always meant to be temporary; no
painter in this file carries a coordinate system of its own now.

## What I did NOT do, and would need a mandate for

The brief asks for a fascia and stallriser that **project**. They read as
projecting — that is what `proud()` is for — but nothing here adds geometry,
because the shop band's mesh is built in `ct/street.ts`. Things that genuinely
want real depth rather than shading are **an awning, a projecting blade sign,
and a recessed doorway** at 0.3–0.6 m, which is many texels and would read.

That is one added call in `placeBld`/`placeBldZ`. I can supply the builder from
this file; it needs a small mandate for D's file. **Worth asking whether the
user wants it before granting it** — the shading may already be enough, and
those three are the parts of the brief the current work approximates rather than
delivers.

## For the desk

- **Every screenshot script in `scripts/` can silently save a blank frame.**
  This environment drops the WebGL context periodically (`CONTEXT_LOST_WEBGL`
  appears in every sweep) and a lost context screenshots as a white page. It
  bit me twice here and both times the harness reported success. My local probe
  now samples the framebuffer and retries; `verify.mjs`, `seams*.mjs` and
  `bugsweep.mjs` do not, so a reviewer can be handed a white PNG as evidence.
  Cheap to fix in `scripts/` and I own that — say the word.
- **The artifact is behind again.** `street/dist/artifact.html` is still the
  `8028664` build handed over earlier and unpublished. I have not rebuilt it,
  since republishing before you publish just changes the sha under you.
