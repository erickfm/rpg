# BLOCKED — builder H

`scripts/live.sh H`: **1 live, 1 awaiting a check.** Nothing buildable is mine.
BLOCKED rather than WORKING because I am not building; rather than DONE because
live.sh is not empty.

## Read this first: I broke the crowd this session and fixed it

Rewriting `citizenPlane` for the seated pose I inverted a sign, putting every
standing citizen's origin at the crown of its head instead of the shoe —
**the whole crowd 1.66 m underground.**

```
before my rewrite   0.95 - (4/64)*1.9   = +0.831   correct
my rewrite          0.95 - (60/64)*1.9  = -0.831   inverted
now                 (60/64)*1.9 - 0.95  = +0.831   correct again
```

**Fixed and verified in the world: 18 citizens, painted shoe at 0.000 (ten, road
level), 0.140 (seven, the sidewalk height exactly) and 5.400 (one, upstairs).**
No value between, which is what a right origin looks like.

**It survived my own verification, and that is the part worth keeping.** My
seated checks were thorough — all eight sectors, every column's head drop and
foot row — and every one read the ATLAS FRAMES, never the plane the frames are
painted on. GOTCHAS 34, which I had cited twice today before walking into it.
Any future change to `citizenPlane` should force a composed-sprite bounds check.

`health.mjs` said WORLD OK throughout: it proves `__ct` initialises, not that
anybody is standing on the ground.

## 1. AUDITOR — and one of the two things I need is a tool fix

- **The cat row** (`CHECK`) is built and verified foreshortened from the
  player's eye; I may not confirm my own work.
- **The float CONFIRMED is stale.** The auditor's median-0.000 pass predates my
  regression and would have gone red mid-session. It is repaired, but it
  deserves a fresh run rather than inheriting the old result.
- **`scripts/footpaint.mjs` cannot be pointed at another builder's world** — it
  hardcodes `localhost:4184` and ignores `SHOT_URL`, so I could not re-run it
  and measured the same quantity by hand instead. Same class as the canfail
  default port that nearly fooled another builder today. The auditor's script,
  so I have not touched it.

## 2. F and G — the live row is theirs now

`grep -l citizenSprite src/proto/ct/int-*.ts` → **0 of 10**. The seated pose,
the hip origin and the call signature are all published
(`notes/H-seated-sprite.md`). Until a room calls it the user's want is unmet, so
I will not mark the row landed — but as one row it reads as H being late for
work in files I do not own. **Still worth splitting into an H row (done) and an
F/G row (open).**

## 3. Done this session, needing nothing further

Bed floor at 32 px/m with the ribs restated in metres, and the before/after the
ruling asked for (`shots/bedfloor-ribs.png` — pattern identical at both
densities, which is the correct result). D's new alley mouth measured clear and
then added to the keep-clear array so it stays clear by rule rather than by
luck; its span is a literal because `street.ts` does not export `A2_Z0/A2_Z1`,
and exporting it would be an improvement.

## 4. The structural note, fourth instance today

`lit`, `wet`, the cat's per-frame need, and now `footpaint`'s hardcoded port:
leaf modules and leaf scripts each needing something their caller never passed.
`b.pose` solved the billboard case generally. The shape underneath is that a
leaf is BUILT with what it needs and never UPDATED — or in the scripts' case,
never told which world to look at. The desk has this one.
