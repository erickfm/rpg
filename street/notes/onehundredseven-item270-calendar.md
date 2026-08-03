# w107 — item 270, the calendar: right, bigger, and readable

Worker **onehundredseven**. Port **4188** (`ss -ltn` clean before binding,
`--strictPort`). Everything below is measured on the **BUILT BUNDLE** via
`vite preview`, not on dev.

> *"move the calendar a bit to the right, make it bigger, and make it
> interactable in the same sort of integrated overlay view."*

Also in this session: **item 269 (the bus-stop sidewalk) was claimed, measured,
and released un-actioned** when the user deferred it mid-flight. Its numbers are
at the bottom of this note — they are worth keeping.

---

## What changed, and the root cause in one line

`src/proto/ct/apartment.ts` only. Nothing else was edited.

| ask | before | after | why that number |
|---|---|---|---|
| **a bit to the right** | `AX(-1.05)` = x 198.95 | `AX(-0.80)` = x **199.20** | +0.25 m, and **that is as far as it can go** — see below |
| **bigger** | 0.30 × 0.40 m | **0.48 × 0.64 m** | 2.56× the area, against the 0.52 × 0.70 flyer that used to hang in this slot |
| canvas | 30 × 40 px | **48 × 64 px** | the surface has always been **100 px/m**; 30×40 stretched over 0.48 m would be 62.5 |
| **interactable** | — | `PanelSpec.surface`, 288 × 384 px | sixth tenant of the diegetic framework, no new mechanism |

**The root cause of the "how far right" question is not the wall.** It is
**301's door spot**, at **x 199.360 / z −17.455** — 0.46 m off this same wall,
because the room-side stand-point is `DOOR_PIV_X − 0.55`. `fp.ts:1102`'s tier 1
is *"the spot's centre is inside your own body"* (`d < RADIUS` = 0.36), and a
spot that lands there **wins outright however you are facing**. Move the
calendar further right and the place you stand to read it falls inside the
door's 0.36 m, so the calendar hands you `close the door`. That is the bug the
bed's own comment in this file already records, in this room.

**I proved this rather than asserted it** — see mutation B below.

### The ring now means something

