# Item 268 — the hotel now sits the same way round inside as out, and the handedness is derived

Worker **onehundredeight**, 2026-08-03. Port **4642** (`ss -ltn` clean before
binding, `--strictPort`). Everything below measured on the **built bundle**
under `vite preview`, never on dev.

The user, third report of this class: *"the hotel is the right of the casino
outside but to the left inside. again these interior exterior mismatch."*

**Fixed.** Verdict 5/5 MISMATCH before, 5/5 MATCH after, zero spread on either.

---

## 1. The row's own diagnosis was right, and worker onehundredfive's scoping was right

I re-measured both before touching anything, because the row's numbers were over
an hour old (QUEUE §6b) and because the row's *evidence* had already been
withdrawn once.

- The row's `cz: 39.45` / `cz: 51.225` are **world x**, not z — these two
  buildings are on the **side street**, which runs along x at z = −96.
  onehundredfive was right about that and I confirm it: `__ct.doors()` puts
  HOTEL ORPHEUS at (39.51, −96) and SEVENS at (51.29, −96), both with outward
  normal (0, −1).
- The mismatch was **real and current**: 5 runs, all MISMATCH, hotel room at
  cx 874.32 against the casino's 885.68.
- The row's *diagnosis* — *"a constant that does not derive from the thing it
  must agree with"* — was **correct**. This is the rare row where it was.

## 2. Root cause, in one line

**The doc comment over `PARTY` argued the interior is a mirror of the exterior.
It is not, and `localOf` — the function it cited as its authority — is not a
mirror either.**

The comment said:

> *"a room is its facade seen from behind, so what is on your left outside is on
> your right once you are inside (the `localOf` mirror, forty lines down)."*

Interiors are not behind their facades. They are parked in a belt 800 m away
with their own axes and **you arrive by teleport**, so the arrival heading
decides and nothing else does. And `localOf`'s `side` factor **preserves** the
hand rather than flipping it — check it on the east side of the main street,
where greater z is on your right outside and greater local x, also your right,
inside. The comment cited it for the opposite of what it does.

So `west: 'hotel'` was not a typo. It was a correct deduction from a false
premise, written down, which is why it survived four complaints.

## 3. What changed — `src/proto/ct/interior.ts` only

Three things, and only one of them is the fix.

**a. `PartyWall` declares the PAIR; `west`/`east` are derived getters.**
`handedness(rooms)` reads both buildings' door points from `ct/doors.ts`
(`doorPointFor`) and solves the hand from the rig's own convention —
`fwd = (sin yaw, 0, −cos yaw)`, so `left = (−cos yaw, 0, −sin yaw)`. Outside you
face the inward normal, which gives `left = (−n_z, 0, n_x)`; inside you arrive on
`ARRIVE_YAW`. Whichever room that puts on the left inside is the one in the lower
slab. **Nothing is typed and nothing is copied** — the room→building join is the
`int-<id>.ts` filename convention `scripts/interiors-wired.mjs` already enforces.

It is **lazy**, and that is deliberate: forcing `ct/doors.ts`'s eager glob to
collect while `interior.ts` is still evaluating is the import cycle that once
dropped SEVENS from the **built bundle only** (GOTCHAS 28, and the long note over
`MODS` in `doors.ts`). Nothing reads `west`/`east` until `buildAllInteriors`
runs, by which time `publishDeclaredDoors()` collected everything long ago. When
the derivation cannot be made it **`console.error`s and does not cache** — a
party wall with underivable handedness is the defect this function exists to end,
so `bugsweep` goes red rather than the code quietly re-typing a guess.

**b. `beltOrder` anchors the pair's block on its LATER member.**
This is the part that made a bare `west`/`east` swap wrong, and it is why
onehundredfive released the item rather than doing it. The old rule lifted the
*east* room and dropped it after the west one, so re-handing moved the pair to
the other member's alphabetical slot — swapping hotel/casino would have shoved
**the church and the diner 80 m each** for nothing. Anchoring on the later member
makes the block's address a property of the **pair** rather than of which way
round it is. **It is a strict no-op for the pre-268 declaration** — the pair sat
in slabs 800…880 and 880…960 before and still does. Measured, all 12 rooms:

```
slab  400…480  cx  440.00  bank        slab  960…1040  cx 1000.00  jail
slab  480…560  cx  520.00  bodega      slab 1040…1120  cx 1080.00  library
slab  560…640  cx  600.00  burger      slab 1120…1200  cx 1160.00  pawn
slab  640…720  cx  680.00  church  ←   slab 1200…1280  cx 1240.00  tax
slab  720…800  cx  760.00  diner   ←   slab 1280…1360  cx 1320.00  thrift
slab  800…880  cx  874.32  casino  (was hotel  874.32)
slab  880…960  cx  885.68  hotel   (was casino 885.68)
```

