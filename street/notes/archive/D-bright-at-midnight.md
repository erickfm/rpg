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

---

## Correction: my counts were taken in a night the player never reaches

Chasing a disagreement between `baa675d7`'s label for the facade-line planes
("vertical shopfront panels") and mine ("lamp splash sheets"), I found something
that invalidates the numbers above.

**The wall-splash sheets only turn on if the clock PASSES THROUGH the evening.**

```
jump 13 -> 23        splash opacity 0
step 13 -> 18 -> 23  splash opacity 0
step 13 -> 20 -> 23  splash opacity 0.286
jump 13 -> 3         splash opacity 0
```

18:00 is not enough; 20:00 is. And it is not a settle ramp — I watched it flat
at 0 for 24 seconds after jumping to 23:00.

**A player never jumps.** The clock runs at a game minute per real second, so in
play the evening always happens and the splash is always there. Only a CHECK can
skip it — and `midnight.mjs` did, along with every sweep in this note.

### What that changes

Same world, same hour, two ways of arriving:

```
jumped to 23:00    props=50            vice=2
stepped via 20:00  props=50  unstamped=9  vice=8
```

Fifteen materials that a player sees were missing from my counts. **My module is
still 0 either way**, but the routed figures (`vice 78`, `props 67`, `lot 13`)
were all taken jumped, so they were short too.

And the specific claim I made earlier — that the nine facade-line planes "sit at
opacity 0, invisible, so their colour cannot matter", which I used to *drop them
from a count* — is wrong. They are invisible only because of how I set the
clock.

`midnight.mjs` now steps through 20:00. Two extra seconds, and it measures the
night the world actually has.

**Both labels were half right.** They are vertical (normals horizontal, so
`baa675d7` is right that they are panels, not ground) AND they are the night
splash (opacity driven by darkness, 0 by day, matching `props.ts`'s own comment
about standing a sheet against every wall on the building line).

---

## Second correction: I was measuring TINT, not brightness

`114c5bef7` could not confirm my routing and found why: **`material.color` is a
tint, white by default.** A material with an untouched white colour and a dark
map renders dark, and my sweep counted the colour.

Measured at HEAD, tint-only against tint × texture × opacity:

```
props   tint-only 50    actually bright 50     <- all genuine, additive light
vice    tint-only  8    actually bright  1     <- 7 are white tint over dark map
```

**So props's 50 were right and vice's were over-counted seven-fold.** That also
means the original routed figures — `vice 78`, `props 67`, `lot 13` — were
measured the same wrong way, and vice's 78 was substantially inflated. G answered
"all 78 intentional" so nothing was built on the bad number, but that was luck.

`midnight.mjs` now multiplies tint by the texture's own mean luminance and by
opacity. My module still reports 0 either way, so no assertion changes; the
printed counts stop being misleading.

### That is three separate ways this one measurement was wrong

1. counting **allocations** instead of appearances (uuids)
2. counting a jumped night that **no player reaches**
3. counting **tint** instead of what reaches the screen

Each looked like a finished measurement. Each was caught by somebody trying to
use the number rather than by me re-reading it — `34a3ed95` chasing the crates,
`72749add` on the rain in `setNight`, and now `114c5bef7` failing to confirm a
routing. **A number nobody consumes is a number nobody checks.**
