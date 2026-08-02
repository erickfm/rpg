# w11 → desk: item 0f, "cannot sit at blackjack after standing up from the slots"

## Root cause, in one line

`fp.ts`'s `stand()` never cleared its own `forceUp` safety flag, so when Escape
stood the player up through `ct/hud.ts`'s structural panel-release path
(instead of through `fp.ts`'s own consumption of that flag), `forceUp` was
left stranded `true` and fired again — unseating the player one frame after
their **next** unrelated sit, anywhere in the world.

## The mechanism, precisely

Two independent things happen on the same Escape keydown, both capture-phase
listeners on `window`, both already present before this item:

1. `fp.ts`'s constructor listener (line ~98): `if (e.key === 'Escape' &&
   this.seat) this.forceUp = true;` — a low-level fallback so Escape can
   always get you up even if the normal input-blocking path is broken. It is
   meant to be *consumed* by `update()`'s `if (this.seat) { if
   (input.keys.has('escape') || this.forceUp) { this.forceUp = false;
   this.stand(); return; } … }` on the next frame.
2. `ct/hud.ts`'s panel `gate()` (line ~372377): sees the same Escape keydown,
   calls `p.close()`, which — because the panel was opened by sitting down —
   calls `__ct.stand()` (`rig.stand()`) **synchronously, immediately**,
   before `fp.ts`'s own `update()` loop ever runs again.

Registration order puts (1) first (the rig is constructed once, at world
init, before any panel ever opens) and (2) second, so on a given Escape press
**both** fire: `forceUp` gets set to `true`, and then `rig.stand()` already
runs and sets `this.seat = null` — all within the same synchronous event
dispatch. On the *next* animation frame, `update()`'s `if (this.seat)` guard
is now false (already stood), so the branch that would have reset `forceUp`
back to `false` never executes. `forceUp` is stranded `true` indefinitely.

It sits inert — nothing reads it while standing — until the player next sits
down on **any** seat. The very first seated frame after that sit re-enters
`if (this.seat) { if (… || this.forceUp) { … this.stand(); return; } }`,
sees the stale flag, and calls `stand()` again immediately: sat down, then
un-seated one frame later. From outside (polling `seated` a few hundred ms
later, or watching the player), this is indistinguishable from "the seat
just didn't work" — which is exactly item 0f's report.

**This is the same defect L already found and filed** in
`notes/archive/L-for-C-escape-eats-the-next-E.md` ("pressing ESCAPE to leave a
seat eats the NEXT E press") — L narrowed it to an edge-trigger miss on the
*second* E and stopped short of the mechanism because it required reading
`fp.ts`, `crosstown.ts` and `ct/hud.ts` together, none of which were L's
files. It is not "the next E press" specifically — it is "the next *sit*",
which happens to be entered by E. This item's file grant (`fp.ts`, "the seat
resolver") is what let it be finished.

## The fix

One line, in `fp.ts`'s `stand()`:

```ts
stand(): void {
  this.forceUp = false;   // ADDED — see the docstring above stand()
  if (!this.seat) return;
  …
}
```

Clearing `forceUp` unconditionally, on *every* call to `stand()` regardless of
who calls it or whether a seat was even still set, means whichever of the two
Escape-handling paths gets there first also cleans up after the other. No
other behaviour changes: the fallback still works exactly as before for the
case it exists for (the input-blocking path failing outright).

## Verified

New script `scripts/w11-slots-then-blackjack.mjs`, run on **dev (4190) and the
built bundle via `vite preview` (4194)**, both before and after the fix:

- **Before the fix**: sit at a slot, stand via Escape, warp to blackjack,
  press E → `seated: false, panel: null` (matches the report exactly). A
  *second* E press then seats correctly — confirming the "exactly one edge
  lost" signature from L's note, and confirming this is that same bug.
- **After the fix**: sit at a slot, stand via Escape, warp to blackjack,
  press E → `seated: true, panel: 'ct-blackjack'` on the **first** press.
- Standing via E-while-a-panel-is-open was also tested as a control: E is
  consumed by the panel's own key handler (spin, in slots' case) and never
  reaches the state-exit dispatch at all, so it cannot stand you up — not a
  bug, just not a path that exists. Confirmed by inspection of `ct/hud.ts`'s
  `gate()` (blocks and reinterprets all keydowns while a panel is open) and by
  measurement (`seatedAfterStand: true, panelAfterStand: 'ct-slots'` for that
  branch, both before and after the fix — unchanged, as expected).

New script `scripts/w11-reverse-order.mjs`: blackjack → stand (Escape) → slots
→ sit, the reverse order the item asked to check. Passes on dev and the built
bundle after the fix.

**Existing suites, dev + built bundle, both clean after the fix:**

- `scripts/L-every-stool-seats-you.mjs twice` — this is the exact repro L's
  own note used for "escape eats the next E"; now passes 2/2, confirming this
  fix closes L's bug as well as this item's, because they are the same root
  cause.
- `scripts/seats-walk.mjs` — the full suite over every registered seat in the
  world (TV, apartment door, all interiors). Long-running; see below for
  status.
- `node scripts/bugsweep.mjs` against dev: 0 STATION MISS, 0 console errors
  (only pre-existing deprecation/perf/GPU-driver warnings, unrelated).
- `npx tsc --noEmit` clean, `npm run build` clean.

## Found but not further chased

`notes/archive/L-for-C-escape-eats-the-next-E.md` should be considered CLOSED
by this fix rather than left archived-but-unresolved — the desk may want to
note that explicitly since it was filed against `crosstown.ts`/`fp.ts` without
a resolution recorded.

## Derived vs. copied

Nothing copied. The seat labels (`'sit at the slot'`, `'sit at the blackjack
table'`) used by the new verification scripts are read live from
`window.__ct.seats()` at runtime, the same pattern `L-every-stool-seats-you.mjs`
already uses — not retyped.

---

*w11. Touched: `fp.ts` (the file this item grants as "the seat resolver").
New files: `scripts/w11-slots-then-blackjack.mjs`,
`scripts/w11-reverse-order.mjs`. Did not touch `ct/hud.ts` or
`crosstown.ts` — the fix did not need them.*
