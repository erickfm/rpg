# onehundredone / item 260 — RELEASED at 2 of 4 done, 1 diagnosed, 1 untouched

**Item 260 is four items in a trench coat**, and I am releasing it rather than
`done.sh`-ing work I only scoped (BUILDER-BRIEF §1). Everything below that says
DONE is committed and measured; everything that does not, is not.

| part | state |
|---|---|
| **(1) `unstick-walk` has no population floor** | **DONE**, committed, mutation-proved |
| **(2) park and lot containment have no failing path** | **NOT STARTED** — the big one, see below |
| **(3) a moving box on `staticColliders()`** | **DIAGNOSED EXACTLY**, not fixed — the fix needs `crosstown.ts`, which this item does not name |
| **(4) does anything else die on a missing `shots/`?** | **DONE** — the item asked me to *report*, and this is the report |

---

## (1) DONE — `unstick-walk` population floors

An empty trap list printed **"all 0 traps release the player"** and exited 0.
Two floors added, because the file already separates two populations and either
can collapse alone:

| | measured on this world | floor |
|---|---|---|
| candidate gaps the seed found | **586** | 200 |
| genuinely stuck, i.e. actually probed | **543** | 150 |

**Exit 2, not 1** — the instrument failing, not the world. Asserted *before* the
pass/fail exit, so a blinded run can never report green.

**Proved red** by raising both floors to 99999: exit 2, message printed, real
counts 586/543 in the output. Normal run: **exit 0**.

The item's framing is the part worth keeping: **item 258 gave this check a
registered `canfail` case**, so `checks-can-fail` now reports it as a *proven*
guard. **A certificate on an unfloored check is worse than no certificate** — the
mutation proves the verdict CAN go red, the floor is what proves the verdict was
ever ASKED.

---

## (4) DONE — 55 scripts share the ENOENT shape; **four are registered checks**

`scripts/probes/w101-shots-enoent.mjs`, static over all **1,252** scripts.

**These four can go red in `npm run checks` on a fresh worktree**, because
`shots/` is gitignored and their write runs after the verdict:

| | |
|---|---|
| `scripts/faces.mjs:99` | `writeFileSync('shots/faces.png', …)` |
| `scripts/masonry.mjs:222` | `writeFileSync('shots/masonry.json', …)` |
| `scripts/seampairs.mjs:273` | `writeFileSync('shots/seampairs.json', …)` |
| `scripts/texdensity.mjs:384` | `writeFileSync('shots/texdensity.json', …)` |

Failure mode confirmed in isolation: `writeFileSync('shots/x.json')` from a
directory with no `shots/` throws **`ENOENT`**. That is item 191's exact shape —
an instrument's own environment reported to the suite as a defect in the world.

**51 more are one-shot probes** (cheaper, same fault). **And a class that is NOT
a fault, recorded so nobody re-derives it: Playwright's `screenshot({ path })`
creates parent directories**, so a script that only screenshots is safe; the
probe lists those separately.

**I did not fix the four.** The item's verb is *"report"*, twice — in the body
and in the DONE WHEN — and none of the four is a file this item names (§9). Each
is a one-line `mkdirSync('shots', { recursive: true })`.

---

## (3) DIAGNOSED — and it contradicts an invariant written in the source

`crosstown.ts:625` states:

> *"There are exactly two places an actor box enters `colliders`, and both are
> the registration hooks right here, so the set cannot drift from the world."*

**It has drifted.** `staticColliders()` is `colliders.filter((c) => !actorBoxes.has(c))`,
and `actorBoxes` is fed by exactly `ctx.vehicleBox` and the crowd's `solid`.
**`ct/apartment.ts` pushes `hermitCap` into `sevColliders`, which reaches the
world as the module's returned `colliders` array — bypassing both hooks.** So
the hermit's own body sits on the static list.

**Measured**, by sweeping 24 game hours from inside 301
(`scripts/probes/w101-moving-static.mjs`):

```
0.52 × 0.52 box at z = -16.50,  x  202.52 → 202.20 → 201.95   hours 17,18,19-23
                                                              absent hours 0-16
```

⚠ **The first two runs of that probe found NOTHING**, and both were the
instrument: reading at the default street spawn asks the question of a building
the region culler has switched off, and reading over a 4-second window asks it
of a schedule that turns over in game hours. Both are now written into the probe
so the next reader does not repeat them.

**Why I stopped here.** The fix is to declare the cap an actor, and the right
shape is `ctx.actorBox(b)` alongside the two existing hooks — which is an edit to
**`crosstown.ts`**, a desk-owned file this item does not name, while other
builders are landing (§9). It is a small change and it should carry a correction
to that invariant comment, because the comment is currently false and is exactly
the kind of thing the next reader will trust.

**Note the item's "0.27 m" does not match my 0.52 m.** I did not chase the
difference. Either there is a second box or the original figure was a half-width;
the box I measured is unambiguous and moving.

---

## (2) NOT STARTED — park and lot containment

`checks.mjs:1315-1317` registers `w75-site-contained` **three times with
different args**, and only the **jail** leg carries a canfail case
(`jail-forecourt-open`). Park and lot have been green all night with nothing
able to turn them.

This is the largest of the four: it needs **two new world mutations** in
`canfail.mjs` — reopen a flank at the park, watch the check catch it, restore
byte-for-byte, and the same again at the lot — each proved red and then proved
to leave the world unchanged.

**I did no work on it at all.** I am not leaving a half-written mutation for
somebody to find.

Related, and already landed by me under **item 190**: `checks-can-fail` now
annotates these two rows *"the same script DOES declare one on another row —
this LEG does not"*, so the distinction the item is making is visible in the
guard's own output. It deliberately does **not** clear them — a mutation proven
on `--site jail` says nothing about whether the park leg can go red, which is
this item's point exactly.

---

## What is committed

| commit | |
|---|---|
| `7256e5358` | (1/4) the two population floors |
| `ad8fc4bf7` | (4/4) the ENOENT scan and the four registered scripts |
| `8d4da1b35` | (3/4) the diagnosis probe |

No source file outside `scripts/unstick-walk.mjs` was changed.
