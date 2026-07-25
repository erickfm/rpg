# BLOCKED — builder B

## Nothing assigned. Not blocked on a dependency; blocked on having no item.

Writing it here rather than saying it in a handoff for the sixth time, because
`notes/queues/README.md` is explicit that the desk should not have to read a
report to discover a builder is stuck, and `scripts/desk.sh` surfaces this file
as an ACTION.

### Measured, not claimed

`notes/queues/B-ground.md` — **md5 `b5f65064`, last modified 2026-07-24 23:30**.
Byte-identical across the last nine rounds. It lists 16 unchecked items; every
one is on mainline:

| queue item | commit |
|---|---|
| Bench pass four | `c889ed23` |
| Bench pass three (skirt, bezel) | `f5eddde1` |
| Side street has no lamps (H blocked) | `d896c64f` |
| Puddles: stop and simplify | `8388d3cc` |
| Milk crate clipping the shopfront | `5653e066` |
| Ad to the backrest + recline | `3e223236` |
| Night five, pieces 1/2/3 | `c7c1c50f` `8977226f` `5316df71` |
| Footprint rule | `7d32dae2` |
| Ship the approved trash set | `cc7e0e76` |
| Catch basin | `ec6caf02` |
| Bus bench backwards | `114675e6` |
| Finish the puddle fix | `652138e3` |
| Finding C, red kerb at the stop | with the bench |
| `[E]` spots | VOID, desk-confirmed |

Off-queue and also landed: the car lot's curb cut (`453890d8`, closed by C),
the park lamps (`3a1f46a6`), and this week's grading and stamp work.

### Why I am not simply finding more

The last nine rounds produced real work, but all of it came from **other
builders' findings on mainline** rather than from a queue — the lane audit's
lamp constant, F's pinched casino approach, the bench-ad audit, A's request for
a `graded` stamp, the rain anomaly. That well is not infinite and it is now dry:
I have scanned the last dozen mainline commits and every open `BLOCKED-*.md`,
and nothing names `ct/props.ts` or `ct/tex-ground.ts` as outstanding.

Another lap would mean going looking for a reason to commit inside two files
that six other builders' work now sits on top of. That is how the night pass
got reverted the first time.

---

## Three things that need ROUTING, not self-assignment

### 1. The fog line — one line, `crosstown.ts:504`, desk-owned

```js
scene.fog!.color.copy(skyCol).multiplyScalar(1 - 0.5 * lampNight);
```

Half the sky at full night is still grey, and grey fog at the end of a dark
street reads as a lit wall closing it off. `1 - 0.82 * lampNight` takes it
toward black. I have raised this every round since the night pass and have not
touched it, because `crosstown.ts` is DESK.

### 2. Two of my own findings need a verdict, not a builder

- **Finding B, "lamp spacing leaves the middle of the block dark."** I
  recommend **closing as superseded**. It predates night five; the user has
  since asked for wider beams and darker unlit stuff so it "feels scarier".
  Filling the mid-block gap would undo what shipped.
- **Finding D, "parking varies but never re-rolls."** The seed is `ct/rng.ts`
  and the draw is `ct/cars.ts`. Neither is mine.

### 3. A measured design question about the lamp pools

Found while explaining nightgrade's last unknown, and worth a human eye rather
than a unilateral change to a system that has been reverted once.

`updateLit` caps the pool at `mul = min(1, amb * (1 + k * POOL_GAIN))`. The cap
is deliberate — it stops a pool blowing out — but it means anything close
enough to a lamp is returned to **exactly its daylight colour**, so the pool has
a flat top rather than a gradient. Measured at 23:00:

```
77 materials are held at full daylight brightness
   height:   min 0.78   median 2.07   max 5.09 m
   distance: median 1.25 m, furthest 5.26 m from a lamp
```

Ground-level things never saturate (`FLOOR_GROUND` 0.045 would need `k > 1`),
so this is a mid-height effect only — signage bands, railings, upper car bodies.
Nobody has complained and it may be exactly right; a lit thing under a lamp
*should* look lit. But "77 objects at literally full daylight in the middle of
the night" is a design decision that was never explicitly made, and the person
who asked for scarier nights should be the one to make it.

**Not stopping on any of these.** There is simply nothing left in my own files
that I can honestly claim needs doing.

---

*Written 2026-07-25. Queue empty and verified; report at
`notes/B-ground-report.md` has the full reconciliation.*
