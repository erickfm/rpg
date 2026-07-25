# The casino's dropped door: FIXED in `1e49295b`, and not the way this note said

> **SUPERSEDED, read this first.** Everything below recommends a four-line patch
> to `ct/doors.ts` and asks the desk to find that file an owner. **It does not
> need one.** The fix landed in `1e49295b` entirely inside `ct/int-casino.ts` and
> `ct/int-hotel.ts`, which are mine, and it is better than the patch below on
> every axis: no unowned file is touched, and C's dropped-door warning does not
> become a false alarm.
>
> **What I had missed, twice:** D's `seam-audit.md` Round 16 already said that six
> of the eight rooms import only `type DoorDecl` — erased, no runtime edge — and
> that only `int-casino` and `int-hotel` import the *value* `doorStandFor`. That
> import is the entire cause. Removing it and deriving the `[E]` spot from the
> `face` each room already declares takes both files out of the cycle. Same
> arithmetic, same numbers, no registry.
>
> Measured with `scripts/doors-declared.mjs` against the built bundle:
>
> ```
> before         8 declare, 7 arrive   GOLDEN ACES missing
> casino only    8 declare, 7 arrive   HOTEL ORPHEUS missing   <- the loss MOVED
> both           8 declare, 8 arrive   "every declared door arrived."
> ```
>
> The middle row is the proof rather than a step: fixing one file moved the drop
> to the other file carrying the same import.
>
> **Still true and still unowned:** `civic-doors.ts`, `interior.ts` and `world.ts`
> resolve to undefined namespaces too. They declare no doors today, so nothing is
> lost — but the next module that declares one from inside the cycle drops the
> same way, silently. The class is open even though this instance is closed.
>
> The rest of this note is kept because the negative results are still worth
> having: they rule out two fixes that look obvious.

# The original note: a fix that works, measured in `dist`

**For whoever ends up owning `ct/doors.ts`.** Three of us have now measured this
file and stopped at the same place — it has no owner. This note is the part that
was missing: a fix that has actually been run, in the only build where the defect
exists.

I am not landing it. `7fc81fa6` is A analysing this file right now, and two
builders editing a shared leaf module is how every hand-resolved conflict on this
project has started. The patch is below; it is four lines.

## What was tried, and what each attempt cost

| attempt | result |
|---|---|
| A: move `doorStandFor` to a leaf module | **impossible** — A retracted it in `7fc81fa6`: `doorStandFor` reads the glob-filled registry, so moving it moves the glob |
| A: `{ eager: false }` | **untested by anyone.** Turns `ensure()` async and ripples through every caller — a real design question A correctly declined to answer by assertion |
| mine: `{ eager: true, import: 'DOOR' }` on `./*.ts` | **does not build.** `import:` emits a static named import from *every* matched module, so `civic-doors.ts` fails with `[MISSING_EXPORT] "DOOR" is not exported` |
| mine: same, narrowed to `./int-*.ts` | **builds, does not fix it.** Still 7 declarations in `dist`, GOLDEN ACES still missing, `int-casino.ts` still warns |
| **mine: push registration** | **fixes it. 8 of 8 in `dist`, synchronous, no ripple** |

The third row is worth keeping because it disproves the obvious theory. If the
namespace object were the problem, asking for the named export directly would
have cured it. It does not: `int-casino.ts`'s binding is genuinely not
initialised when `doors.ts`'s body runs, exactly as D's `418515c7` concluded —
*"the casino's binding is emitted after the glob that reads it."* The form of the
read is not the issue. **The timing is.**

## The fix

The room hands its door over when it initialises, instead of `doors.ts` reaching
into the room's namespace afterwards. Nothing is read before it is bound, so
emission order stops mattering.

```ts
// ct/doors.ts, beside DECLS
export function declareDoor(d: DoorDecl): void {
  if (d && typeof d.building === 'string') DECLS.set(d.building, d);
}
```

```ts
// ct/int-casino.ts, after the DOOR literal
declareDoor(DOOR);
```

## Measured, in `dist`, on my own preview port

Before — and this is the state on mainline today:

```
declarations in dist: 7
  A-1 TAX | BODEGA | BURGER BARN | DINER | HOTEL ORPHEUS | PAWN | THRIFT
  GOLDEN ACES present? NO
```

After:

```
declarations in dist: 8
  A-1 TAX | BODEGA | BURGER BARN | DINER | GOLDEN ACES | HOTEL ORPHEUS | PAWN | THRIFT
  GOLDEN ACES present? YES
  GOLDEN ACES    prompts → inside x=596.8
  HOTEL ORPHEUS  prompts → inside x=756.6
  PAWN           prompts → inside x=840.0
  A-1 TAX        prompts → inside x=915.8
```

`tsc` clean, build clean, all four doors still prompt, open and land in the named
room. **Measured against the bundle, never the dev server** — D proved in
`a7a57c4f` that dev cannot reproduce this, and I have already filed one wrong
retraction against A by forgetting that (`f0be2c38`). Do not re-verify this on
`npm run dev`; it reads 8 of 8 there whether or not the fix is applied.

## Two things the patch does NOT do

1. **The glob's warning becomes a false alarm for the casino.** `int-casino.ts`
   still resolves to an undefined namespace, so `ensure()` still prints
   *"any DOOR it declares is being dropped without trace"* — while the door is
   now safely in the registry by another route. Whoever lands this should make
   the warning fire only when the building is absent from `DECLS`, or C's
   diagnostic starts crying wolf. That is a real cost and it is why this is a
   note rather than a commit.

2. **It fixes one room, not the class.** `civic-doors.ts`, `interior.ts` and
   `world.ts` also resolve undefined; they declare no doors today, so nothing is
   lost, but the next module that declares one from inside the cycle drops the
   same way. The general form is every declarer pushing — at which point the
   glob has no readers left and can go, along with the cycle. That is a bigger
   change across files owned by several builders, and it is the desk's call, not
   mine.

## If you would rather have `{ eager: false }`

It is still the more principled fix — it removes the eager materialisation
rather than routing around it — and `ensure()` is already the right place to
call the importers. The cost is that it is async, so `doorPointFor`,
`doorStandFor` and `doorWorldFor` all become async and every caller changes,
including `interior.ts`, which imports four of them. Push registration was
attractive to me precisely because it is the codebase's existing idiom
(`declareSurface`, `props.lit`, the per-frame `ticks`) and needs no caller to
change at all.