The biro ring has been drawn on this calendar since it was written (*"the whole
reason a calendar is on a wall rather than in a drawer"*) and it referred to
**nothing**. It is **rent day** now — `ct/tenancy.ts` already runs a lease, and
rent is the only recurring dated event this world has. Days behind you are
crossed off in the same biro, which is what somebody waiting on a rent day does
to a wall calendar. **No scheduling system was invented and there is no
scheduling UI:** a wall calendar's only real affordance is turning the page, and
that is the only thing offered (wheel, arrows, or clicking the outer fifth of
either side).

### The epoch is DERIVED, not picked

`ct/tenancy.ts:278` is `noDelivery(day) { return day % 7 === 6; }` with the
comment *"Sunday. No delivery."* — so **day 6 is a Sunday and day 0 is a
Monday**, and any calendar drawn here has to start on one or it disagrees with
the post. **1 September 1997 is a Monday**, which makes the first rent day (day
2) **Wednesday 3 September**, weekly on a Wednesday after that. Nothing else in
the world names a month; this is the only date it has ever authored.

---

## Two bugs found on the way, both measured on the built bundle

### 1. A hard TDZ that killed the world — `ctx.clock` is not a build-time verb

```
ReferenceError: Cannot access 'totalMin' before initialization
    at Object.now  ...  at buildApartment
```

`crosstown.ts:434` calls `buildApartment(ctx)`; `crosstown.ts:437` declares
`let totalMin`. `surfTex` **draws immediately**, so asking `ctx.clock.now()` for
the first paint reads a `let` in its temporal dead zone and throws out of module
init: **no `__ct`, black page**, and a stack that points at the clock rather
than at the caller. The first paint is day 0 now and the frame hook repaints
from the real clock on frame one (`calShownDay = -1` guarantees it).

**This generalises and is worth a GOTCHAS entry, which I have NOT written
because `notes/GOTCHAS.md` is not named by this item.** `ctx.clock` is
documented as a verb the entry point hands out, and nothing says it is a
**per-frame** verb. Any module that reads the clock while building will die the
same way, and the error names neither the clock's owner nor the caller.

### 2. The letter's `standoff: 0.42` does not transfer

I took it from `ct/tenancy.ts`'s letter — *"arm's length, where a person holds
something they are reading"* — and the first overlay frame lost **the month name
off the top and the biro line off the bottom**. A letter is a small sheet; this
page is 0.64 m tall. `crosstown.ts:1227` puts `fov` straight onto `cam.fov`,
which is **vertical**, so the height binds and the distance is arithmetic:

```
standoff = (CAL_H / 2) / tan(CAL_FOV / 2) * 1.18  =  0.725 m
```

Derived in the source from `CAL_H` and `CAL_FOV` so it cannot drift. It is also
just about where you would really stand to read a wall calendar.

---

## Derived or copied?

- **Derived:** the stand-off (above); the canvas sizes, from the metres at the
  density the surface already had; the weekday epoch, from tenancy's own Sunday
  rule; the grain count, from `ct/paint.ts:399`'s own density; the spot's
  distance from the wall, from `fp.ts`'s `RADIUS` against the measured door spot.
- **Copied, with a citation:** `LEASE` — `firstDay`, `everyDays`, `amount`,
  `landlord` — is `ct/tenancy.ts:74-87`'s `RENT`, value for value. **The import
  cannot be written:** `ct/tenancy.ts:4` imports `APT_X0/APT_Z0/ST0` **from
  `ct/apartment.ts`**, so importing back closes a cycle, and **GOTCHAS §28** is
  that a cycled module can be dropped from the **BUILT BUNDLE ONLY** — dev looks
  perfect and the artifact is missing a module. Same trap `ct/atm.ts` hit and
  left alone for the same reason.
  **So the copy has a guard**: `scripts/probes/w107-lease-copy-agrees.mjs`.

**FOLLOW-UP FOR THE DESK:** hoist `RENT` into a leaf module that neither
`ct/tenancy.ts` nor `ct/apartment.ts` imports, and delete both the copy and its
guard. `ct/atm.ts`'s note asks for exactly the same thing about the ATM palette,
so **one leaf module closes two of these**.

---

## How it was proved

All on the built bundle, `SHOT_URL=http://localhost:4188/`.

| | |
|---|---|
| `scripts/probes/w107-calendar-walk.mjs` | **17/17, five runs, zero spread** |
| `scripts/probes/w107-calendar-timetravel.mjs` | **3/3** — the page is live, not baked |
| `scripts/probes/w107-lease-copy-agrees.mjs` | **4/4 fields agree**, exit 0 |
| `npx tsc --noEmit` | clean |
| `node scripts/health.mjs` | `WORLD OK`, exit 0 |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, no new console errors (the Canvas2D/`THREE.Clock`/`CONTEXT_LOST` warnings are pre-existing and none is an error) |

`fp`/`fpdiff` was **not** run and must not be quoted here: this change **adds
meshes and re-rolls textures** (CLAUDE.md's own warning, GOTCHAS §75). The
structural claims are made by the probes instead.

### What the walk probe actually asserts, and why each one exists

1. **THE PROMPT IS NOT STOLEN** — read at **7 stations** facing the wall (0.75,
   0.90, 1.20, 1.60 and 2.10 m out, plus 0.35 m left and 0.25 m right):
   `read the calendar` **7/7**. Plus **two negative cases**: standing on 301's
   own door point facing the door still gives `close the door`, and turned 180°
   away the calendar is **not** offered.
2. **IT IS ACTUALLY DIEGETIC** — the calendar mesh's own `material.map.image.width`
   is read: **48 px idle → 288 px while open → 48 px after**. This exists
   because a `surface` whose `mesh()` fails **degrades silently** to the
   screen-space cabinet, which still opens, still closes, and passes any check
   that only asks *is the panel up*.
3. **YOU CAN GET OUT** — `[E]` and Escape pressed **separately**, each followed
   by actually walking: **0.60 m** and **0.60 m** of movement, and the wall page
   restored on the mesh both times.

`[E]` is **held for 120 ms**, never tapped (BUILDER-BRIEF §5).

### I watched both checks fail before I believed either

| mutation | result |
|---|---|
| **A** — `surface.mesh: () => null` | **16/17**, the one failure being *"open, the calendar wears the PANEL canvas"*. **Everything else still passed** — the panel opened, turned pages and closed. That is the silent degradation the check was written for, demonstrated. |
| **B** — spot moved to `CAL_X + 0.32, SOUTH_Z + 0.55` | **10/17**, prompt **0/7**, every station reading `[E] close the door`. This is not hypothetical: 0.32 m further right is a plausible reading of *"a bit to the right"* and it makes the feature unreachable. |
| **C** — `LEASE.everyDays 7→8`, `amount 45→50` | lease guard **2/4, exit 1** |

Both mutations were reverted and the tree re-verified green.

---

## My own verdict on the after-frames

Frames are in `shots/` (gitignored, so listed rather than committed).

- `shots/w107-cal-before-stand.png` / `after-stand.png` — from where you wake
  up. Before: a small pale rectangle you would not cross a room for. After: it
  reads as a **calendar** at that distance — the red month block, a grid, and
  four days ringed in blue down one column. The move right is visible and
  small, which is what was asked for.
- `shots/w107-cal-after-near.png` — `[E] read the calendar` is offered, and the
  prompt is not the door's.
- `shots/w107-cal-overlay.png` (day 0) — **the one I would show him first.**
  SEPTEMBER 1997, Monday-first, today blocked in red, the four Wednesdays
  ringed, and *RENT $45 V. OKONKWO / DUE IN 2 DAYS* written under it in the
  same biro.
- `shots/w107-cal-day2.png` — the rent day itself: ring **and** today's block on
  the same cell, *DUE TODAY*.
- `shots/w107-cal-day7.png` — the first week struck through, *DUE IN 2 DAYS*.

**Honest reservations, neither worth another round on its own:**

1. At **48 px** the month name, the weekday initials and the biro line are
   *present but not legible* — they read as a word, a header row and
   handwriting. That is deliberate (the layout is identical at both scales, so
   the object does not re-arrange when you step up to it — the fault w41 logged
   against `ct/bank.ts`), but somebody may read it as blur.
2. The framework's caption sits just under the page. With the derived stand-off
   it clears the artwork, but at a shorter window height it would not.
   **This is w41's own finding 4** — *"a diegetic panel might want to nominate
   where its caption goes"* — still open, still not mine to fix.

## Found and NOT fixed — for the desk

1. **`ctx.clock` at build time is a hard TDZ throw.** Deserves a GOTCHAS entry;
   `notes/GOTCHAS.md` is not named by this item so I have not written one.
2. **Hoist `RENT` (and the ATM palette) into a leaf module** and delete the two
   cited copies plus `w107-lease-copy-agrees.mjs`.
3. **The item's brief was wrong on one point** (BUILDER-BRIEF §6a): it says to
   keep the calendar *"clear of the three taped-up snapshots that sit near it"*.
   **The snapshots are on the NORTH wall**, above the bed, with the poster —
   `ct/apartment.ts` hangs them at `NORTH_Z`. Nothing else is on the south wall
   at all. Item 189 (the wristwatch over a horizontal panel's bottom edge) also
   **does not bite**, as the item guessed it would not: this face is vertical.
   Item 150 cannot bite either — `texM` gives this plane **one**
   `MeshBasicMaterial`, so `screenSlot` has nothing to be ambiguous about.

---

## Item 269 — claimed, measured, RELEASED un-actioned

The user deferred it while I was measuring: *"leave the sidewalk bus stop alone
for now."* **No world code was touched.** The measurements stand and are
committed as `scripts/probes/w107-busstop-lane.mjs` and
`scripts/probes/w107-eastwalk-width.mjs`:

- **The pinch is real and the row's 1.15 m is right.** Narrowest clear span
  **1.149 m** at z −35.90…−34.10, between the bench collider at **x 5.731** and
  the east building line at **x 6.880**. Reproduced from `staticColliders()`,
  independently of `laneaudit.mjs`. `BENCH_MAX_X = 5.731` also falls out of
  `ct/props.ts` by hand: `BX_BACK 5.57 + 0.035 + 0.035·cos(0.21) + 0.44·sin(0.21)`.
- **The finding the row did not have.** The east walk **sheet** spans
  **x 5.063…7.00**, the building collider starts at **x 6.880**, and
  `groundAt(x, −38)` steps 0.000 → 0.140 between x 5.00 and 5.05. So the
  pavement is **6.880 − 5.063 = 1.817 m wide BEFORE ANY FURNITURE IS ON IT.**
  The row's *"the shopfront alone leaves only 1.63 m"* comes from `laneaudit`'s
  5.25 band edge, not from the walk's own geometry.
- **So the row's conclusion is right and now stronger:** no bench move and no
  bus-stop move can reach 2 m here, because **the street itself is authored
  under 2 m on this side**. Only pulling the building line back can.
