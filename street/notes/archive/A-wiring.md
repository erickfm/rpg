# Builder A — the wiring check, stood down as a gate, and what it found

## What happened

The desk queued a build-failing check for "written but never wired", then stood
it down mid-flight in favour of the better answer: the user asked for automatic
incorporation, and F is generalising `ct/interior.ts`'s `import.meta.glob`. **I
agree with the stand-down** — a check that a contract is followed is worth far
less than a contract that cannot be skipped.

So `npm run build` is back to `tsc --noEmit && vite build`. Nothing is gated.

I kept the script as `npm run wiring` (add `-v`) rather than deleting it,
because two things survive F's change:

1. It prints how all 23 `build*` exports are constructed **today**,
   glob-resolved. That inventory is what F's generalisation needs and it is
   already written.
2. A glob covers a module only if it matches the pattern **and** exports the
   expected name. A misnamed module still falls through a contract that cannot
   be skipped, silently. This still says so.

## Two things worth knowing if this is ever picked back up

**It has to be glob-aware or it is worse than nothing.** `ct/interior.ts`
discovers `./int-*.ts` eagerly and calls whatever `build…()` each one exports.
A naming-only check calls all seven rooms orphans and fails the build on working
code — and a check that cries wolf gets deleted, not fixed.

**The glob call has a nested type argument.** It is
`import.meta.glob<Record<string, unknown>>('./int-*.ts', …)`, so a regex that
stops at the first `>` matches nothing at all and *every* room silently looks
unwired. That failure is invisible: the script runs, reports orphans
confidently, and is wrong about all of them.

## What it found on mainline right now

```
$ npm run wiring
wiring: 23 build* exports, all constructed
```

- **park and lot are wired** — F landed that.
- **`int-pawn.ts` IS constructed**, via the glob in `interior.ts`.

That last one matters: **`BLOCKED-G.md` item 1 is stale.** It says
`buildPawn(ctx)` is missing from `crosstown.ts` alongside explicit
`buildThrift/buildCasino/buildHotel/buildTax` calls. There are no such explicit
calls on mainline — the glob wires all seven rooms including pawn. G may be
holding a finished room back for a wiring problem that no longer exists. G's
item 2 (the door) I have not checked and is a separate thing.

This is the stale-queue failure again, one level over: a blocker is a claim, and
claims go stale. `npm run wiring -v` answers "is X actually in the world?" in one
command, which beats walking there.

## Facade work — where it actually stands

The desk redirected me back to the facades. Everything in `tex-world.ts` is
done and verified day and night (`shots/ff-diner.png`, `shots/ff-night.png`):
six fronts on one shared depth vocabulary, each with its own character, plus
`frontageOf()` publishing the geometry the interiors were guessing at.

**The only facade work left cannot be done from my file**, and it needs a
question answered that is not mine to answer — whether "flat painted plane"
meant the shading it now has, or literal projection. `BLOCKED-A.md` has it, and
it is the critical path for this item.

I have not gone looking for more facade art to change. Nobody has objected to
what is there, and this project's rule is two failures then delete, not keep
going until something breaks.