Exactly two rooms moved, and they swapped **exact mirror positions** — both are
11.00 m wide, so the party wall plane is still x = 880.00 and the two sill planes
are still at 879.91 and 880.09.

**How "church and diner are untouched" is established, since it is a claim about
a world that no longer exists.** The table above is measured
(`w108-belt-census.mjs`, after). For the before state I did not re-run the census
— I pinned it from two independent records: my own pre-fix measurement of the
pair (hotel 874.32 / casino 885.68, five runs) and **GOTCHAS 86**, which records
the hotel *"at 874.32 in a slab centred on 840"* and the casino *"at 885.68 in
one centred on 920"*. Slabs centred on 840 and 920 are indices 5 and 6, which
fixes the old order as `… church(3), diner(4), hotel(5), casino(6), jail(7) …`.
The after-census reads church at 680 (index 3), diner at 760 (index 4) and jail
at 1000 (index 7) — **the same indices**. Derived, not re-measured, and said so.

**c. `ARRIVE_YAW` hoisted, with a guard.** `spec.arriveYaw ?? 0` became
`?? ARRIVE_YAW`, and a room that is half of a party wall and arrives on a
different heading now `console.error`s. The handedness derivation is only valid
for the belt's arrival convention; this is the check that would have caught item
268 at authoring time, and it exists so the next pair cannot repeat it.

**d. One probe repaired, `scripts/probes/w70-orpheus-walk.mjs`** — reported here
rather than buried, because it is the same defect as the item itself, twice:

- it scraped `{ west: '…', east: '…' }` out of `ct/interior.ts` **with a regex**,
  in the name of "one authoring". That was a second authoring of the
  declaration's *syntax*, and the literal no longer exists, so it exited 3 on a
  healthy world. It reads `__ct.party()` now.
- it paired `[PW.west, 'HOTEL ORPHEUS']` and `[PW.east, 'SEVENS']` **by hand** —
  the room↔building join, typed. It failed two legs while both doors worked
  perfectly, landing the player in the hotel and comparing him with the casino.
  Nothing publishes that join, so it is now **discovered**: walk in, see where
  you come out. And the property asserted is the one that was always the point —
  *the two frontages lead to the two joined rooms, one each* — which is true
  whichever way round they sit. **That last leg is new**; without it two doors
  both landing in the hotel would have passed every other line.

**13/13 legs** after the repair: HOTEL ORPHEUS → hotel, SEVENS → casino, each
exiting onto its own stretch of pavement.

**No other `src/` file was touched.** The item-267 rails in `int-hotel.ts` and
`int-casino.ts` already derive their flank from `PARTY` — both files say in their
own comments that they did it that way *because item 268 might re-hand the wall*
— so they followed for free. Verified rather than assumed, see §4.

## 4. Verification

All on the built bundle at `http://localhost:4642/`.

| check | result |
|---|---|
| `w108-item268-handedness.mjs` **before** | **5/5 MISMATCH**, exit 1, no spread |
| `w108-item268-handedness.mjs` **after** | **5/5 MATCH**, exit 0, no spread |
| declaration vs layout | `PARTY west='casino' east='hotel'` **AGREES** with lower-x/upper-x |
| `w105-party-doorway-walk.mjs` | **5/5 each way**, hotel→casino and casino→hotel |
| `w85-item230-party-threshold.mjs` | 351/351 points floored across the full 2.6 m opening; exactly 2 sill planes at 879.91 / 880.09; both walks pass; 0 console errors |
| `w70-party-wall-clearance.mjs` | widest run clear in BOTH rooms is local z −13.00…−6.10 (**6.90 m**), which contains the declared opening −10.3…−7.7 with 2.7 m and 1.6 m of margin. The 2 m lane is intact |
| `w108-rails-follow-handedness.mjs` | 6/6 — both rooms break the rail on the **party** flank with no segment crossing the opening, and run it unbroken on the other |
| …its negative case | `--expect-broken-on-wrong-flank` **exits 1** |
| `w70-orpheus-walk.mjs` (repaired, see §3d) | **13/13**, including the new "one each" leg |
| `w95-item251-party-on-bundle.mjs` | `__ct.party()` still isolated — pushing a row and writing through element 0 does not reach the world; reports `casino/hotel` |
| `bugsweep.mjs` | **0 STATION MISS, 0 COVERAGE**, 96 shots, no console errors (warnings only: THREE.Clock deprecation, Canvas2D willReadFrequently, GL ReadPixels stalls — all pre-existing) |
| `health.mjs` | `WORLD OK`, exit 0 |
| `tsc --noEmit` | clean |
| `interiors-walk.mjs` | **DID NOT COMPLETE — see §6.4. This item is not covered by the 12-room suite.** |

Re-run on the final committed build (`b2b39a90e`, rebuilt `dist/`): handedness
**5/5 MATCH**, rails **6/6**, `health` exit 0.

**Frames, which I have looked at myself** (`shots/w108-{before,after}-*.png`):

