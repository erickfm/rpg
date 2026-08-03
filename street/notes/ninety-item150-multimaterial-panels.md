# Item 150 — a cast froze the world; the row called it a throw

Worker ninety, 2026-08-03. Port **4460**, built bundle, `vite preview --strictPort`.

## Root cause, one line

`ct/hud.ts` cast `mesh.material` to a single material when borrowing a face for
a diegetic panel; `THREE.Mesh.material` is legally `Material | Material[]`, and
on an array `mat.color` is `undefined`, so `savedColor = mat.color.getHex()`
threw **out of `open()`** — **after `gateUp(true)`** had already raised the gate
and captured input.

## The desk's escalation was right, and the row understated it

The row says "throws on a multi-material mesh rather than degrading". The
consequence was worse and I measured it:

```
panel()=ct-atm while the wrapper is at opacity 0
  — input is captured and there is nothing on screen
```

`open = true`, `livePanel` set, `gateUp(true)` done, and the throw landed before
`wrap.style.opacity = '1'` ever ran. So the player is **frozen, looking at the
world, with no panel visible** — Escape-recoverable only, and indistinguishable
from a hang. That is BUILDER-BRIEF §11, not "a check throws".

There was a quieter half too: **`mat.map` on an array is `Array.prototype.map`,
a function**, so `savedMap` captured a function and `close()` assigned it back
before throwing the `setHex` mirror.

Reproduced on **all three** diegetic panels — `ct-atm`, `ct-letter`, `ct-loan` —
by wrapping their screen material in a **one-element** array, which changes
nothing about how they render.

## Confirmed: the danger is live one mesh away

`ct/apartment.ts:1534` — the mailbox bank — really is a six-element array:

```ts
const mail = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.0, 1.5),
  [mailFrame, texM(mailT), mailFrame, mailFrame, mailFrame, mailFrame]);
```

Its own comment says *"Face 1 is -x, which is the face turned into the hall."*
So it is not merely multi-material, it is a mesh with an obviously-correct
`materialIndex` waiting for a caller. Nothing hangs a panel on it today.

## The fix, and why it is a CLASS fix

`screenSlot(mesh, surface, panelId)` resolves the slot: the caller's new
`surface.materialIndex`; else slot 0 **only when the array has exactly one
entry** (nothing to be ambiguous about); else a `console.error` naming the mesh
and a degrade to the screen-space cabinet. **Guessing a slot would paint the
panel onto the wrong face of a box** — a visible bug that is hard to trace back
to `hud.ts` — whereas degrading gives the player the cabinet that panel would
have had anyway, which is exactly where a null `mesh()` has always landed.

But handling arrays alone would have left the shape intact, which is the desk's
second point and it is the important one:

> **Both calls after `gateUp(true)` are CALLER code.** `spec.surface.mesh()`
> belongs to whichever module owns the machine; `FOCUS.enter()` belongs to
> `crosstown.ts`. Neither is `hud.ts`'s to trust, and either can freeze the
> world.

So both regions are now wrapped, and every failure lands on the cabinet. The
hang's undo is gated on a `saved` flag, because a throw *before* the two saves
would otherwise restore `savedMap`/`savedColor` left over from the previous
panel and paint another machine's face onto this mesh.

I did **not** move `gateUp(true)` later. It has to precede `paint()` and the
layout work, and moving it would change opening behaviour for all seven panels
to fix a problem that sealing the throw paths already fixes completely.

## The check: `scripts/screenslot.mjs`, registered in `checks.mjs`

Four legs per diegetic panel: a ONE-slot array still hangs on the mesh; a
TWO-slot array degrades; a **SIX-slot box carcass** does not freeze the world;
and every case still closes. Plus a population floor — 3 of 7 panels are
diegetic today, and if that reaches zero the file FAILS rather than certifying
an empty set.

### Watched failing on the real pre-fix source

**13 assertions red** across all three panels, exit 1, including the freeze line
quoted above. `canfail screenslot-blind` and `screenslot-guess`: **2/2 CAUGHT**,
pre-pass 1 of 1 green.

## ⚠ My own freeze assertion passed VACUOUSLY on the first attempt

Worth recording, because it is the exact trap this project keeps naming. I put
the three state reads **inside** the `try` around `openPanel`. When `open()`
threw — the case the assertion exists for — they never ran, `up` stayed `null`,
and `frozenBlind` was `false` **by absence**.

```
FAIL a SIX-slot box carcass does not throw
OK   a SIX-slot box carcass does not FREEZE THE WORLD WITH NO PANEL UP   ← lie
```

Twelve assertions went red on that run and the one that mattered stayed green.
Moved outside the `try`; it now reads the state whether or not `open()` threw.

## And why there is NO `screenslot-freeze` mutation case

I wrote one (`backdropUp(true);` → `throw err;`) and it **SLEPT**. The reason is
a fact about the fix, not a gap: after it, a multi-material mesh never *enters*
the hang — `screenSlot` returns null and `onMesh` is cleared before it — so the
hang's catch is unreachable and the mutation does not mutate. **Reproducing the
freeze now takes two independent regressions**, and `canfail` applies one needle.

I removed the case rather than ship a sleeping one, and wrote the reasoning into
`canfail.mjs` so nobody "repairs" it with a case that reddens for an unrelated
reason. The pre-fix run is the evidence.

## Two corrections to the row, per the desk

1. Item 150 does **not** block item 155 — confirmed, a letter's surface is a new
   single-material sheet. I gated nobody.
2. The row named `ct/hud.ts:~899`; the actual sites are **1081/1091** (open) and
   **1150/1152** (close) on the pre-fix file.

## Found and NOT fixed — for the desk

1. **`ct/apartment.ts:1534`'s mailbox bank is the obvious first tenant** of the
   new `materialIndex`, and face 1 is already documented as the hall-facing one.
   Not mine — item 150 names `ct/hud.ts` only.
2. **`materialIndex` is covered by typecheck and by the code path, but not by a
   runtime assertion**, because `PanelSpec` is closed over inside `makePanel`
   and no `__hud` affordance exposes it. Exposing one would make the "named slot
   is honoured" leg testable; I did not add API surface for it.
3. **`window.__hud` is undocumented in the brief.** Three probes of mine reached
   for `__ct.panels()` first. A line in GOTCHAS would save the next agent the
   same detour — `__ct` is the world, `__hud` is the panels.

## Derived or copied

Nothing retyped. `DISMISS_LOCKOUT` (500) and the wrap/canvas element split are
cited to `hud.ts` line numbers in the check's own comments rather than copied as
values; the check waits 700 ms, which is the lockout plus margin.

## Verification run

- typecheck **clean** · `node scripts/health.mjs` → `WORLD OK — __ct initialised`
- `npm run sweep` → **0 STATION MISS, 0 COVERAGE**, inherited warnings only
- `npm run checks --only screenslot` → ✓
- `canfail screenslot-blind screenslot-guess` → **2/2 CAUGHT**
- **`K-atm-walk.mjs` all good** — including `CONTROL: the freeze is lifted when
  it closes (1.16 m)` and `ESC closes it`, on a diegetic panel
- **`M-bank-int-walk.mjs` 54 of 54 passed**
- `H-slot-escape-only.mjs` — one Escape closes and stands you up
