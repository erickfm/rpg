# Item 245 — the row's cause was wrong on BOTH halves. Fixed anyway, differently.

**Worker onehundredtwentythree, 2026-08-03.** Own port **4194** (`ss -ltn` clean
before binding, `--strictPort`). Built bundle, `npx vite preview`.

The row said:

> **The registry ALREADY CLAIMS their figures. Each needs only
> `ok: () => !seatTaken(x, z)` on its seat registration.**

Measured before touching anything
(`scripts/probes/w123-item245-measure.mjs`, `…-where.mjs`), on the built bundle:

| | the row's premise | what is actually there |
|---|---|---|
| **jail bench** | a seat registration missing a clause | **`int-jail.ts` registered ZERO seats.** There was no registration to add a clause to — the bench was not sittable at all. The nearest registered spot to the woman waiting on it was **6.46 m** away, and it was `out to the street` |
| **office chair** | a figure the registry already claims | **the tax office has NOBODY SITTING IN IT.** Its one person, the preparer at `int-tax.ts:297`, is placed STANDING, so `room.person` never claims a seat. `seatTaken` there can only ever be a guard against a future sitter |

Both halves are now done, but neither is the one-liner the row costed.

---

## 1. The jail — the bench had to become a seat before it could refuse one

`src/proto/ct/int-jail.ts`. `bench()` now registers **5 places per bench**, and
the two 4.6 m lobby benches give **10**.

- **Pitch 4.6/5 = 0.92 m, and that number is the point.** `seatTaken`'s
  tolerance is 0.30 m, so a place's nearest neighbour must be comfortably more
  than 0.60 m away or one sitter blanks the next seat along. 0.92 m leaves 3×
  the margin. The casino's 0.65 m lounge pitch — the tightest in the world —
  leaves **0.025 m**, and that is the failure mode this whole class of fix has.
- **`ok: () => room.inside() && !seatTaken(wx, wz)`**, resolved at query time,
  not filtered at registration. The loop runs *before* the woman is placed, so a
  registration-time test reads an empty registry and suppresses nothing. This is
  the thing the row warns against "simplifying", and it is right to.
- **Yaw and facing come from ONE vector.** A seat's forward is `(sin yaw,
  −cos yaw)` (`ct/ctx.ts:72-74`); a person's is `(sin f, cos f)`. Two different
  conventions for the same direction, hand-typed on both sides, is exactly how
  the tax preparer ended up facing his own back wall (item 150b). `bench()` now
  returns `inX/inZ` and both derive from it.

### The two-centimetre coincidence I removed

The waiting woman was at the hand-typed `hd - 3.0`. The nearest of the five
places the bench now offers is **0.28 m** from that — inside the 0.30 m
tolerance **by two centimetres**. The suppression would have worked, by luck,
and any change to the bench's length or pitch would have silently un-suppressed
it while every count still read "10 registered". So her position is now taken
*from the bench's own list* (`westBench.places[4]`, the end nearest the door,
2.36 m in). She moved 0.64 m along her own bench; the distance from her seat is
now **0.00 m**.

## 2. The office — the clause is a guard, and the source says so

`src/proto/ct/int-tax.ts`. All five chairs (2 client + 3 waiting) got
`&& !seatTaken(...)`. **It suppresses 0 of 5 today**, and the comment above the
client chair states that in the source rather than leaving the next reader to
rediscover it.

The office's real complaint — *"[screenshot] fix this"*, a figure clipping a
chair — was the **clip**, and it was already fixed at item 150b by deriving
`PREP_GAP` from the sprite half-width and the backrest reach. I re-read that
code and walked the room; it is right. **The office half of item 245 was
already satisfied, for a different reason than the row gives.**

## 3. How it is proved

`scripts/probes/w123-item245-jail-and-office-seats.mjs` — **23/23, 0 console
errors**, walked in through the jail's and the office's own doors with a HELD
`[E]` (BUILDER-BRIEF §5), never warped into the geometry.

```
10 bench places registered, 9 offered, exactly 1 suppressed
   and the suppressed one is HERS — 0.00 m from the sitter
