# `fp` reports a difference that is not there, and it is the same three spheres

**For whoever owns `scripts/scenedump.mjs`.** Not urgent, not a world bug, and
it will waste somebody an hour eventually — it just wasted some of mine.

## What happened

I added `ct/civic-doors.ts`, a module that creates **no three.js objects at all**:
it reads the ground picker and registers two `[E]` spots. Then, per CLAUDE.md,
I proved it moved nothing:

```
without the module   objects=3475  textures=626a2f4c  structure=cc755130
with the module      objects=3475  textures=626a2f4c  structure=375c3e4c
```

Textures identical, object count identical, `structure` different — and
**reproducible in both directions**, so not run-to-run noise. I moved the file
out and back twice to be sure.

The whole difference:

```
only in BEFORE:  3x Mesh|SphereGeometry(radius=0.075,…)|MeshBasicMaterial:ff
only in AFTER:   3x Mesh|SphereGeometry(radius=0.075,…)|MeshBasicMaterial:6a
```

## Why

Those are the casino/hotel marquee **chase bulbs**. `ct/vice.ts:378`:

```ts
const PHASES = 3;
const chaseOn = new THREE.Color(0xfff2c0), chaseOff = new THREE.Color(0x6a5a3a);
const phaseM = Array.from({ length: PHASES }, () => new THREE.MeshBasicMaterial({…}));
```

Three shared phase materials, recoloured **every frame** by a Render hook, plus
a fourth dud that never lights. `structure` hashes `type|geometry|material`, so
the material colour of an animating bulb is inside the structure hash, and what
it reads depends on **which frame the dump happened to land on**.

`scenedump.mjs` already knows about these exact three spheres. Its header says
so, names them, and pins the clock to 13:00 to fix it:

> *"Three runs of IDENTICAL code gave structure 9ad3c4ce, 9ad3c4ce, c0a3f42e —
> it flips. fpdiff names the culprits: three r=0.075 spheres whose material
> colour reads 6a in one run and ff in the next."*

**Pinning the clock was not enough, and the note reads as though it was.** The
chase does not run off the world clock — it runs off frame time, independently.
Pinning the hour stopped the *hour-dependent* colours and left the chase phase
free.

What that bought was **stability, not correctness**. Three runs of identical
code now agree, because startup timing is consistent, so the hash looks pinned.
It is not: anything that shifts when the first frames render moves it. My
module shifted it by doing ~87 000 pure-arithmetic ground queries at build time
before the first frame — no objects, no randomness, no scene change at all.

## Why it is worth fixing rather than knowing

Its own header already argues this better than I can:

> *"An unstable structure hash means that proof reports a difference that is
> not there — and, worse, teaches people to wave real differences away as
> noise."*

That is the failure mode exactly. I now know that "three r=0.075 spheres" means
"ignore me", and the next person to see three spheres in an `fpdiff` will learn
the same reflex — which is fine until the day it is four spheres, or three
spheres *and* something real.

## The fix I would make, and why it is not mine

The bulbs are the only animated-colour meshes in the world, and the project
already has the pattern for this: **the module that knows, says so.** There is
`userData.selfLit` for "bright on purpose", `userData.masonry`, `userData.mod`,
`declareSurface`. This wants the same one line —

```ts
phaseM.forEach((m) => { m.userData.animated = true; });   // in ct/vice.ts
```

— and `matSig()` in `scenedump.mjs` omitting colour when it sees it. Then the
phase leaves the hash and the socket stays in it, which is right: a bulb's
colour is not structure, a bulb's *existence* is. The dead bulb keeps its own
signature and stays checkable, which matters, because "one dead bulb that never
lights" is deliberate and somebody should notice if it goes.

Both files are somebody else's — `ct/vice.ts` and the shared harness — and
CLAUDE.md's own lesson about bundling a fix with the change that revealed it is
written in my queue in the user's words. So: reported, not done.

**Until then:** if `fpdiff` shows you exactly three `r=0.075` spheres differing
only in material colour and nothing else, that is the chase, and your change is
clean. Anything else in the list is real.

---

## Update: `tints` is a SECOND unstable column, and it is not the chase

Found while proving the deprecated-field migration was a no-op. Two runs of
**identical code**, nothing touched between them:

```
run 1   textures=951d46e3  structure=ba64acce  tints=e883664f  places=206665f6
run 2   textures=951d46e3  structure=ba64acce  tints=611e839f  places=8e91700
```

`tints` flips between exactly two values, run to run. It is not the chase bulbs
described above — that leak is in `structure`, and `structure` is rock steady
here across every run I have taken today.

I have not chased what drives it; the likely candidates are the rain wetness
state or the night wash, both of which rewrite material colours on their own
clock the way the chase does, and both of which the dump does not pin. Whoever
owns `wetMats` or the night grade will know in a minute.

**What matters for anyone reading an `fp` diff.** CLAUDE.md's rule — *"Textures
and structure must match"* — is still exactly right, and is now doing more work
than it looks like it is: **two of the four columns are noise**, and only the
two the rule names are evidence.

```
textures    stable    evidence
structure   stable    evidence, EXCEPT the three chase bulbs documented above
tints       UNSTABLE  ignore
places      UNSTABLE  ignore — the drifting pigeons, the documented noise floor
```

If you are about to explain away a difference in `textures` or `structure`,
don't. If you are about to worry about one in `tints` or `places`, don't do
that either — take a second reading of the same build first and see whether it
moves on its own. That control costs one command and it is the only thing that
separates the two cases.
