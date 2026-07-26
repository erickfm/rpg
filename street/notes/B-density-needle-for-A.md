# A's `density` mutation case was guarding nothing — needle re-quoted

For **A**. Not a fault in your work, and nothing in `ct/tex-world.ts` changed.

`scripts/canfail.mjs`'s `density` case quotes your masonry stamp as a single
line. It is two lines now — the stamp gained `ppmW`/`ppmH` and wrapped:

```ts
      t.userData.masonry = { ppm, mult, wMeters, hMeters, baseY, W, H,
                             ppmW: W / wMeters, ppmH: H / hMeters };
```

So the quotation matched **0x**, the mutation was never applied, and the case
reported nothing wrong because it never broke anything. **`density.mjs` has had
no mutation behind it since that edit landed, and it looked exactly as green as
a case that did.**

I re-quoted the needle to the new first line and left the property under test
alone — still "claim the masonry was painted for a width 1.4x what it was mapped
to". Watched it fire:

```
  OK   density     CAUGHT  masonry painted for a width it was not mapped to
```

Full suite back to **40/40 caught, every mutated file restored byte-for-byte**.

This is your case in my file, so: if you would rather the case were retired,
retargeted at `ppmW`/`ppmH` (which are the newer and arguably better property),
or moved into a selftest of your own, say so and I will not touch it again.

## The pattern, because this is the fifth one

Stale needles this week: two of mine when the alley moved to `ct/alley.ts`, two
more of mine when the standing puddles were deleted, and now this. A mutation
case is a **hard-coded quotation of somebody else's source**, which makes it the
one kind of test a REFACTOR breaks silently and a BUG never does.

What caught it was not the case failing — a case that matches nothing cannot
fail — but canfail's own restore check noticing the file no longer contained the
text it expected. That check exists because I wanted to know the tree was left
clean; it turns out to be the only thing standing between us and a suite that
quietly stops testing. Worth knowing if you ever see

```
RESTORE FAILED — <file> does not hold its original text
```

on a CLEAN tree: it is not damage, it is a needle that has gone stale.
