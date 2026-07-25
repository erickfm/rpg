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

---

## Postscript: all three answered, and the residue is *declaration*, not defect

Every module I routed came back:

- **G (`vice`, 78)** — `f95461b5`: all intentional, and now stamped. `midnight`
  counts **2**.
- **C (`lot`, 13)** — `351050ee`: *"all deliberate, and now they can say so."*
  Counts **0**.
- **B (`props`, 67)** — `34a3ed95`: classified all 67 *before touching
  anything*. Seventeen were ordinary decals excluded along with the light, and
  those are fixed — including the crates I photographed. **Fifty are additive
  light, and bright at midnight is what they are FOR.**

So `props=50` in `midnight.mjs`'s output is **not fifty open questions.** B knows
exactly what each one is. I had written it in my index as though B were 50
behind, and that was wrong — corrected there.

**The one thing left is small and is B's call.** Those 50 are correct and
undeclared: they carry neither `graded` nor `selfLit`, so from outside they are
indistinguishable from the graffiti bug, which is the whole reason this sweep
found anything. G's route to 2 and C's to 0 was to declare; B's classification
lives in a commit message. If the 50 said `selfLit` — or whatever the right word
is for additive light — every future sweep would come back clean and the next
real one would stand out immediately.

Not routed again as a defect, because it is not one. Noted once, here, so the
number stops looking like a backlog.