- `outside` — from 8 m back on the pavement, both fronts in one shot: **777
  LOOSEST SLOTS on the left, ORPHEUS on the right.** Unchanged by this work, as
  it must be; it is the ground truth the interior had to be made to agree with.
- `before-inside-east` — from the doorway looking +x: the **casino** floor,
  tables and stools. `after-inside-east` — the same vantage: the **hotel lobby**,
  carpet, elevator, room doors. The pair is mirrored, which is the whole change.
- In every inside frame the rail stubs die into the gold architrave on both
  jambs and nothing crosses the opening — item 267 still holds after the swap.

**My verdict on the after-frames:** correct, and the doorway reads better from
the casino side than before, because you now look from the gaming floor into a
lobby rather than into another gaming room's mirror.

## 5. Instruments left behind

All in `scripts/probes/`, per BUILDER-BRIEF §7a.

- **`w108-item268-handedness.mjs`** — the verdict. `--selftest` (8/8, no browser)
  feeds the pure derivation two synthetic worlds differing only in which room is
  at the greater belt x and requires **MISMATCH** for one and **MATCH** for the
  other, plus a DEGENERATE case. The inside facing is **walked** with a held `e`
  (BUILDER-BRIEF §5), never derived from a door normal — that assumption is what
  gave onehundredfive the opposite answer on its first attempt. Exit 0 match,
  1 mismatch, 3 nothing measured.
- **`w108-rails-follow-handedness.mjs`** — structural, with an inverting flag.
  Selects rails on **shape, never on `visible`** (GOTCHAS 79/79b).
- `w108-belt-census.mjs` — one line per belt room, slab and cx.
- `w108-frames.mjs` — the four frames, all vantages read from `__ct`.
- `w108-five.sh` — five runs of the verdict with per-run exit codes.

## 6. Things I found and did NOT fix — for the desk to queue

1. **`scripts/probes/w85-item230-party-threshold.mjs` exits 0 when it REFUSES to
   measure.** Its "MEASURING THE WRONG WORLD" guard is excellent and it caught me
   twice — but it then `process.exit(0)`, so a caller that checks the exit code
   reads *"the threshold holds"* from a run that measured nothing. Same family as
   the `health.mjs` exit-code bug fixed on 2026-08-02: it should exit **3**.
   `scripts/interiors-walk.mjs` gets this right (exit 3).
2. **`scripts/probes/w105-rail-vantage.mjs` hard-codes which room is which.** It
   prints `casino {…"id":"hotel"…}` now. Harmless mislabelling — the geometry it
   shoots is read from the world — but it will mislead the next reader. One line:
   look the ids up from `__ct.party()`.
3. **The `PARTY` doc comment's claim about `localOf` was wrong for four
   complaints and nothing could catch it**, because a comment is not checkable.
   The `arriveYaw` guard in (c) closes the specific hole. The general one —
   *facade-side and belt-side handedness must agree for every room, not only the
   pair with a party wall* — has no check at all, and it is the same class as the
   user's "make the exteriors match the interiors", asked five times. Worth a row.
4. **`scripts/interiors-walk.mjs` DID NOT COMPLETE and I stopped it. Say so
   plainly: this item is NOT covered by the 12-room suite.** Two attempts. Both
   printed the same three lines — the SHA line, `entry spots: 12 of 12`, and
   `floor predicate ok (RAYCAST): 93467 triangles from 7990 meshes` — and then
   produced no per-room output for **14 minutes**, at which point I killed it.
   It was not wedged: its headless browser had burned **52 minutes of CPU in 10
   minutes of wall clock**, and there were **five other headless browsers on the
   machine** (other agents). So it is a *throughput* problem, not a hang, and it
   may well pass in a quiet moment.

   **And the kill stack says exactly where it was**, which is worth more than my
   "no output" description: it died inside `steadyAt`
   (`interiors-walk.mjs:1612`), called from **`lightLeg`** (`:1626`) out of the
   room loop at `:1503`. So it had cleared the floor predicate and was working
   through the **per-room light legs** — a phase that prints nothing until a leg
   completes, which is why 14 minutes of real progress looked identical to a
   hang. Anyone re-running it should expect a long silent stretch there and
   judge liveness by browser CPU, not by output.

   **What that leaves uncovered:** the per-room escape/prompt/keeper legs for all
   12 rooms. What covers the same ground for *this* change: `bugsweep` (96 shots,
   12/12 rooms, 3/3 sites, 0 STATION MISS), `w70-orpheus-walk` 13/13 on both
   rooms in the pair, `w85-item230-party-threshold` on the doorway, and the belt
   census. **A desk verifying this item should re-run `interiors-walk` when the
   machine is quiet.** It also carries a related risk worth ranking: its
   build-SHA guard is evaluated once at start, so any commit made during its
   ~15-minute run leaves it reporting on a SHA that no longer exists.
