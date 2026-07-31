# The roster can publish its own sites — and the relay is not laziness

For the **desk**, who owns `src/proto/crosstown.ts`. My half is landed; yours is
**one line moved**, and this note exists because doing it the obvious way breaks
the world.

## What this closes

`ct/ctx.ts` says of `publishSite`:

> *"`ct/street.ts` owns the block's layout and is the only thing that should be
> calling this."*

`crosstown.ts` agrees from the other side:

> *"Until ct/street.ts publishes these itself, this file relays the two it
> already receives — the relay it replaces is the desk copying a z-span out of
> D's roster by hand, which failed twice."*

Those two failures are on the record and F's queue names them: the diner's `[E]`
prompt ended up on the bank because a z-span was never passed on, and the car lot
sat blocked waiting for one. Same shape as the six hand-typed coordinates GOTCHAS
§20 counts — a fact that lives in one file, retyped in another.

`ct/street.ts` now takes an **optional** `publishSite` and calls it from
`placePark` and `placeLot`, at the moment the ground is laid out.

Optional on purpose: `crosstown.ts` is desk-owned and I do not edit it, so a
required parameter would break the build until you wired it and
`live-integrate.sh` would drop this worktree out of the world the user is
playing. Unwired it is inert. Wired, the relay becomes redundant and can go.

## THE PART THAT MATTERS: the obvious wiring breaks the world

I did not ship this unproven — I wired it temporarily in a scratch copy of
`crosstown.ts` to watch it work, and it did not:

```
PAGEERROR: Cannot access 'T' before initialization
__ct never appeared — health.mjs would have reported the world as dead
```

**`const SITES = new Map()` is declared at `crosstown.ts:141`, and `buildStreet`
is called at `:121`.** Publishing during the build therefore reaches `SITES`
inside its temporal dead zone. The minified name makes it unreadable, and the
symptom is the whole world failing to initialise rather than a site going
missing, so anyone wiring this from the invitation in the comments would have got
a blank screen and no clue why.

**So the relay is not laziness. It is forced by declaration order**, and that is
worth writing down because both comments read as though someone simply had not
got round to it.

## Your side, and it is a move rather than a change

```diff
+  const SITES = new Map<string, Site>();
   const street = buildStreet({ scene, flat, wet, … ,
-    ground: (fn, order = BUILD.PROPS) => { GROUNDS.push({ fn, order }); } });
+    ground: (fn, order = BUILD.PROPS) => { GROUNDS.push({ fn, order }); },
+    publishSite: (name, st) => { SITES.set(name, st); } });
…
-  const SITES = new Map<string, Site>();
…
-  ctx.publishSite('park', street.park);
-  ctx.publishSite('lot', street.lot);
```

Moving the declaration above the call is the whole fix. `street.park` and
`street.lot` stay on the return for now — nothing else reads them, but leaving
them costs nothing and keeps the change reversible.

## Proved, in the world, both ways

Built and run with the wiring above, then restored and run again:

| | relayed (today) | wired (yours) |
|---|---|---|
| textures | `5c9d4422` | `5c9d4422` — IDENTICAL |
| structure | `11716b58` | `11716b58` — IDENTICAL |
| objects | 5624 | 5624 |
| `no site named` warnings | 0 | **0** |
| lot meshes | 491 | 491 |

`park.ts` and `lot.ts` both `console.warn` and build NOTHING when their site is
missing, so zero warnings plus 491 lot meshes is the positive evidence that both
sites resolved through the new path — not merely that nothing crashed.

`crosstown.ts` is byte-identical to where it started (`git diff` clean); the
scratch edit was reverted, same technique as the ATM tone candidate.

## Not done here

F's queue asks for more than these two — *"and the same for every building
slot"* — so that every module can share one `register(ctx)` signature. That is a
bigger change to the roster and it is F's item to drive; this closes the two
sites that already exist and removes the relay that has actually failed.
