# FAST LANE — for a batch of small changes. Read this INSTEAD of the long brief.

**The user's instruction, 2026-08-03:**

> "in general i really care about speed. so speedy implementation allows me to
> get feedback quickly. if something requires 5 changes. and they're small
> changes i want to be able to finish that in like 15 min. not 5 hours"

**Five small changes means fifteen minutes. This page exists so you can hit
that.** If you were handed a FAST LANE item, you do NOT read
`BUILDER-BRIEF.md` and you do NOT read `GOTCHAS.md`. They are 3,200 lines
between them and they cost about twenty minutes — which is the entire budget for
the whole batch. Read this page instead. It is the eight things that actually
break people.

## What a fast-lane item is

**A batch of small, independent, low-blast-radius changes, done in ONE pass by
ONE worker, shipped together.** Colours, sizes, positions, labels, a constant, a
swapped texture, a renamed prompt. If a change is small and you can see whether
it worked by looking at it, it belongs here.

**What does NOT belong here** — bounce it back and say so:
- anything touching collision, floors, seats, or the 2 m sidewalk lane
- anything where you cannot tell success by looking
- anything you would need to measure five times to believe

Those go through the normal brief. **Do not be a hero.** One misjudged item in
this lane costs more than the lane saves.

## How to run the batch

1. **Read all N changes first, then make all N edits, then build ONCE.** The
   build and the preview are the expensive part — roughly 30–40 s each. Paying
   that per change is where five minutes becomes five hours. One build for the
   batch.
2. **One commit per change**, so a bad one can be reverted alone. Cheap.
   `git add <exact paths>` — **never `git add -A`**, it has swallowed an entire
   builder's item before.
3. **Look at it once, all of it, at the end.** One preview, walk the few spots
   you touched, done.
4. **`tsc --noEmit` before you hand back.** That is your one mandatory gate. It
   is seconds and it catches the class of thing that breaks the live world.
5. **Hand back a list**: change, file, what it looks like now. One line each.

## The eight that actually bite

These are the traps that cost real time here. Everything else you can discover.

1. **`groundAt` / `groundPick` NEVER return null.** They return `0.00` over void
   and over road alike, so a null check is not a check.
2. **`if (!asyncFn(...))` is ALWAYS false** — a Promise is truthy. This has made
   several checks unfailable.
3. **The player spawns INSIDE apartment 301 at x≈198**, past the region-cull
   boundary. Read the world from spawn and the exterior appears not to exist.
4. **One `repeat` on a box gives three different face densities.** Use `slabBox`
   / `BOX_FACE_DIMS` or your texture stretches on two faces out of six.
5. **A fragment shader is invisible to `material.color` read from JS.** Lamplight
   lives in `POOL_FRAG`. This exact misreading cost three sessions on the jail.
6. **Verify on the BUILT bundle** (`npx vite preview`), not dev. Panel and
   keydown bugs ship differently than they render in dev.
7. **`fp` / `fpdiff` CANNOT survive adding or removing a mesh** — the RNG stream
   shifts and every dithered texture after it repaints. It will report a
   catastrophe that is not there. Pure-refactor tool only.
8. **Use your own preview port (4178+). Never 5177** — that is the user's live
   world.

## Proof, in this lane

**Looking at it IS the proof.** `notes/BUILDER-BRIEF.md` §10a is the standing
rule and it applies double here: the proof must never cost more than the code,
and the user reviews the build himself. **Write no probes. Write no harnesses.
Add no suite legs.** If one of your changes turns out to deserve a real check,
say so in your handoff and let the desk rank it — do not stop the batch to build
it.

## For the desk

**Rows in this lane are ONE LINE each.** The desk's own long rows are part of
what made this slow: a 1,500-character brief for a one-number fix costs the desk
time to write and the builder time to read, and the numbers in it rot within the
hour. Symptom, file, the user's words, done-when. Nothing else.

**Batch by area, not by theme** — five changes in one file beat five changes in
five files, because the reading and the build amortise.
