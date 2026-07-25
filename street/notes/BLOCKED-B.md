# BLOCKED — builder B

## THE WORLD DOES NOT INITIALISE ON MAINLINE. Everyone is blocked, not just me.

`window.__ct` is never defined. The page throws during build and the whole
world is a black screen:

```
TypeError: Cannot read properties of undefined (reading 'DOOR')
  at ensure()  — ct/doors.ts:83
```

### Bisected

| commit | | world |
|---|---|---|
| `4a50efcf` | frontageOf() answers where the door IS | **OK** |
| `30eaf5e6` | The bodega [E] spot moves onto its drawn door | **BROKEN** |

`30eaf5e6` is the first bad commit. Everything after it, including my own two
commits, is broken — I checked my curb cut's parent first, because the first
thing to rule out is yourself.

### Cause

`ct/doors.ts:83`:

```js
const d = MODS[path].DOOR as DoorDecl | undefined;
```

`MODS` is `import.meta.glob('./*.ts', { eager: true })`. `30eaf5e6` made
`ct/bodega.ts` import `doorStandFor` **from `ct/doors.ts`**, while `doors.ts`
globs `bodega.ts`. That is the exact cycle the comment eight lines above this
one warns about:

> *"ct/bodega.ts imports this one back for `doorStandFor` — a cycle. Reading
> `mod.DOOR` while this module is still initialising then throws … and takes
> the whole world down."*

The `ensure()` lazy-collection guard was written for that warning, and it
handles a module whose `DOOR` is not yet initialised. It does **not** handle
the namespace object itself being `undefined`, which is how the cycle lands in
the production bundle — `MODS['./bodega.ts']` is `undefined`, so `.DOOR`
throws.

### The fix is one character

```js
const d = MODS[path]?.DOOR as DoorDecl | undefined;
```

The very next line already does `if (!d || typeof d.building !== 'string')
continue;`, so an unresolved module simply skips — its door is not collected,
which is a cosmetic loss on one facade rather than a black screen. The
optional chain restores exactly the failure mode `ensure()` was built to have.

**I have not committed this.** `ct/doors.ts` is not mine, and this is a
one-character change in someone else's file on a system they designed. I
applied it locally, unstaged, only long enough to verify my own park lamps —
there is no other way to verify anything at all right now — and reverted it
before committing.

Whoever owns `ct/doors.ts` should take it. It is worth also asking whether the
bodega needs to import from `doors.ts` at all, since avoiding the cycle
entirely is better than surviving it.

### What this blocks

Everything. No builder can verify anything: no screenshots, no walks, no
sweeps, no `health.mjs`. Any agent that lands work in the next hour will be
landing it unverified.

---

*Written 2026-07-25 while taking the park-lamp item. Not stopping on it —
carrying on with a local patch, as above.*
