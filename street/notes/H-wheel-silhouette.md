# The wheel ruling: the condition, discharged

The ruling was applied in `465409207` — the flare came off, and my wheel tuck
(±0.82 → ±0.77) came off with it, because that was the same inference. What was
never done was the ruling's CONDITION: *"orbit and confirm nothing sits outside
the silhouette of tyre and body."* Here it is.

Measured structurally rather than by orbiting a camera, because a still frame
cannot prove an absence and 360 stills cannot either — what the orbit is looking
for is "is any mesh outboard of the tyre", and that is a number. Every mesh in
each vehicle, world box, compared against the tyre's outer face and the body's
widest point.

**Each side measured independently, never one flank and a mirror argument**
(GOTCHAS 27). The two columns below are two separate computations over two
separate sets of vertices; they are not one number negated.

| | tyre | body | outermost | protruding |
|---|---|---|---|---|
| sedan, +x / −x | +0.940 / −0.940 | +0.900 / −0.900 | tyre | none / none |
| hatch, +x / −x | +0.940 / −0.940 | +0.900 / −0.900 | tyre | none / none |
| pickup, +x / −x | +0.940 / −0.940 | +0.900 / −0.900 | tyre | none / none |
| van, +x / −x | +0.940 / −0.940 | +0.900 / −0.900 | tyre | none / none |
| bus, +x / −x | +1.180 / −1.180 | +1.100 / −1.100 | tyre | none / none |

The taxi is not a fifth row: `CarKind` is `sedan | hatch | pickup | van` and
`taxi` is a flag on the same geometry — it changes paint, not shape, so the
sedan row IS the taxi row.

**The tyre is the outermost thing, by 40 mm on the cars and 80 mm on the bus,
and that is the intended state.** The user: *"Nobody asked for the tyre to stop
being the outermost thing; that was an inference and it is what introduced the
protruding block. On real vehicles the tyre often is proud of the body and it
reads fine."*

Nothing protrudes: no mesh on any of the five sits outside `max(tyre, body)` on
either flank, to a 2 mm tolerance.

## Why the geometry is exactly symmetric here, and why that is not the door bug

±0.940 against −0.940 looks like the mirroring fault I reported in
`H-fleet-texture-review.md`, and it is worth saying why it is not. The wheels
are PLACED symmetrically — `for (const wx of [-0.82, 0.82])` — so the geometry
is genuinely the same width both sides, and measuring it twice returns the same
magnitude because it is the same magnitude.

The door fault is in the TEXTURE, not the geometry: one `sideT` handed to both
the +x and −x faces of a box, whose opposite faces carry UVs running in opposite
world directions. Geometry symmetric, paint mirrored. That one is still open and
is the next thing I am doing.
