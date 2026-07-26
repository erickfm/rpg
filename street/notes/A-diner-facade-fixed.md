# The diner facade — the three measured faults, fixed

Follows `notes/A-diner-facade-look.md`, which found them. The user's words were
*"where are we with diner facade changes? looks really bad rn"*.

Two commits. Neither touches `ct/street.ts`, so the bounded cross-file mandate
in my queue is still unspent and there is nothing here to conflict with D.

## 1. The mouldings were a different material from the fascia they frame

`ct/street.ts` passes `shopfrontRelief` the roster colour as `trim`, and four
of the six characters use that same colour as their painted fascia. `dinerFront`
never receives `awning` at all and paints stainless from a constant, so the
diner wore a mustard-brown cornice, bed mould and cill around a steel front.

```
DINER   fascia #a8adb0   moulding #644016 -> #707477   hue gap 170° -> 3°
```

Fixed in `tex-world.ts` alone, via `joineryOf()`. **The painter is the thing
that knows what its fascia is made of**, so it publishes that rather than
`ct/street.ts` guessing — same argument as the frontage descriptor. `null`
means "roster colour is right", which is every character but the diner, stated
explicitly so the next painter does not inherit the accident silently.

**A-1 TAX measures as a mismatch too (175°) and is deliberately left alone.**
Its navy is the shop's identity colour and its cream band is a cloth banner
hung on brick rather than a fascia. Nobody has complained. GOTCHAS 23.

## 2. The glass block sat against the door, and on the wrong end

The block's end was a constant, chosen back when this painter also chose the
door and put it at the far end. The room now declares the door at the *other*
end and nothing re-derived the block — GOTCHAS 33's shape exactly. Measured
before:

```
0.56–2.50 m  #c4cdcb  glass block
2.56–3.63 m  #9aa0a4  the door
```

0.06 m apart, two bright neutrals reading as one 3.1 m pale slab, with 0.44 m
of the door hanging over the block rather than over glass. `layoutOf` now picks
the block's end from the declared door, and there is a real pier between the
two. Walking up from the burger barn you now meet the entrance and the counter
instead of a blank wall.

Undeclared frontages keep the old geometry byte for byte — that is also the
fallback a shop with no room behind it gets, and it should not move because
the diner has one.

**One ordering bug found on the way**, and it is the interesting part:
`shopfrontRelief` called `frontageOf` at the top of the function, *before* the
`registerFrontage` below it, so it could never see a room's declaration.
Harmless while the block's end was fixed; the moment the end became a function
of the declaration, the mouldings would have framed the glazing at the wrong
end of the shop. Both `shopfrontRelief` and `registerFrontage` now register
first and ask second.

## 3. The block was brighter than the sky, and I got that wrong by reasoning

`scripts/A-diner-block-vs-sky.mjs` is new and it exists because of my own
error, which is worth writing down rather than quietly fixing.

I set the base fill to luma 151 against a sky I had **assumed** was 163, wrote
"12 below the sky", and then measured: a **169** block against a **149** sky.
Both halves were wrong in the same direction. The base fill is not the tone you
see — a per-cell white highlight and a room-glow gradient sit on top and lift
the modal tone about eighteen. GOTCHAS 29: measure it, do not remember it.

The value is now set by the script rather than chosen:

```
sky    luma 149
block  rgb(131,141,136)  luma 139        OK  10 darker than the sky
```

I watched it fail before trusting it — restoring the old `#b9c4c2` gives
`FAIL: 51 brighter than the sky` (GOTCHAS 27).

Also under the counter: 7.8 m of one flat near-black, the largest single tone
on the front, now carries a chrome foot rail, stool pedestals and their floor
shadows. Still dark, because a diner window IS dark below the worktop.

## Verification

- **Door still lands where the room declares it**: 0.02 m
  (`scripts/A-diner-door-aligns.mjs`). The whole point of moving the block was
  to stop it fighting the declared door, so this is the check that matters.
- **Fingerprint**, both captures on my own 4188 and on the SAME commit — my
  first attempt compared across a rebase and attributed other builders' work
  to myself, which is worth avoiding:
  - 165 textures differ, **165 lost and 165 gained, every lost one having a
    same-dimension partner** — a repaint, not a loss. GOTCHAS 31's grain
    shift, from the object count moving by one.
  - 189 structure entries differ; **7 have no same-geometry partner**. Those
    are the diner ROOM's window panes: `ct/interior.ts:651` derives them from
    `FW.glazingLoWorld/HiWorld`, so moving the glazing span moves them. That
    is the designed contract, not a break — the room declares the door, the
    facade follows; the room's glazing follows the facade.
  - Noise floor established first: the same build twice is IDENTICAL on
    textures, structure and tints, so those diffs are signal.

## Left undone, deliberately

- **The door leaf still reads as a pale grey slab.** Its lower 0.85 m is flat
  stainless with a push plate and nothing else. It is the weakest thing left on
  the front. I have not touched it because the three faults I filed are fixed
  and "two failures then delete" cuts both ways — this has had no failed
  attempt yet, and it wants a decision about what a 1997 diner door is rather
  than another pass of shading.
- **Three bays of mullions over 8.45 m** still looks coarse to me. No
  measurement, so it stays a judgement and not a finding.
- **Night.** Everything above is 13:30.
- Neither new script is registered in `checks.mjs` and neither has a selftest,
  for the reason in their headers. `A-diner-block-vs-sky` has at least been
  watched failing; `A-diner-door-aligns` has not.

## Not mine, seen in passing

`npm run checks` has two reds that predate this work and are in files I have
not touched: `no-silent-pass` (flags `scripts/parking.mjs` exiting 0 on an
unknown mode) and `hashes-resolve` (dead citations in `scripts/D-walk.mjs`,
`G-vice-walk.mjs`, `alleycheck.mjs`, `alleydish.mjs`, `checks.mjs`). Most of
the rest of that board reports WRONG WORLD, which is exit 3 — never ran,
because the suite's default port is not serving this build.
