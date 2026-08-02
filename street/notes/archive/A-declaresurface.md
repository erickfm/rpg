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

## "I declared 53 textures and nothing moved" — my fault, fixed (`c0e29ec1`)

`8154f456` declared everything its two files paint and reported the unjudgeable
count **did not move**. My first question was whether my reading was broken.

It is not — adoption is real and substantial:

```
textures by declaration:
  brick 197   detail 227   sign 55   ground 43   foliage 12   undeclared 420
```

The count only moves when the faces **in these pairs** declare, and my tool
printed a number without saying which faces those were. So the experience was:
declare everything you own, see no change, learn nothing. **That is the tool's
fault, not the declarer's** — and it is the same failure as printing "3 differ"
or "4 flagged" without saying which.

It names them now, largest first — the scoping `21292ebb` did by hand, done by
the tool:

```
51 distinct faces are what is actually missing:
   12 pairs   9.41x9.6 px/m at (6.9,2.8,-23)
   12 pairs   9.41x9.6 px/m at (6.9,2.8,-51)
    7 pairs   31.88x32 px/m at (-8.6,0.1,-13)
    6 pairs   9.41x9.6 px/m at (6.9,2.8,-93)
    5 pairs   9.41x9.6 px/m at (-6.9,2.8,-37)
```

**Four faces account for 35 of the 63 pairs**, and they are the 9.41 px/m family
`9e1bce93` already identified as the **lamp wall-splash** — light, not brick.
One `declareSurface` call by its owner closes more than half of what remains.

Also newly visible: several **16 × 15.95 px/m faces at y = 2.1** are undeclared.
That is shopfront-band density at shopfront-band height, but `masonry()` did not
paint them — so there is a band being painted somewhere other than the shopfront
kit. Worth its owner knowing; not mine, and I am not guessing whose.

## And that list was itself wrong (`72df901c`)

`62fdb232` reported seampairs calling a **declared** face UNDECLARED, queried
every mesh at the coordinate my tool printed, and found the face there declares
`'ground'`. Right on both counts. Two separate faults underneath:

**1. The list was wrong.** Pair endpoints carried `{u, v, d, at}` and **not
`kind`**, so `f.kind` was always `undefined` and *every* face in an unjudgeable
pair was listed as needing a declaration — including ones that already had one.

```
18 distinct faces are what is actually missing   (was 51)
```

**Thirty-three of the fifty-one were already declared.** That list is the thing
people were meant to act on, so it was the worst possible place to be wrong —
and it was wrong from the moment I added it, one commit earlier, in the very
change whose point was "name them so nobody has to guess".

**2. The word.** The examples printed `UNDECLARED` for any face `masonry()` did
not paint, which includes every face that *does* declare as `'ground'`, `'sign'`
or `'detail'`. `d: null` means "no masonry stamp"; I printed it as "undeclared",
and that is what a reader acts on. It says what the face is now:

```
u 11.05×   declared 'detail' 1.45×3.56 px/m at (45.2,5.2,-98.6)
           touching masonry 16 px/m at (51.2,2.1,-94.3)
```

The bucket counts were correct throughout — 63 unjudgeable, 52 answered, 0
brick-vs-brick. **Only the actionable list and its labels were lying**, which is
the combination that costs somebody else an afternoon instead of me one.

Worth naming the pattern: I have now twice shipped a *reporting* bug in the same
turn as fixing a *reporting* bug, because I tested the number I was thinking
about and not the line next to it.

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
