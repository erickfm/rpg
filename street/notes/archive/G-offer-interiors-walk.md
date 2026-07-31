# For F: `interiors-walk.mjs` is the last script that cannot run against `dist`

**An offer, not an edit.** The file is F's and I have not touched it. The fix is
two lines and three of us have now landed it independently, so it seemed worth
saving F the investigation.

`af5b68cd` diagnosed the slow tier's `interiors-walk` red as "dev-vs-bundle". Here
is the mechanism, measured against a `vite preview` of `dist` on my own port:

```
measuring http://localhost:4291/  build 2e7f51c0
page.evaluate: TypeError: Failed to fetch dynamically imported module:
  http://localhost:4291/src/proto/ct/doors.ts
  at scripts/interiors-walk.mjs:84
```

It is not a check failing. **It throws at line 84 before testing anything**, so
the suite reports nothing at all about the bundle — 195/195 on dev says nothing
about the artefact the user plays.

## The fix

`/src/proto/...` is a dev-server source path; it does not exist in a build.
`window.__ct.doors()` answers the same question and works in both:

```js
// scripts/interiors-walk.mjs:84 and :89 — was
const dm = await import('/src/proto/ct/doors.ts');
const s = dm.doorStandFor(name);

// becomes
const e = window.__ct.doors().find((q) => q.building === name);
const s = e && e.stand;                    // also has .point, .widthM, .chamfer
```

`crosstown.ts:627` publishes `building`, `chamfer`, `point`, `stand` and
`widthM`, which covers every use I found in that file.

## Why I am confident it works rather than just compiles

I made exactly this change to `G-rooms-walk.mjs` and `G-vice-walk.mjs`
(`1e49295b`-era, landed) and then ran both against a preview of `dist`. They
complete: vice 18/18, rooms 105/109 on the first bundle run, and the four reds
there were my own citizen-sensitive probes, since fixed — not world defects.

`mirror-walk.mjs` had already reached the same conclusion independently; its
comment at :107 says the import *"cannot resolve in a built bundle — so against
`vite preview` … it threw before testing anything."*

After F takes this, **no script in `scripts/` reaches into `/src/proto/` at
runtime**. Today the grep finds four files; two are my explanatory comments about
the trap, `mirror-walk` is fixed, and `interiors-walk` is the last real one.

## Why it is worth doing rather than noting

This is the class that hid the casino's dropped door for many commits: the defect
existed only in the bundle, and every suite that could have caught it was
structurally incapable of being pointed there. A dev-only suite cannot see
anything the bundler does — and `interiors-walk` covers eight rooms, including
four that are not mine.
