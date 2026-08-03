# Item 93 — defect 2 FIXED as a class. Defect 1 NOT confirmed either way.

**Worker eightynine, 2026-08-03.** Port 4450, built bundle `93f9a23d6`.

The row names two defects and says *"Fix both or say which you left."*
**I fixed the second and I am leaving the first.** Which one is which, and why:

| | the user's words | state |
|---|---|---|
| **defect 2** | *"if you sit in his pew you sit where he sits and that just breaks immersion"* | **FIXED, as a class, verified 9/9 with population floors** |
| **defect 1** | *"when folks sit, they clip"* | **NOT FIXED, and NOT DISPROVED** — see §4. Do not read this as "it is fine" |

---

## 1. Defect 2 was a CLASS, and the class is one line long

Every room places its sitters at **exactly the coordinates it registered a seat
at** — on purpose, so a figure sits *on* a stool rather than near one — and then
registers that seat as free. Measured, the same shape in three places:

| room | figure | seat it sits in |
|---|---|---|
| `ct/int-church.ts` | the praying woman, row 3 left | `ctx.seat` at `wx(side*PEW_CX), wz(pz)` |
| `ct/int-casino.ts` | the lounge sitter | the bench place at `LOUNGE_Z − 0.325` |
| `ct/int-casino.ts` | **all four** slot players | the stools at `BANK_Z ± 1.02` |

**Six figures, six seats you could sit inside.** The row also recalls the same
complaint against a jail bench and an office chair, so a per-room fix would have
been four edits today and a fifth room tomorrow.

## 2. Where the fix lives, and why there

`ct/interior.ts`, beside `person()` — the one call every seated interior figure
goes through:

```ts
export function seatTaken(wx, wz, tol = 0.30): boolean
export function claimSeat(wx, wz): void
```

`room.person(..., { seated: true })` claims automatically. `ct/int-casino.ts`'s
own `sitter()` calls `claimSeat` by hand, because it bypasses the kit wrapper on
purpose (a sitter needs the SEAT TOP where `person()` takes the floor) and it
**already** hand-stamps `userData.citizen` and `.seated` for exactly the same
reason — its own comment records the five figures that went invisible to every
people-sweep the one time it forgot. This is the third item on that list.

**Two decisions worth keeping:**

- **`tol = 0.30 m`, deliberately small.** The tightest seat pitch in the world is
  the casino lounge bench at **0.65 m**. A generous radius would blank a whole
  bench because one man sat on the end — which is the actual failure mode of a
  fix like this, and is what the population floors below are guarding.
- **Wired through `Seat.ok`, NOT filtered at registration.** Rooms register
  seats *before* they place people (church pews at `:467`, its figure at
  `:1017`), so anything resolved at registration reads an empty registry.
  `crosstown.ts:398` calls `ok` lazily once per frame, so build order cannot
  fool it — and a figure added to a room later needs no seat revisited.

Coordinates are read back off the placed mesh (`s.mesh.position`) rather than
recomputed from `lx`/`lz`: `place()` has already resolved local→world and the
room group sits at the world origin, so the registry cannot drift from where the
figure actually is. (BUILDER-BRIEF §8 — derive, never retype.)

## 3. How it was proved — `scripts/probes/w89-item93-occupied-seats.mjs`

**9/9 checks, 0 console errors.** Every assertion carries a population floor:

```
church  18 pew seats registered, 17 offered, exactly  1 suppressed
casino  87 slot stools,          83 offered, exactly  4 suppressed
casino   8 lounge places,         7 offered, exactly  1 suppressed
NEGATIVE 10 street benches, nobody on them,          10/10 still offered
```

The negative case is the one that matters: if `seatTaken` were accidentally
always-true, every "suppressed" count would still look like success while the
world quietly lost every seat in it.

### Two of my own assertions were wrong, and the world was right both times

- I asserted **36** pew seats because `int-church.ts`'s own comment says *"All 36
  of these pews were registered"*. That is 36 pew **benches** (18 rows × 2
  sides); `spots()` reports **18** seats. The comment was not lying — I read a
  number out of prose instead of measuring it.
- I matched `'sit down'` and got **40** seats of which **31** read as suppressed.
  Those 31 are `room.inside()` saying *"you are not in the hotel"* — nothing to
  do with this change. Quoting that as a win would have been the fix taking
  credit for a gate that was always there. Now filtered to within 14 m.

## 4. ⚠ DEFECT 1 — I am NOT claiming the clipping is fixed

Both files carry recent, specific comments saying it already was: `int-church.ts`
records replacing a standing sprite squashed to `h 0.62` with H's seated pose at
`PEW_TOP` (*"citizenPlane owns the 0.445 m hip offset; no fudge here"*), and
`int-casino.ts` opens its `sitter()` with *"NO Y FUDGE ANYWHERE"* and places on
`STOOL_TOP`. That is real evidence and it is **source evidence, not a frame.**

**I tried to photograph all 14 seated figures and did not get a usable image.**
`scripts/probes/w89-item93-look-at-the-sitters.mjs` finds every one of them by
the kit's own `userData.citizen && .seated` tag (so it needs no coordinates
typed), stands 2.2 m off on two headings and shoots. First run: **all black** —
the region cull hides an interior you are not registered as inside, and a warp
does not enter a room. With `cullRegions(false)` the frames render but the
camera lands inside walls at that stand-off.

**The probe is committed and is most of the way there.** What it needs is to
enter the room properly (walk in through the door, or shorten the stand-off and
raise the eye) rather than warp beside the figure. **Whoever takes this should
not re-derive the figure-finding half; it works.**

So: the user said *"when folks sit, they clip"* against a screenshot, twice. I
have not reproduced it and I have not refuted it. **Treat defect 1 as open.**

## 5. What I did not touch

- The **jail bench** and the **office/filing-cabinet room** the row folds in as
  the third and fourth cases. They are not named in the item's file list. **They
  now only need the one `ok: () => !seatTaken(x, z)` clause** if their figures go
  through `room.person` — the registry already claims them, so it is genuinely
  one line each. Worth a follow-up row.
- `ct/int-library.ts` — item 158 is DOING and item 115 is a relayout of the same
  room.

## 6. Inherited state

`npm run sweep`: **0 STATION MISS, 0 COVERAGE**, no console errors — the
`[interior:hotel] NO BUILDING NAME` warning is pre-existing.
`node scripts/health.mjs`: **WORLD OK**, exit 0, build `93f9a23d6`.
`npx tsc --noEmit`: clean.
