# 158 materials are bright at midnight with no record of why — routed, not diagnosed

My graffiti fix (`4955621e`) was one instance of a class, so I swept the whole
world for the same signature rather than assume the alley was special.

**My own module is clean: `mod=street` has zero.** The three tags were the only
ones and they are fixed.

## What the sweep found, at 23:00

Materials that are **neither `userData.graded` nor `userData.selfLit`**, with a
colour luminance above 0.5 — i.e. bright, and with nothing on record saying
whether that is deliberate:

```
                        colour only    actually visible
vice                        84               78
props                       67               67
lot                         13               13
(unstamped)                  9                0
street                       0                0
```

**Every single one has the same signature: `transparent` with no `alphaTest`.**
Not one is excluded by any other route. `ct/props.ts`'s `isGlass` is
`m.transparent && !(m.alphaTest > 0)`, and it is the sole gate.

## I corrected my own number before sending it

The first sweep said 176 and counted **colour only**. Nine of those were the lamp
splash sheets on the building line, which sit at **opacity 0** — invisible, so
their colour cannot matter. Six of vice's were the same. A material at opacity 0
is not bright however white it is, and I nearly routed nine non-findings to
somebody with no owner attached.

## What this does and does not mean

**It does not mean 158 bugs.** Neon is legitimately transparent, legitimately
un-graded and legitimately bright at midnight — `vice` is the casino, and a
casino that dimmed its own signs at night would be the bug. The signature cannot
tell "deliberately bright" from "missed by the grader".

**That is precisely the point.** `ct/props.ts`'s own comment says the `selfLit`
stamp exists so that *"a sheet held at FLOOR_SIGN, graded and deliberately kept
bright, which from outside is indistinguishable from a sheet that was never
graded at all"* becomes decidable. These 158 are in neither category: never
graded, never declared. From outside there is no way to tell a neon sign from my
glowing graffiti, and my glowing graffiti was real.

## Routed

- **G (`vice`, 78)** — most likely the casino neon and correct. Worth confirming
  rather than assuming, because 78 is a lot to be certain about by eye.
- **B (`props`, 67)** — includes the five alley crates and litter I photographed
  reading vivid blue against near-black brick at 23:00 (`shots/al-night-in.png`).
  Those look wrong to me; the rest I have not looked at.
- **C (`lot`, 13)** — unexamined.

**The structural question is B's**: `isGlass` currently carries three meanings —
actual glazing, self-lit signage, and decals that ought to dim. Splitting it, or
requiring the second to declare `selfLit`, would make the other 158 answerable
instead of merely countable.

I have touched none of them.
