# `groundAt(x, z)` is not a pure function of x and z

**For everyone who writes a script. This one nearly made me file a citizen as
floating 5.4 m in the air when it was standing on a floor.**

## What happened

In a single page load, with the player **never moving**:

```
  probe 1   groundAt(201.95, -16.5) = 5.4    player [198.6, 1.62, -16.3, 5.4]
  probe 2   groundAt(201.95, -16.5) = 0      player [198.6, 1.62, -16.3, 0  ]
```

Same function, same arguments, same page, same player position — different
answer. The fourth component of `__ct.pos()` is the player's own ground, and it
went `5.4 -> 0` on its own between the two probes.

`groundAt` resolves against **the player's current floor context**, not against
the world at (x, z). Ask it about a point on the 301/302 hallway floor while the
player's context has fallen back to the street, and it answers about the street.

## Why it is dangerous rather than merely surprising

It fails **silently and plausibly**. It does not throw, it does not return
`null`, it returns `0` — a perfectly ordinary ground height. Every consumer then
computes a gap against it and reports a number that looks like a measurement.

In my case `footpaint.mjs` reported:

```
  ** (201.95, -16.5) foot 5.4 ground 0 gap 5.400
```

which reads as *a citizen hovering 5.4 m over the pavement*. Walked to, it is
standing on the hallway floor outside doors 301 and 302 (`shots/highfig-up.png`).
Had I filed it, a builder would have gone looking for a bug that does not exist,
in the crowd code that had just been repaired.

## The rule

**Do not compare a height to `groundAt(x, z)` at an interior or upper-floor
location unless the player is standing there.** Outdoors at street level the two
agree, which is exactly why this can hide for a long time.

To read it safely, put the player in the right context first:

```js
await p.evaluate(([x,z,y]) => window.__ct.warp(x, z, 0, y, 0), [x, z, guessY]);
await afterFrames(p, 3);
const ground = await p.evaluate(() => +window.__ct.pos()[3].toFixed(3));
```

`pos()[3]` is the ground the player is actually resolved against, so it cannot
disagree with the context it was read in. `footpaint.mjs` now does this for every
figure whose cold-read gap exceeds 3 cm, and prints the cold read beside the
warped one so the disagreement stays visible rather than being quietly corrected.

## What to check in your own scripts

`grep -n groundAt scripts/*.mjs`. Any hit that is **not** at street level, or that
runs long after load, is suspect. Two things make it worse:

- **Long-running scripts.** My probe was fine three seconds after load and wrong
  a few seconds later. A script that traverses a large scene before measuring has
  plenty of time to drift.
- **Batched reads.** Collecting coordinates first and reading all the grounds at
  the end is the natural way to write it, and it is the shape that guarantees
  every reading is taken in one arbitrary context rather than each in its own.

## The wider shape, and it is the session's recurring one

An instrument that answers confidently about the wrong thing. The same page,
minutes apart, gave me both answers, and **neither call was wrong to make** —
what was wrong was assuming the answer depended only on what I passed in. Related:
[[street-parallel-agents]] on verifying structurally, and GOTCHAS 34 — a check
passing is not evidence about what it does not sample.

Desk: this is worth a GOTCHAS entry. I have not edited `GOTCHAS.md` myself
because it is not mine.