west bench 5 / 4 offered   ·   east bench 5 / 5 offered   ← NEGATIVE case
sat down: seated() = {x 1005.98, z 10.64, h 0.46}, 0.000 m from the place aimed at
[E] again stands up · Escape also gets out           ← BUILDER-BRIEF §11
tax office: 0 seated citizens · 3/3 waiting · 2/2 client, 0 suppressed
church 18 pews / 17 offered · 10 street benches / 10 offered  ← item 93 intact
```

**Every assertion is two-sided** — exact equality on both the offered and the
suppressed count, not "at least N".

### It is not a sleeper — three mutations, all caught

| mutation | caught by |
|---|---|
| drop `!seatTaken` entirely | 4 FAILs — 0 suppressed, 10 offered, no place matches the sitter, west bench 5/5 |
| tolerance 0.30 → **3.0** (the "blanked the bench" failure) | 4 FAILs — 4 suppressed, 6 offered, west bench 1/5 |
| tolerance → **100** (`seatTaken` effectively always-true) | 5 FAILs, including the **east-bench negative case at 0/5** |

The middle two are the ones a one-sided check sleeps through.

### And nothing else moved

`scripts/probes/w123-item245-nothing-else-moved.mjs`, same build, parent commit
vs this one:

```
before   meshes 8010  colliders 537  spots 283  seats 219   jail-slab colliders 58
after    meshes 8010  colliders 537  spots 293  seats 229   jail-slab colliders 58
```

**+10 spots, +10 seats, 0 meshes, 0 colliders.** `fp`/`fpdiff` is not usable
here and was not used — it is a pure-refactor tool and one moved sprite shifts
the geometry stream (BUILDER-BRIEF §10).

`node scripts/bugsweep.mjs`: **0 STATION MISS, 0 COVERAGE**, 96 shots, no
console errors (the THREE.Clock and Canvas2D warnings are pre-existing).
`npx tsc --noEmit`: clean. `node scripts/health.mjs`: **WORLD OK**, exit 0.

---

## 4. What I found and did NOT fix

Three of these are real; none is inside item 245's named files, so they are
reported rather than touched (BUILDER-BRIEF §9).

1. **`ct/int-diner.ts` — the "you sit where he sits" class is STILL LIVE in the
   diner, and it is the last one.** Two seated customers sit at **0.00 m** from
   two registered `take a booth seat` places, and the registration at
   `int-diner.ts:284` is `ok: room.inside` with no `!seatTaken`. This is the
   same defect item 93 fixed in the church and the casino; the diner was simply
   never on anybody's list. **One clause, and the file already imports nothing
   it would need beyond `seatTaken` from `./interior`.** Worth a row on its own.
2. **`ct/int-tax.ts` — the preparer's own chair is not sittable.** `chair()` is
   called twice per desk and only the client's (`CLIENT_CZ`) is registered; the
   preparer's (`PREP_CZ`) is registered nowhere, ×2 desks. That is two chairs
   against the standing rule *"for every seat in the game i want to be able to
   sit down"*, which this same file quotes twice. I left it because letting the
   player sit in the preparer's chair while he stands behind it is a design
   call, not a bug fix, and the row did not ask for it.
3. **`ct/int-jail.ts` — the cell bunk.** The prisoner at `:947` sits on his bunk
   and that is registered as no seat either. I left it deliberately: it is
   inside a locked cell and "sit on a prisoner's bunk" wants a decision, not a
   clause. The claim is in the registry already, so whenever somebody does
   register it the suppression is free.
4. **`npm run walk` fails one check — `and pressing E opens the machine: 3
   full-screen panels -> 3` (the ATM).** **PRE-EXISTING, not mine**: I rebuilt
   the parent commit (`8724256b9`) into `dist/` and ran the same suite against
   it, and it fails identically. Everything else in the suite passes.

## 5. Derived vs copied

Everything is derived. `BENCH_Y`, `BENCH_D` and the bench length come from
`bench()`'s own arguments; the seat pitch is `len / BENCH_PITCH_N`; the woman's
position is `westBench.places[…]`; both headings come from one `inX/inZ`. The
one figure quoted rather than imported is `seatTaken`'s **0.30 m** default,
cited to `ct/interior.ts:927` in the comment and never retyped as a literal —
the call passes no tolerance, so the default is the only copy.

## 6. One instrument bug, caught and written up

The first run of the probe reported *the wrong place suppressed*. `__ct.spots()`
publishes the **approach point**, not the seat: `crosstown.ts:449-458` registers
a seat's spot as `{ x: at.x, z: at.z }` with `at = s.approach ?? s`, so any seat
with an approach reports a coordinate 0.85 m from its cushion. The world was
right and the instrument was not — BUILDER-BRIEF §7 exactly. It now joins
`spots()` to `__ct.seats()` on the approach and asserts the join succeeded
10/10, so a future change to that shape fails loudly instead of silently
measuring the floor beside the bench.
