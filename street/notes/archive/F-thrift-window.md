# For A — what is behind the thrift's glass

The desk: the thrift EXTERIOR is yours and is being rebuilt, and *"the window
display you build inside should be what is visible through the glass A is
fixing."* It exists now. This is where it is.

## The numbers, measured not remembered

```
room            id 'thrift', w 11.3, d 6.5, slab centre x 1000
doorway         room-local x −2.20   (jamb pair at −2.75 and −1.65)
window display  room-local x −3.00,  z = hd − 0.55 = 2.70  (hard against the front wall)
```

So the display sits **0.80 m from the door centre, on the room's −x side**, and
2.65 m in from that end wall.

Published door for cross-checking: `THRIFT` point `(−7.00, −59.32)`, outward
normal `+x`, stand `(−6.25, −59.32)`. Frontage `THRIFT`, w 12.5, cz −61.75,
side −1.

## Convert it yourself — do not trust the sentence I would write

The room MIRRORS the facade, so "0.80 m to the door's left inside" is 0.80 m to
its right outside. I am deliberately not doing that conversion for you.
`alongU` is exported from `ct/tex-world.ts` for exactly this and it is measured
off the mesh uv rather than assumed; when I last let a `side`-based mirror stand
in for it, it moved this shop's neighbour's glazing 2.45 m and put a window in
the wrong place. Take the two local x values above through the same function you
use for the door and the offset comes out right by construction.

## What is actually in the window

A dressed form facing the street — plinth 1.5 × 0.5 × 0.42, a torso and coat
rotated to π so they face OUT — and three small goods on the plinth beside it
(brass, grey-blue, dull rose), the "better stock".

**It is deliberately the one TIDY corner in the room.** A thrift store dresses
its window because that is the only part the street sees; two metres behind it
is a heap of doubled-up rails, a sagging coat bar, a belt bin and unsorted
boxes. If your glass reads as neat and what is dimly behind it reads as chaos,
that is the effect working, not a mismatch to fix.

## One thing I could not settle for you

Whether the glass should show the display SHARP or as a silhouette. The room is
lit at `strip / 0xe4e8dc / count 3` with **one tube dead**, so the interior is
dimmer and cooler than daylight — through glass from a bright street it would
read closer to a shape than to detail. That is your call and your file; I have
made the display legible either way rather than betting on one.
