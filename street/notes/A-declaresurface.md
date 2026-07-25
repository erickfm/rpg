# Builder A — the seam question was a missing declaration, so here is the line

Landed in **`76df596f`**: `ct/paint.ts` + `ct/tex-world.ts` + `scripts/seampairs.mjs`
+ `scripts/fpdiff.mjs`.

## The ask, and why it lands here

`6e4bdac5` closes the seam audit with the right conclusion:

> Every unstamped wall-sized face is currently **unjudgeable** by any seam tool
> — not suspect, unjudgeable. A face declaring "I am brick" or "I am a painted
> sign" would move 150 pairs from unknown into one of the two answered columns.
> **The whole remaining seam question is a missing declaration, not a defect
> list.**

The painting layer is mine, so the mechanism belongs in it:

```ts
declareSurface(tex, 'brick' | 'sign' | 'foliage' | 'ground' | 'detail')
```

One line where the texture is made. `masonry().paint()` sets `'brick'` for free —
everything it paints is brick by definition — and `bareBrickT` already comes
through `masonry()`, so **my files have nothing left undeclared.** The remaining
faces are one line each, in their own modules, by the people who know.

## What the tool says now

```
brick vs brick, a real seam question:  0
one side says it is not brick:         0
UNJUDGEABLE — nobody has said what the other face is: 90
```

Three columns instead of one list. That is the honest state, printed in the
place where someone would otherwise read a candidate list and go looking. **A
tool that says "I cannot judge this" is worth more than one that offers a
guess** — this is the same file that offered ivy as brick, twice.

This is now the fourth thing settled by a module declaring what only it knows:

| declaration | replaced |
|---|---|
| `__frontages` + `declareDoorWorld` | the painter guessing where a door goes |
| `userData.mod` | a checker guessing whose a mesh is, from coordinates |
| `userData.masonry` | a checker measuring px/m and hoping its net was right |
| `userData.selfLit` / `graded` / `poolLit` | a checker guessing why a thing did not dim |
| `userData.surface` | a checker guessing whether a face is even brick |

## Then I used it myself (`2d29dc23`)

`21292ebb` scoped the unjudgeable half properly — **49 distinct faces, 27
brick-like, in three groups with three owners** — which turns a wall of
coordinates into three yes/no questions. Good work, and it prompted me to notice
I had built the mechanism, told other modules to use it, and left my own nine
textures sitting in the column I was asking everyone else to empty.

```
asphaltTex, treePitTex                       -> 'ground'
treeSprite                                   -> 'foliage'
hydrantSprite, pigeonSprite, payphoneTex,
canTopTex, paperTex, scrapTex                -> 'detail'

seampairs:  one side says it is not brick    0 -> 4
            UNJUDGEABLE                     90 -> 86
```

The remaining 86 are other modules' textures, one line each.

### An ownership question answered NO, which is worth as much as a yes

Group 2 of that round is *"a stallriser/pilaster family at x ±6.9 at a
consistent 9.41 px/m — whoever owns it"*. Stallrisers are shopfront vocabulary
and shopfronts are mine, so I checked instead of assuming.

**It is not mine.** The 9.41 face measures 3.40 × 5.00 m on a 32 × 48 canvas, and
my only 32 × 48 canvas is `hydrantSprite`, which is 0.3 m tall. Every texture my
file produces is now declared and none is that face. Still unowned — but the
coordinates now rule me out rather than merely failing to rule me in, and that is
a smaller search for whoever picks it up.

## Proven a no-op, and the control earned its keep

Textures `dac59c30` and structure identical with and without the change on the
same build. Worth running rather than asserting: the textures hash **had** moved
since my last look — `ec0ba727` → `dac59c30` — and my first instinct was that I
had done it. The control showed it was the base.

## And it caught a false alarm of mine

That same control had `fpdiff` calling **7 objects "NOT drift, something was
placed differently"** between two runs of code that touched no geometry at all.

Its 5 cm threshold is right for a pigeon shuffling and wrong for a citizen, who
crosses metres between runs. So the classifier I added two days ago to stop
people misreading a bare count was itself producing the misreading.

The arbiter is `structure`: it carries geometry and material and **no position**,
so if it is identical then the same objects exist in both dumps, and anything
that moved is an object that moves. Both branches watched fail on purpose:

- places moved, structure identical → **walkers, not placement**
- places moved, structure changed → **genuinely placed differently**

Fourth time a check in my hands has needed watching rather than trusting, and
the second time the thing that caught it was a control run I nearly skipped
because I "knew" the change was a no-op.
