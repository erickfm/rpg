# Item 193 — the shared room kit's last private door angle

Worker onehundredfive, 2026-08-03. Port **4611**, verified on the **built
bundle** throughout (this change has a cycle risk that only the bundle can
disprove).

## The change

`ct/interior.ts` held `const SWING = -0.85` — **the last survivor of the eight
door angles item 159 collapsed.** That item made `ct/vice.ts` export a single
`LEAF_AJAR = 0` and removed the swing parameter from `leafPair` entirely, so
*"a caller that cannot pass one cannot copy the wrong one."* `interior.ts` was
outside its scope and kept its own, so the shared room kit went on hanging every
unreplaced leaf **49° open** while the twelve buildings that matter hang theirs
shut.

One line: `const SWING = LEAF_AJAR;`, imported from `vice.ts`.

**The row's line numbers had drifted** — `interior.ts:1466` is now **1729**, and
`int-pawn.ts:185` is now **190** — but the content is exactly as described, so
the row is stale only in its citations.

### Not from `doors.ts`, and the row is right that it is a trap

`ct/doors.ts` looks like the right home for shared door state. It eagerly globs
`int-*.ts`, and **every one of those imports only `type DoorDecl`** precisely so
no runtime edge exists. A runtime import closes the cycle, and **GOTCHAS 28 drops
the module from the BUILT BUNDLE ONLY** — source looks fine and the world is
broken.

`vice.ts` imports `paint`, `tex-world`, `civic` and `fp`, and **nothing that
reaches back into `interior.ts`**, so this edge is safe in the direction drawn.
Checked, not assumed, and then confirmed the only way that counts: `npm run
build` → `node scripts/health.mjs` → **WORLD OK**.

## `doormatch12`: 4 of 12 before, 4 of 12 after

Same four rooms — **burger, diner, tax, thrift**. **No regression and no
improvement, and that is correct rather than disappointing.**

> The row expected this "may turn some of those green". It cannot.
> `doormatch12` asks whether a room wears the kit's generic leaf **texture** —
> *"a flat fill with one 3-pixel handle"* — and says nothing whatever about the
> angle it hangs at. It could neither confirm nor deny the line this item
> changed. **The check was not touched**, per the row's instruction and
> BUILDER-BRIEF §7.

So the change needed its own instrument, and it found something bigger than the
row expected.

## What actually moved: 12 leaves, not 4

`scripts/probes/w105-kit-leaf-angle.mjs` reads `rotation.y` off every mesh
carrying the kit leaf's 32 × 64 canvas — **the same signature `doormatch12`
keys on**, so the two cannot disagree about what "the kit leaf" means.

| | leaves at −0.85 (−48.7°) | leaves at 0 |
|---|---|---|
| before | **12** | 0 |
| after | **0** | 12 |

**Twelve, because every room that uses the kit leaf inherits the angle — not
only the four still wearing its texture.** The other eight replaced the texture
and kept the kit's swing.

**Negative case:** restoring the constant puts all 12 back at −48.7° and the
probe goes red. **Population floor** at 4, derived from the rooms `doormatch12`
names rather than predicted, exit 2 below it — *"every leaf is at the right
angle"* is true of the empty set.

> ### ⚠ MY FIRST CUT OF THE PROBE CALLED SIX GOOD LEAVES WRONG
>
> It asserted "every kit leaf is at exactly 0" and reported **6 failures** at
> exactly **±90°**, x 199.91 and 202.49. Those are the **walk-up's own door
> leaves**, whose mesh is turned a quarter turn because the wall it hangs on runs
> the other way — **a placement rotation, not a swing**, and nothing this item
> touched. The 32 × 64 canvas is not unique to the room kit.
>
> The assertion is now the question actually being asked: **nothing at the old
> −0.85** (not axis-aligned, so nothing can produce it by placement — only the
> deleted constant could), **and everything axis-aligned** (0 or ±90°, what a
> shut door on an axis-aligned wall must be, whatever turned it).

## No room regressed

`interiors-walk.mjs` on the **built bundle**: **365/369 both before and after** —
I rebuilt with the old constant to get the baseline rather than assuming it. The
four failures are **identical and pre-existing**:

```
jail:   the room keeps its own light after dark
casino: the customer station comes from the world, not from memory
hotel:  the customer station comes from the world, not from memory
tax:    the customer station comes from the world, not from memory
```

## Left alone, deliberately

**`ct/int-pawn.ts:190 OPEN = 1.35`** — the row says do not touch it, worker
sixtyfive checked it, and its own comment records a measured sight-line trap. It
is the only one of the original eight angles chosen on purpose. Untouched.

## Found and NOT fixed

1. **The four `interiors-walk` failures above are pre-existing** and none is in a
   file this item names. The three identical "customer station comes from the
   world, not from memory" failures look like one cause, not three.
2. **`doormatch12` is still 4 of 12** and this item was never going to change
   that. The fix per room is the recipe six rooms already use and
   `ct/interior.ts:1343` names: hide the kit leaf, hang the building's own with
   `leafPair`, textured from the same drawing the facade uses. That is four
   separate pieces of authoring, not a shared-constant change.
