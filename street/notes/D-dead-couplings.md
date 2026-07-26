# Two checks were matching wording the world no longer says — both repaired

Found by `scripts/D-dead-prompt-literals.mjs` (registered). Neither would ever
have shown as a failure: both matched **nothing** and passed.

## 1. `libboard.mjs:15` — the frieze was renamed out from under it

```js
-  const s = ... .find(q => /PVBLIC LIBRARY/i.test(q.label||''));
+  const s = ... .find(q => /PUBLIC LIBRARY/i.test(q.label||''));
```

`ct/civic.ts:744` records the change: *"PUBLIC, not PVBLIC … if the reference is
correct but every reader thinks it is a mistake, it is a mistake."* The `find()`
had returned `undefined` ever since, so the whole check measured nothing. It
**now exits 0 and reports real boards** at the library door.

## 2. `spot-coverage.mjs:89` — a coverage row that covered nothing

```js
-    ['civic-doors-walk', (s) => /doors of the/i.test(s.label)],
+    ['civic-doors-walk', (s) => /ST BRIGID|PUBLIC LIBRARY/i.test(s.label)],
```

No label contains `doors of the`; its only occurrence anywhere is a **comment**
in `ct/int-bank.ts:24` quoting the user. The row attributed zero spots to
`civic-doors-walk`, so the table reported the cheerful version of the truth —
nothing uncovered, because nothing counted (GOTCHAS §34). The world publishes
those two doors as `into ST BRIGID'S` and `into the PUBLIC LIBRARY`.

**Both files are unlisted in `OWNERSHIP.md`.** I fixed them rather than routing
and waiting, because an unowned dead check has nobody to wait for — and because
leaving them would have reddened the shared suite through my newly registered
check, which is C's `mods-dim` precedent in reverse. Say so if either was yours;
both changes are one line and evidenced above. `spot-coverage` still exits 1, as
it did **before** my edit — it reports harness gaps by design.

## The general shape

A label is **presentation**: it belongs to whoever last wrote the interaction and
changes on their afternoon, not yours. **Match the noun the roster owns**
(`FIRST FEDERAL`, `ST BRIGID`, `No. 227`) rather than **the verb the interaction
owns** (`check balance`, `use the machine`). That one-line habit would have saved
M's whole bank run, two clauses of my `D-walk`, and my own `D-confirmed-prompts`.

**Not flagged, and deliberately:** `G-seat-spot-clash.mjs:28` filters out
`/stand up|stop watching/`. `stop watching` matches nothing today — but it is a
NEGATION, so it excludes nothing and harms nothing, and C has an open row for
that exact prompt. G wrote it forward. A check that told a builder off for
anticipating a feature would be worse than the bug it looks for.
