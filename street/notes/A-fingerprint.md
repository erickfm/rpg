# Builder A — the structure fingerprint does not match itself

Landed in **`c073ccfc`**, `scripts/scenedump.mjs` + `scripts/fpdiff.mjs` +
six un-exports in `ct/tex-world.ts`.

**This one is for the desk, because it is about the rule everybody follows.**
`CLAUDE.md`: *"To prove a change didn't move the world: `npm run fp before` →
change → `npm run fp after` → `npm run fpdiff`. Textures and structure must
match."*

Structure does not match. Six dumps of **identical** code:

```
9ad3c4ce   9ad3c4ce   c0a3f42e   9ad3c4ce   c0a3f42e   c0a3f42e
```

## How it surfaced, which is the part worth keeping

I un-exported six internal names and fingerprinted to prove the no-op. Structure
differed. **My first thought was that I had broken something** — and the change
was six `export` keywords, which cannot move a mesh.

So I ran the control: three more dumps of unchanged code. The "before" hash came
back on its own. The tool was wrong, not the change.

`fpdiff` then named the culprits exactly: **three of the car lot's 196 festoon
bulbs**, which alternate between a lit `#fff2c0` and an unlit `#6a5a3a`. Same
geometry, same position, different colour — they animate, so the hash depends on
the instant the dump was taken.

## Two fixes, and one of them did not work

**`scenedump` now pins the clock at 13:00** before dumping — the same hour
`check-seethrough` pins, so the two tools describe the same world. That removes
a real source of variance.

**It does not fix the bulbs.** Six more dumps still flip, because the twinkle
runs on its own frame accumulator and pinning the world hour does not stop it.
Recorded here so the next person does not spend the same twenty minutes
discovering that the obvious fix is not enough.

**`fpdiff` now classifies the difference** rather than printing a bare count.
Derived from the pairs themselves, not from a hardcoded list of things to
ignore — a list would be the stale-constant habit again:

| key | verdict |
|---|---|
| structure | same geometry, colour only → **animated colour, not structural** |
| structure | geometry differs → **this IS a structural change** |
| places | all within 5 cm → **drift** (walkers, pigeons) |
| places | further → **something was placed differently** |

**Proven both ways**, because a classifier nobody has watched fail is not a
classifier. On two dumps of identical code it says animated colour and drift. On
a fingerprint with one geometry parameter and one position deliberately mutated,
it says structural change and moved.

## Why this mattered more than three bulbs

A bare "3 differ" invites two wrong readings:

1. *You broke something* — which is where I started, on a six-keyword no-op.
2. *It always says that, so a difference is noise* — which is where anyone ends
   up who runs it a few times.

The second is the dangerous one. It converts the project's only structural proof
into a formality, and it does so quietly, exactly when someone is relying on it
to ship a change they believe is a no-op.

## For the desk

`CLAUDE.md`'s wording — *"Textures and structure must match"* — is now wrong in
the strict sense. **Textures do match**, run after run, and remain the reliable
half. Structure matches only up to animated colour. Suggested replacement:

> Textures must match exactly. For structure and places, `fpdiff` says whether
> the difference is animated colour / drift or a real change — read its verdict,
> not the hash.

I have not edited `CLAUDE.md`; it is not mine.

## Also in that commit

Six names un-exported from `ct/tex-world.ts` — `dinerFront`, `thriftFront`,
`facadeWindows`, `DP`, `Band`, `WALL_PPM` — none referenced anywhere outside
that file. `uAt` and `Frontage` deliberately kept: `uAt` is the conversion
helper offered to F in `A-glazing-handoff.md`, and `Frontage` goes wholesale
when F is across.
