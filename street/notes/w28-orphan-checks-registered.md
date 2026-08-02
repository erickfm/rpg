# w28 — item 71: the three orphan checks, decided on evidence

**Root cause, one line:** `H-flare-silhouette`, `ledger-intact` and `masonry`
each ship a working `--selftest` and were in no tier of `npm run checks`, so all
three ran exactly never — and a check that is not run cannot fail.

All three are now registered. `checks-registered.mjs` is green: **136
registered**.

## I ran each by hand first, which is what the item asked

The item was explicit that a check which has never run may be measuring a world
that no longer exists, and that registering three orphans reflexively is the
wrong move. So each was run against the built bundle before any edit to
`checks.mjs`:

| check | verdict | time | browser? |
|---|---|---|---|
| `ledger-intact` | 253 rows → 253, **intact** | 0.06 s | no |
| `masonry` | 305 stamps, 16 disagreements, **all 16 explained by whole-texel canvas rounding, 0 faces actually authored wrong** | 2.9 s | yes |
| `H-flare-silhouette` | 23 cars, **0 meshes outside the tyre-and-body silhouette** | 1.0 s | yes |

And each `--selftest` was run, because a check that has never run has never had
its mutation exercised either:

- `ledger-intact --selftest` → *"DAMAGED: lost rows, shrunk evidence"*
- `masonry --selftest` → *"FACES ACTUALLY AUTHORED AT THE WRONG DENSITY: 1 …
  selftest: caught it"*
- `H-flare-silhouette --selftest` → *"SELFTEST PASSED — the re-attached flare
  was caught"*, naming the offending `BoxGeometry` at half-width 1.64 against a
  body of 0.90.

None was measuring a dead world. Nothing was deleted.

## The one that nearly went the other way

**`masonry` looked like a duplicate of the already-registered `density`** — the
registered row asks *"is every masonry face at the density it declares?"* and
`masonry.mjs` prints *"FACES ACTUALLY AUTHORED AT THE WRONG DENSITY"*. That
would have been a delete-with-reason.

It is not a duplicate. `masonry.mjs`'s own header says it is **density.mjs's
successor**: *"That fixes what broke density.mjs: its filter was geometric, so
foliage, ground decals and signage sat in a net meant for walls."* And it asks a
second question `density` cannot — whether each stamp **agrees with the face it
is actually mapped to** — on the argument that *"a stamp that disagrees with the
geometry it is on is WORSE than no stamp, because it looks like an answer."*

So both are registered. See "not fixed" below for the consequence.

## Tier

All three go in the **default** tier, not `--slow`. None of them walks, and the
slowest is 2.9 s. That is this file's own stated rule — *"SLOW is a runtime
tier, not an importance tier"* — rather than my preference. `ledger-intact` is
the only check in the whole registry that touches no browser at all.

## Proof the registration is what fixed it

`checks-registered.mjs` **exits 1** with the masonry line deleted, naming
`scripts/masonry.mjs` as never-registered, and **exits 0** with it restored.
Bytes moved with the mutation: `checks.mjs` 77,523 → 77,436 → 77,523. So the
audit can genuinely fail and my change is what makes it pass, rather than the
audit having been green all along.

## Found and NOT fixed

1. **`density` and `masonry` overlap and one of them is probably redundant.**
   `masonry` is the stated successor and strictly asks more; `density`'s
   geometric filter is the thing `masonry` exists to have fixed. Retiring
   `density` — or demoting it with a reason — is a real decision with a real
   argument behind it, and it is not what item 71 asked me to do. Both run in
   2–3 s so the cost of leaving both is small, but the project now audits the
   same property twice with two different filters and the wrong one is the
   registered one.
2. **`masonry` aborts (exit 3) against a stale `dist/`.** It carries the
   `which-world` guard and refuses a build older than HEAD — correctly. But
   `npm run checks` points every check at one `SHOT_URL`, so if the runner is
   ever aimed at a stale preview, `masonry` will be the check that reports it
   and the failure will look like a masonry defect until someone reads the
   message. Worth knowing; I did not change the guard, which is right.
3. **`ledger-intact` is registered into a runner that short-circuits on a dead
   server** (`serverDied` skips every remaining check). It needs no server at
   all, so a browser casualty will silently take the one check that guards
   `LEDGER.md` with it. Moving the no-browser checks ahead of the browser ones,
   or exempting them from `serverDied`, is a small change to a file this item
   does name — but it is a change to the runner's control flow rather than its
   registry, and I would rather it were queued and reviewed than slipped in
   under a registration item.

## Ports

**4180**, built preview. Rebuilt once mid-item because `masonry`'s `which-world`
guard correctly refused a `dist/` older than HEAD.
