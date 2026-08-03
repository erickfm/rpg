# Item 277 — the mouse comes back when an overlay closes

Worker **onehundrednine**, 2026-08-03. Port **4650** (`ss -ltn`, `--strictPort`).
Verified on the **built bundle** (`npx vite preview`).

> The user: *"when i exit overlays my mouse stops working as well."*

## The desk's lead was RIGHT — and I confirmed it by driving it, not by grepping

The row offered its trace as a lead, not a verdict. It holds:

- exactly **one** `requestPointerLock` in the whole source, `src/main.ts:32`,
  gated on a canvas **click**
- `ct/hud.ts` releases the lock when a diegetic panel opens, which is
  **deliberate and correct** — you cannot click a screen with a pointer the
  browser has hidden and pinned to the middle of the canvas
- nothing gave it back

Measured before any change, on the five landed overlays
(`scripts/probes/w109-confirm-277.mjs`):

| overlay | held lock before | released while up | **lock after Escape** |
|---|---|---|---|
| mail (155) | yes | yes | **NO** |
| loan (185) | yes | yes | **NO** |
| library PC (157) | yes | yes | **NO** |
| slots (100) | yes | yes | **NO** |

Four of four. The player is left unable to look around until he works out he
must click the world.

## The fix, and why the first cut of it was wrong

**`ct/hud.ts` only.** The re-lock lives where the release lives, as the row asked
— not a second scattered `requestPointerLock`.

**First cut: per-panel state, guarded on `!livePanel`.** It made all four
overlays green and it was **wrong**, and my own leg 10 caught it. `open()` calls
`closePanels()` before raising the new cabinet, so *a panel closing is routinely
a panel being replaced*. Closing a diegetic panel to open a **screen-space** one
re-locked the pointer in the gap and left it **hidden and pinned under the
incoming cabinet** — the exact state the release exists to prevent.

**Second cut, and the actual design: the debt belongs to the SYSTEM, not the
panel.**

- `pendingLock` is one **module-level** slot: the element whose lock the panel
  system took and owes back. It stores the **element**, from
  `document.pointerLockElement`, so this file never learns which canvas the
  renderer owns (BUILDER-BRIEF §8). `null` means *he never gave us one*.
- Recorded **only if non-null** — a second diegetic panel opening over the first
  finds the pointer already released, and `?? null` would overwrite a real debt
  with nothing, leaving the mouse dead after the replacement closed. That is the
  user's complaint reached by a different road, and a per-panel fix passes it.
- `raising` is raised around `open()`'s clearing prologue. A `close()` running
  inside it is a **hand-over**, not an exit: the player is not being returned to
  the world, he is being shown a different screen.
- `close()` hands the pointer back only when `!livePanel && !raising`. The debt
  is **not** cleared when it is not paid, so whichever cabinet closes last pays
  it.

## A SECOND, SEPARATE DEFECT, FOUND BY DOING WHAT THE ROW ASKED

The row said *"keep the try/catch and verify the fallback still works."* Verifying
it showed **the try/catch is necessary and not sufficient.**

Measured in a frame sandboxed without `allow-pointer-lock`
(`scripts/probes/w109-lock-returns-promise.mjs`):

```
what does requestPointerLock RETURN here?
  {"returned":"[object Promise]","isPromise":true,"threwSync":null}

main.ts:32's shape     ->  2 errors, one of them PAGEERROR: Failed to execute
                           'requestPointerLock' … Blocked
sync catch + .catch()  ->  1 error, the browser's own console note
```

**`requestPointerLock()` returns a Promise and throws nothing synchronously.** A
bare `try { … } catch {}` catches nothing; the rejection surfaces as an
**uncaught pageerror**. My new call site is in `close()` — the callback that
un-traps the player — so an uncaught throw there is §11 territory rather than a
log line. It now takes `.catch()` as well as the sync `catch`.

**`src/main.ts:32` has the identical hole and I did NOT fix it** — `main.ts` is
not named by this item (BUILDER-BRIEF §9). See "not fixed" below.

## Every exit path driven — `scripts/pointer-returns.mjs`, 82 assertions

Three claims, deliberately not one:

- **RELEASED** — the lock is gone while a cabinet is up. This was already right,
  and a "fix" that simply stopped releasing would restore the mouse and break
  clicking every diegetic screen in the world. Asserted **first**, so it cannot
  be traded away for the one below.
- **RETURNED** — the lock is back the moment the cabinet closes. The complaint.
- **NOT STOLEN** — a player who never had the pointer does not have one taken.

The 14 exits, all driven, all green:

| exit | what it proves |
|---|---|
| Escape × 5 overlays | the keyed exit |
| `[E]` × 5 overlays | the world's own verb |
| **ATM self-close** | **no user gesture at all** — the one path where a re-lock is not inside an input handler |
| **slots, closed while SEATED** | asserted `__ct.seated()` is genuinely true first, or the leg is a duplicate of leg 1 |
| **loan → pockets swap** | NOT STOLEN: no re-lock under the incoming cabinet |
| **loan → pockets → close** | the handed-over debt is still PAID by the last close |
| **never-locked player** | NOT STOLEN: no pointer seized from someone who never gave one |

