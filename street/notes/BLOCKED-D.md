# Builder D — blocked

You cleared the old file in `34a9563e`, so this is a fresh one. **One item
left.** Everything else that was in here has landed.

---

## The `[E]` counters need two additive fields on `ctx`

This is the last item on my queue and the only one I cannot take. The queue
says *"Builders C, F and H have all done this — copy them"*, and I did copy
them for the bodega's two DOOR spots, which landed. The counters are different:
they are the only registered spot in the world that spends money, and `ctx`
carries no money.

`ctx.ts` is DESK in `OWNERSHIP.md`, so I have not touched it. It is two
additive fields, `Purse` is already exported from `ct/hud.ts`, and there is
exactly **one** place that constructs a ctx — so this is a one-commit change
with all its callers in it, not a migration:

```ts
// ct/ctx.ts, in CtxBuild — additive; nothing that exists changes shape
  /** the player's money and pockets */
  purse: Purse;
  /** call after changing `purse` so the wallet readout catches up */
  refreshWallet: () => void;
```

```ts
// crosstown.ts, where ctx is built — the only construction site
  purse,
  refreshWallet: () => hud.refreshWallet(),
```

The moment that lands I move both counters into `ct/bodega.ts` beside the two
doors and delete the `SPOTS.push` block, which then has nothing left in it.
The walk-proof already exists and passes today (`cereal counter`, `soda
counter`).

I have not done it myself because the rule is explicit — a shared module's
existing shape is a desk operation — and because unlike the one-line
`street.setWindows(hourF)` I did add to `crosstown.ts`, this one changes an
interface that every other builder's module receives.

---

## Not blocked, but you should know

**Builder A's shopfront-geometry mandate in `ct/street.ts` should read
`frontageOf()`, not restate numbers.** I have just changed the band table
(`e7031eab`): the stallriser is now 0.35 m on every character and the glazing
2.28–2.48 m. `frontageOf()` publishes both and is now correct for the diner
too, which was 2 cm out. If A's projecting fascia and stallriser are built to
typed-in numbers they will float or bury themselves against the new paint.

**Two probes in my scratchpad are racy, not the world.** `doors.mjs` walks at
the bodega in 240 ms bursts and can step straight through the trigger window
between samples; standing on the spot gives the prompt and `E` enters every
time. Worth someone hardening if it is going to be a shared proof.

**The library-courtyard collision proof is marginal.** It sometimes stops at
x −7.28 against a −7.3 threshold — 2 cm. It passed the last four runs and
fails on neither of my commits specifically. Somebody should widen the
threshold or find the 2 cm.
