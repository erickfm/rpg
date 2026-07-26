# The diner frontage, looked at from the pavement — findings, no changes yet

The user: *"where are we with diner facade changes? looks really bad rn"*.

My ledger has the diner **blade** and the **thrift facade** confirmed. Neither
of those is the diner facade, and nobody had stood in front of the diner since
`shopfrontRelief` landed. So this is a look, not a fix — the instruction was to
report before changing anything, and I have changed nothing in `src/`.

Build measured: `fcc25fa48`, `vite preview` on 4188 (GOTCHAS 26, 28).

## Shots

`scripts/A-diner-front-shots.mjs` — square on, both ends, the door, the
stallriser, and one whole-elevation from the road. Aim is derived from
`__frontages`, not typed. Output in `shots/A-diner-*.png`.

Two wrong yaw conventions got past me first: `atan2(dx,dz)+PI` photographed the
PAWN shop across the street, and `atan2(dx,dz)` photographed the alley. **A
square-on shot has `dz = 0` and cannot tell any of the three apart**, so the
first two rounds looked like perfectly good photographs of the wrong building.
The rig's forward is `(sin yaw, 0, -cos yaw)`; the script says so now.

## What is NOT missing

I expected to find the depth treatment absent. It is not — every item on the
queue's list is present and I could measure each one:

| asked for | state |
|---|---|
| glass set back, visible reveal | **present** — `reveal()`, measured as the dark run at u 0.38–0.50 m and 11.56–11.69 m |
| projecting fascia | **present** — 1.0 m steel band, plus a real 0.20 m cornice and 0.13 m bed mould in `shopfrontRelief` |
| projecting stallriser | **present** — full-width chrome kick rail, 0.35 m, with a 0.11 m cill and 0.09 m plinth standing off the wall |
| transom | **present**, and correctly on ONE line across both glazing and door |
| mullions | present, but only 3 bays over 8.45 m — 2.8 m per bay |
| something IN the window | **present** — warm ceiling, counter, stools, booths |

`shopfrontRelief` is doing its job. The diner does not need the treatment
built; it needs three specific things fixed.

**And the door is right.** `scripts/A-diner-door-aligns.mjs` measures the
painted leaf at z = −46.59 against the declared z = −46.61 — **0.02 m**. The
room-declares-the-door mechanism works on this frontage. I had read the door
close-up as showing no door at all; the measurement says otherwise and the
measurement is right.

## What is actually wrong

### 1. The projecting mouldings are a different material from the fascia they frame

`ct/street.ts` hands `shopfrontRelief` `trim: b.col` — the roster colour — and
the relief tints its cornice, bed mould and cill from it. Four painters use
that same roster colour as their fascia, so their mouldings belong to the band
they frame. **`dinerFront`'s signature is `(brick, nm, wM)` — `awning` is never
passed to it** — and it paints a stainless fascia from a constant instead.

`scripts/A-diner-relief-palette.mjs`, over the live world:

```
DOES THE PROJECTING MOULDING BELONG TO THE FASCIA IT FRAMES?
  BURGER BARN   fascia #cd453f  moulding #ad2823  hue gap   0°
  DINER         fascia #a8adb0  moulding #644016  hue gap 170°  ** MISMATCH **
  THRIFT        fascia #886b40  moulding #694d25  hue gap   1°
  A-1 TAX       fascia #d8d2c4  moulding #253f69  hue gap 175°  ** MISMATCH **
  LIQUOR        fascia #8a2c42  moulding #772538  hue gap   0°
  PAWN          fascia #6a5a3a  moulding #5b4d31  hue gap   0°
  RADIO         fascia #3a4a7a  moulding #313f69  hue gap   0°
```

So the diner has a **mustard-brown cornice, bed mould and cill wrapped around a
stainless-steel front**. That is the striping visible in
`A-diner-from-thrift-end.png`: white ribbed band, brown band, gold band, none
of which are the same object.

**It is not diner-only.** A-1 TAX has it too, and both are on the user's list of
four. Five of seven fronts are clean, so this is a two-instance bug in a system
that otherwise works — not a redesign.

### 2. The left 3.1 m is one pale slab with the door jammed into its edge

Colour runs across the band at 0.8 m above the pavement, u metres from the
alley end:

```
0.00–0.38  #6b4034  brick
0.38–0.50  #1a1713  reveal
0.56–2.50  #c4cdcb  GLASS BLOCK          (luma 200 — brighter than the sky)
2.56–3.63  #9aa0a4  THE DOOR's steel panel (luma 159)
3.69–11.50 #1e1a16  under the counter    (7.8 m of ONE flat near-black)
```

Two separate problems in those five lines:

- **The glass block and the door abut with a 0.06 m gap and no pier between
  them.** Two bright neutrals side by side read as one 3.1 m pale slab with a
  scratch in it. `A-diner-from-alley-end.png` is the shot — walking up from the
  burger barn, the whole shop is a blank white wall.
- **The door straddles the glazing's start line.** Glazing begins at u = 3.00;
  the door occupies 2.56–3.63, so **0.44 m of the door hangs over the
  glass-block panel rather than over glass.** `dinerFront` lays its glass block
  out assuming the painter's own door position (u 10.78, the thrift end) while
  the room declares u 3.11, the alley end. The painter honours the declaration
  — correctly, that is the authority flip working — but its *glass-block
  layout* was never re-derived against it. This is GOTCHAS 33's shape: a
  position moved and the thing beside it did not recompute.

### 3. The bottom of the display window is 7.8 m of flat black

The `#1e1a16` "under the counter" fill runs the entire glazing width unbroken
except by mullions. It is the largest single tone on the front.

## What I have NOT established

- **"Too much pale grey" does not single out the diner.** Bright-neutral share
  of the painted band: diner **29.5%**, but A-1 TAX is **53.0%** and nobody has
  complained about the tax office's greyness. So I am *not* claiming the diner
  is bad because it is pale — the measurable faults are the moulding mismatch
  and the slab/door collision above. Recording the number so the next person
  does not re-derive it and over-read it.
- Whether the 3-bay mullion spacing reads as too coarse. It looks it; I have no
  measurement and did not want to file a judgement as a finding.
- Night. Everything above is 13:30.

## Proposed order of work, when the desk says go

1. Pass the shop's own fascia colour to `shopfrontRelief` instead of the roster
   `col`, so the mouldings belong to the front. Fixes the diner AND A-1 TAX,
   and it is one value — but it is a **cross-file change** (`ct/street.ts` is
   D's), so it needs the bounded mandate the queue already grants, and a rebase
   first.
2. Re-derive the diner's glass-block panel from the DECLARED door rather than
   from the painter's own, so the block sits on the side the door is not, with
   a pier between them.
3. Give the under-counter zone something to look at.

Nothing above is started. `src/` is untouched on this branch.

## Files added

- `scripts/A-diner-front-shots.mjs` — investigation, shots
- `scripts/A-diner-relief-palette.mjs` — investigation, the palette table
- `scripts/A-diner-door-aligns.mjs` — an assertion, exits non-zero.
  **Not registered in `checks.mjs` and it has no selftest** (GOTCHAS 27) —
  a mutation for it needs a hook in `ct/tex-world.ts` and this pass changes no
  source. It is evidence I ran once, not a guard. Register it with the fix.