## The floors, and both mutation cases

Every leg rests on the player **holding** the pointer before an overlay opens. So
each overlay proves it, the roster is checked against `__hud.panels()`, and the
exit count is asserted (`14 of 14`) so a renamed machine cannot silently drop out
of the loop and leave quiet greens behind.

**The two cases fail apart, with ZERO overlap:**

| case | mutation | result |
|---|---|---|
| `pointer-never-returns` | `ct/hud.ts` never records the debt | **13 of 82 fail — every one a `RETURNED` row.** No floor, no `RELEASED`, no `NOT STOLEN` |
| `pointer-never-locks` | `main.ts` can no longer lock at all | **15 of 29 fail — every one a `FLOOR` row**, and the run collapses from 82 assertions to 29 |

That is the shape that says the guard reads the right quantity. `canfail`: **2/2
CAUGHT, every mutated file restored byte-for-byte.**

**The obvious mutation did not compile and I rewrote it rather than kept it.**
Gating the hand-back with `if (false && …)` makes the block unreachable and `tsc`
rejects it — canfail scored `BUILD  mutation did not compile — rewrite it`, which
is the tool refusing to let a case certify nothing. Mutating the *record* instead
is the same revert reached from the other end.

## Numbers

| | |
|---|---|
| `pointer-returns` | **82 assertions, 0 failures** |
| five consecutive runs | **5/5 exit 0, 82/82, all 14 exits driven every time. Zero spread.** |
| sandboxed iframe | **8/8**; the close path adds **0** uncaught errors |
| typecheck | clean |
| `npm run sweep` | **0 STATION MISS, 0 COVERAGE**, findings: none |
| `node scripts/health.mjs` | `WORLD OK`, exit 0 |
| `checks-registered.mjs` | exit 0 (170 registered) |
| item 199's `watch-vs-panel` | still **32/32** after this change to the same file |
| `npm test` | 17/17 |
| `interiors-walk` (built bundle, build 9825d1234) | **365/369**, exit 0. The 4 failures are PRE-EXISTING and unrelated: `jail: the room keeps its own light after dark`, and `the customer station comes from the world, not from memory` for casino, hotel and tax. Same count before and after this change; none touches a panel or the pointer. The bank and library — the two rooms holding overlays I drove — are **29/29 each** on their own |
| console errors | **0** in every non-sandbox run |

Registered as `['pointer-returns', …, ['pointer-never-returns',
'pointer-never-locks']]` — **default tier**. It drives fourteen exits at five
machines in real time, which sounds like `--slow`, but measured through the
runner it is **73 s / 76 s** against this file's 180 s default-tier ceiling. The
tie-breaker: four guards this week were found correct and registered nowhere, so
putting the guard for the highest-impact bug on the board behind a flag nobody
passes is the same failure with extra steps.

## Found and NOT fixed — for the desk to queue

1. **`src/main.ts:32` leaves an UNCAUGHT rejection in a sandboxed iframe.**
   Same root cause as the one I fixed, measured above: `requestPointerLock()`
   returns a Promise, the existing `try/catch` cannot catch it, and **every
   canvas click in the published artifact raises a pageerror**. One line —
   `.catch(() => {})`. `main.ts` is not named by this item (§9). This is
   pre-existing and my change does not worsen it; the two remaining pageerrors
   in the sandbox probe are both from that site.
2. **The ATM shows its `[E]` prompt at yaw 0 and does not open there.**
   Measured at both ATM spots: at yaw 0 the prompt reads
   `[E] FIRST FEDERAL — use the machine` and pressing `[E]` raises nothing; at
   π/2, π and −π/2 it opens every time
   (`scripts/probes/w109-atm-approach.mjs`). A prompt that offers an
   interaction the press does not deliver is its own defect — the player is
   told he can act and nothing happens. Not touched here.
3. **Item 206's seated-eject is still live** and is not this check's business —
   leg 4 asserts only that the pointer comes back on the way out of a seat.
4. **The world does not boot in a fully opaque sandbox** (`allow-scripts`
   alone, no `allow-same-origin`): `__ct` never appears, 30 s timeout. The
   probe uses `allow-scripts allow-same-origin` — which still refuses pointer
   lock, so the fallback under test is genuinely exercised — but if the
   artifact is ever hosted without `allow-same-origin` it will not run at all.
   Worth knowing; not investigated.

## Files

- `src/proto/ct/hud.ts` — the fix
- `scripts/pointer-returns.mjs` — the guard
- `scripts/checks.mjs` — one row
- `scripts/canfail.mjs` — two cases, plus a `MAIN` file constant
- `scripts/probes/w109-confirm-277.mjs` — the before-measurement
- `scripts/probes/w109-lock-returns-promise.mjs` — the Promise finding
- `scripts/probes/w109-iframe-fallback.mjs` — the artifact fallback
- `scripts/probes/w109-atm-approach.mjs` — the yaw-0 finding
- `scripts/probes/w109-can-we-lock.mjs`, `w109-overlay-spots.mjs` — instrument
  viability and the spot census
