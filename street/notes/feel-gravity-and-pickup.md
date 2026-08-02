# Feel pass: gravity, and the pickup's inner tyre clipping

Slot 4 — builder "feel" — from `SESSION-STATE.md`'s restart table. Two small,
both the user's own words, both previously unrouted.

Worktree was on the wrong branch at start (GOTCHAS 52, still true — eight for
eight now): `git reset --hard add-stick-and-city98` + `npm install` before
touching anything.

## 1. Gravity — "make gravity a tiny bit stronger"

**Bounded grant honoured.** Touched exactly one line in the DESK-owned
`src/proto/fp.ts`: the gravity constant at what is now line ~352 (was 341
before the added comment). Nothing else in the file changed — no movement
speed, no `RADIUS`, no `unstick()`, no `pickSpot`, no collision.

`fp.ts:333` (the comment the brief pointed at) already recorded the last
tuning pass: jump velocity and gravity were moved together from 3.6/11 to
4.0/13 to kill float at the apex. That pass is history now, left in place.
This pass only touches gravity, and leaves jump velocity where it was:

| | jump vy | gravity | apex | hang time |
|---|---|---|---|---|
| before | 4.0 | 13 | 0.6154 m | 0.6154 s |
| after | 4.0 | **14** | **0.5714 m** | **0.5714 s** |

Both apex and hang time drop by the same 7.14% (they're tied by the same
symmetric-parabola arithmetic when vy is untouched: apex = vy²/2g, hang =
2vy/g). Experientially: the hop rises a little less high and comes back down
a little quicker — a slightly heavier, snappier fall, which is what "a tiny
bit stronger" asks for. It is a smaller change than the previous 3.6/11 →
4.0/13 pass.

**Verified against every jump the world requires**, not just the two numbers
above. `scripts/jump-walk.mjs` — the suite that checks apex lands in the
intended 0.45–0.8 m band *and* that you land back on the floor you left
(catches the apartment floor-picker hysteresis bug, GOTCHAS §7) — passes on
all seven of its spots after the change:

```
the pavement           gy 0.14 -> 0.14  apex +0.481 m  same floor
the kerb edge          gy 0.00 -> 0.00  apex +0.625 m  same floor
the road                gy 0.00 -> 0.00  apex +0.486 m  same floor
the walk-up stoop      gy 0.14 -> 0.14  apex +0.492 m  same floor
inside, ground floor   gy 0.00 -> 0.00  apex +0.532 m  same floor
the apartment stairs   gy 0.00 -> 0.00  apex +0.532 m  same floor
upstairs               gy 0.00 -> 0.00  apex +0.528 m  same floor
```

Every apex sits comfortably inside 0.45–0.8 m with margin on both sides, and
nothing changes floor. The kerb face (0.14 m, GOTCHAS notes it's ~1-2 texels)
is trivially cleared either way; margin was never tight there.

**Proved nothing else moved**, per CLAUDE.md's fpdiff rule, not by
screenshot: `npm run fp before` → edit → `npm run fp after` →
`node scripts/fpdiff.mjs shots/before.json shots/after.json`.

```
textures   1436 vs 1436 — IDENTICAL
structure  8417 vs 8417 — IDENTICAL
tints      8417 vs 8417 — IDENTICAL
places     8417 vs 8417 — 3 differ
  -> every one has a partner within 5 cm: DRIFT (pigeons), not a move
```

Textures/structure/tints identical; the only places drift is 3 objects under
5 cm (the documented pigeon noise floor). The gravity change did not move the
world.

`node scripts/bugsweep.mjs` after the change: 93 shots, **0 STATION MISS**,
no new console errors (only pre-existing THREE.Clock deprecation / Canvas2D
readback / GPU-stall perf warnings, present before this change too).

## 2. The pickup's inner tyre clipping — checked, and it is fixed

Ledger row: `OPEN | desk | the inner clipping of the tires in the pickup was
never fixed`. `ct/cars.ts` is **H's** file (`OWNERSHIP.md`) — not touched, no
edit made there. A previous builder (H) already took this row and reported
"cannot reproduce" with real work behind it (geometric flank-panel test,
three close-up screenshots). My job per the brief was to re-establish whether
it's real *today*, independently.

**It is not reproducible today, and the git history explains exactly why —
this was already fixed, twice, before H's note was even written.**

What "inner clipping" means, in the user's own words (quoted verbatim in
commit `f67796741`, 2026-07-25): *"the tyre penetrates through into the bed
cavity, so looking down into the bed you can see the wheel inside the truck…
you cut an arch into the outer panel but did not build a WELL."* That commit
built the fix: an inner wall + lid per rear wheel, closing the wheel well as
a real box rather than a painted arch. A follow-up commit (`465409207`,
same day) explicitly ruled that a *proud* (outward-protruding) tyre is fine
— "nobody asked for the tyre not to be proud. On a real vehicle it often
is." — and kept only the well, removing an unrelated fender-flare panel that
had been added and then complained about as "a block sticking out."

I re-derived the current numbers directly from `ct/cars.ts` rather than
trusting the history alone: the rear tyre's inner face sits at **x = 0.70**
(centre 0.82, half-thickness 0.12); the well's inner wall spans **x = 0.66 to
0.70** (`WELL_IN = 0.66`, 0.04 m thick). The wall's outer face and the tyre's
inner face are **flush at x = 0.70** — the wall closes the cavity exactly
where the tyre starts, with no gap and no penetration into the load bed
behind it.

I ran `scripts/bedcavity.mjs` (the existing geometric AABB check for this
exact question) and it still reports the rear wheels as "entering the
cavity box" on all four pickups. **That check is stale, not the world**: its
hardcoded `CAV.x = 0.74` constant is commented as coming from the bed's
*outer side wall* (pre-well geometry, x 0.74…0.90), not the inner well wall
built in `f67796741` (x 0.66…0.70) that actually seals the cavity today. It
is flagging the tyre for crossing a wall position that no longer exists.
Did not touch this script — it isn't mine to fix (no OWNERSHIP line for
`scripts/`, but it's H's check, on H's file) — flagging it here so nobody
re-files a defect off its output without reading the comment on line 33.

**Looked at it directly, four ways**, against the live world on port 4189:
- `node scripts/bugsweep.mjs`'s own four station shots:
  `shots/bug-pickup-{front,side,rear,bed}.png` — clean silhouette, tyre
  sitting in its arch, no visible penetration from any of the four.
- `node scripts/H-pickup-inner-look.mjs` (H's own close-up rig, re-run
  fresh): `shots/H-pickup-{into-bed,flank-low,wheel-close}.png` — the
  flank-low shot in particular puts the wheel arch at eye height square-on;
  the tyre fits the arch with an unbroken flank line.
- Stood inside the truck bed itself, looking down and across at the rear
  wheel well from above — no tyre material visible past the well's inner
  wall or floor.

**Conclusion: real once, already fixed, not currently reproducible.**
Recommend this row be closed as CONFIRMED-by-history rather than routed to
another builder — H's "cannot reproduce" was correct, and a third pass would
spend an agent re-discovering the same well that's already sealing the
cavity. If the user is still seeing something, it is worth asking for a
fresh screenshot (H asked the same thing and never got one) — the geometry
and every station I can think to stand at all agree it's closed.

## Housekeeping

Did not edit `notes/LEDGER.md` — the desk moves rows, per standing
instruction.

Nothing landed outside `src/proto/fp.ts` (one line + comment) and this note.
`ct/cars.ts` was read, not written.
