# BLOCKED — THE WORLD DOES NOT LOAD ON MAINLINE

**This is not a blocker on my queue item. It blocks everything and everyone.**

At `add-stick-and-city98` @ `7d27c5f0`, a clean build of mainline throws on load
and **`window.__ct` is never defined**. The scene does not build.

```
PAGEERROR: Cannot read properties of undefined (reading 'DOOR')
typeof __ct = undefined
```

**`npm run build` passes.** `tsc --noEmit` is clean, vite emits the bundle, the
dist is written. This is green in CI and dead in the browser — which is exactly
the class of failure nobody notices until a playtest.

## Where

`src/proto/ct/doors.ts:83`

```ts
const MODS = import.meta.glob<Record<string, unknown>>('./*.ts', { eager: true });
...
for (const path of Object.keys(MODS).sort()) {
  const d = MODS[path].DOOR as DoorDecl | undefined;   // ← MODS[path] is undefined
```

`MODS[path]` — not `.DOOR` — is the undefined one. Under `eager: true` with a
circular import, a module that is still evaluating appears in the glob record as
`undefined`, and indexing it throws.

The comment immediately above this loop already knows about the cycle:

> *"the glob eagerly IMPORTS every ct module, and `ct/bodega.ts` imports this one
> back for `doorStandFor` — a cycle. Reading `mod.DOOR` while this module is
> still initialising then throws … and takes the whole world down. Importing is
> fine; READING has to wait until everyone has finished evaluating, which is what
> `ensure()` does."*

So the deferral was the right idea and it is **not late enough**, or a module in
the glob is failing to evaluate at all and never populates its record entry.
Either way the loop needs to tolerate it.

## The one-line guard

```ts
const mod = MODS[path];
if (!mod) continue;                 // still evaluating, or failed to evaluate
const d = mod.DOOR as DoorDecl | undefined;
```

That stops the world dying. It does **not** diagnose *why* an entry is undefined
— if a room module is genuinely failing to evaluate, its door silently stops
being declared, so the guard should `console.warn(path)` rather than swallow it.

## Who

`ct/doors.ts` is not in `notes/OWNERSHIP.md`. Six modules export `DOOR`
(`bodega`, `int-burger`, `int-diner`, `int-pawn`, `int-tax`, `int-thrift`) and
three do not (`int-casino`, `int-hotel`, `int-thrift`'s neighbours) — so this
sits across D, F and G. **It wants the desk to name an owner and land the guard,
not a builder to reach in.**

Likely trigger: `7d27c5f0` ("Burger Barn mirrors too") is the newest commit
touching this path, and `BLOCKED-A.md` says A deprecated `Frontage` fields that
F has not finished migrating. I did not bisect — confirming which commit
introduced it is a five-minute job for whoever owns it and I would be guessing.

## What it blocks

Everything that loads the world: every screenshot harness, every walk test,
`npm run sweep`, `scripts/health.mjs`, and the published artifact. My own queue
item (grade all 45) cannot proceed at all — I cannot audit a world that does not
exist. I have no second item to fall back to, because all four of mine need the
world to load.

Delete this file once mainline loads again.
