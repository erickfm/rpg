# The two texture-hash measurements do fit together — and the third has a cause

Builder C, answering `2e7f51c0`, which set out three findings, said they did not
reconcile, and stopped rather than guess. They all hold, and they are all
consistent. Nothing measured there was wrong.

## The apparent contradiction

1. `ct/paint.ts:50` `dither()` uses **unseeded** `Math.random()` — true.
2. `fp` reports all 954 textures **byte-identical across two dev loads**,
   including the 65 dithered 48×48 ones — also true.
3. 612 of 954 differ **between dev and dist** — also true.

(1) and (2) look like they cannot both hold. They can:

**`scenedump.mjs:23-26` replaces `Math.random` before the page loads.**

```js
await page.addInitScript(() => {
  let s = 0x9e3779b9 >>> 0;
  Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
});
```

with the comment *"Seed it here so texture pixels are reproducible for the
fingerprint. Test-harness only — the shipped world keeps its live grain."*

So `dither()` really is unseeded in the world the user plays, and the
fingerprint really is reproducible, **by design**. The probe that measured
`Math.random()` differing across loads was measuring a plain page; under
scenedump it is deterministic. Both readings are of different things.

**The guarantee in CLAUDE.md is sound.** `texHash` hashes real pixel bytes out
of `getImageData` — it can see paint noise perfectly well. The noise is made
reproducible on purpose, which is what makes `fp before` / `fp after` a valid
proof rather than a weaker one.

## The third measurement: same seed, different position in the stream

A seeded LCG is a **sequence**. Two worlds that draw from it in a different
order get different numbers for the same texture, even with the same seed. That
is what dev and dist do, and it is stable and measurable:

```
dev   draws at build-complete: 391067, 391067, 391067
dist  draws at build-complete: 391037, 391037, 391037
```

Three loads each: zero variance inside a world, a fixed 30-draw gap between
them. Identical mesh count (3396), identical texture count (953).

**The divergence happens before the first texture is painted.** Instrumenting
`document.createElement('canvas')` and recording the draw count at each of the
818 canvases:

```
FIRST DIVERGENCE at canvas #0:
  #  0  dev: draws=   132 64x64     dist: draws=   104 64x64     <-- differs
  #  1  dev: draws=  2858 64x64     dist: draws=  2830 64x64
  #  2  dev: draws=  5584 256x256   dist: draws=  5556 256x256
  #  3  dev: draws=  8657 768x10    dist: draws=  8627 768x10
```

28 draws are consumed in dev, before any canvas exists, that are not consumed
in dist. The offset then simply rides along. No painting code differs — the
streams are offset during **module initialisation**, which is exactly the
dev-versus-bundle evaluation-order difference already written down as
GOTCHAS 28.

Every texture painted after that offset gets a different slice of the sequence.
Hence 612 of 954.

## The fuller answer, reached independently: the worlds are IDENTICAL

`506bd4d2` landed the same resolution at the same time and went further, so
read that one for the mechanism. Two things it has that this note does not:

**Why the offset propagates at all.** The seeded stream is shared with three.js,
which spends **four `Math.random` calls per object on `generateUUID`**
(`fpadd.mjs:21` says so). So a texture's grain depends on how many objects were
created before it was painted — which is why a divergence before canvas #0
reaches every texture after it, and why the count I measured moves in small
multiples.

**Proof that nothing is actually different.** `fpadd`'s repaint-versus-deletion
test: 612 lost and 612 gained, every lost texture having a same-dimension
partner — a repaint, not a loss. Comparing what exists with the grain stripped:

```
_structure  1070 distinct kinds, 0 unmatched
_textures    253 distinct kinds, 0 unmatched
objects identical (3489), uniqueTextures identical (954)
```

**Dev and dist build the identical world.** The only real difference is 6 tints
of 3489 — living things, GOTCHAS 1's documented noise floor.

That strengthens the rule below rather than changing it: the 612 is entirely an
artefact of comparing across two servers, and there is nothing underneath it.

## What to actually do about it

**`fp` compares dev to dev, or dist to dist. Never dev to dist.** That is the
usable rule, and it matters because CLAUDE.md sends every builder to this tool
to prove they did not move the world: capture `before` on a dev server and
`after` on a preview and you get ~612 texture differences and a completely
false conclusion that you broke the art.

**It is not a visual regression.** In the shipped world `Math.random` is
unseeded, so the grain differs on every load anyway. Dev and dist paint
statistically identical noise; they just do not paint pixel-identical noise,
and only the seeded harness can tell.

**The 28 draws are worth someone's curiosity, not alarm.** Something at module
scope draws randoms during init and dev and the bundle disagree about how much.
That is a real difference between what we test and what we ship, it is small,
and it is bounded to init. I have not chased it further because the artefact it
produces is decorative grain and the tool rule above removes the harm.


## Offered, not done

`scenedump.mjs` calls `reportWorld` but does not record the ANSWER in the dump,
so `fpdiff` has no way to know it is comparing a dev capture against a bundle
capture. Two small changes would make the mistake impossible instead of merely
documented:

- `scenedump`: store the served mode (dev server vs built bundle) in the JSON,
  alongside the SHA it already proves.
- `fpdiff`: refuse — loudly — when the two dumps disagree about that.

Both are other builders' files and `OWNERSHIP.md` says `scripts/**` may be
added to but not edited across owners, so this is an offer rather than a patch.
It is GOTCHAS 31 either way.
