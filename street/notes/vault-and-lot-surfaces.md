# The bank vault's walls/ceiling and the car lot's "12 bay slabs" — one real fix, one false alarm

Both rows trace back to the same shadow-geometry complaint class documented in
`notes/AUDIT-shadow-geometry.md` and `src/proto/ct/paint.ts:50-93`. They turned
out to be two different things: a real texture-scale defect, and a measurement
artifact that was never a defect at all.

## 1. The vault — REAL, FIXED. Verdict: intended concrete, wrong scale.

**Looked before rewriting, as asked.** The vault's own comments are explicit
about intent: *"the concrete the strongroom is made of: a poured, hard-trowelled
grey with nothing decorative on it at all, which is the point of a vault"*
(`int-bank.ts:435-436`). The form-board lines (8 evenly spaced horizontal bands)
and the speckle blotches are a real, deliberate attempt at poured concrete —
this is not a placeholder or a wrong material. **My verdict: intended material,
wrong scale — the "scale and contrast" branch the row itself flagged as
possible, not a replacement.**

**The mechanism, found in source before testing anything:** `concreteT` is one
48x40px canvas (`int-bank.ts:437-445`), and it was applied via **one shared
material, unrepeated (ClampToEdge, no `.repeat` set)**, to four faces of very
different real size:

| face | real size |
|---|---|
| east wall | 3.0 m x 2.6 m |
| front-wall segment 1 | 0.85 m x 2.6 m |
| front-wall segment 2 | 0.77 m x 2.6 m |
| roof (top face) | 3.4 m x 3.0 m |

Stretching one canvas once across each of those means the same six speckle
blotches show up at a different physical size on every face — a big smear on
the narrow front-wall slivers, a smaller one on the roof — which is exactly
GOTCHAS §5 ("texture repeat must derive from the surface's real metres") and
exactly what reads as "randomly-placed light and dark rectangular dashes"
rather than a material with a consistent grain.

Screenshots taken before touching anything (SHOT_URL=http://localhost:4190/,
build `bad863b43+`): `shots/vault-inside-eastwall.png` — a handful of oversized,
inconsistently-scaled blotches with no repeating rhythm; `shots/vault-ceiling.png`
— same. Confirmed the mechanism, not just the symptom.

**Fix:** `int-bank.ts` already has this exact pattern for two other varying-length
runs in the same room — `panelMat(len)` and `topMat(len)` (lines ~818-843): clone
the texture, set `RepeatWrapping`, compute `.repeat` from the run's real length.
Did the same for the vault's concrete: a `concreteMat(wMeters, hMeters)` factory
that clones `concreteT`, sets `wrapS`/`wrapT = RepeatWrapping`, and sets
`.repeat` from each face's own real width/height at a **1.3 m tile** (chosen so
the 8 form-board bands drawn into the 40px canvas height land close to their
drawn scale — 40px / 8 bands ≈ 1.3 m gives roughly real board height). Called it
separately for the east wall, each front-wall segment (including the header),
and the roof — five materials instead of one shared one. The safe-deposit
nest's small incidental end-cap/top/bottom faces (never more than ~0.2 m, never
what a player looks at) keep the old unrepeated `concreteM` — they are not the
surfaces the row is about, and touching them was not worth the risk.

**After**, same stations: `shots/vault-inside-eastwall.png`,
`shots/vault-ceiling.png`, `shots/vault-inside-throat.png`,
`shots/vault-from-lobby.png` (re-shot in place, same filenames — before/after
are both described here since screenshots are for looking, not diffing). The
wall and ceiling now show a regular, repeating rhythm of form-board bands with
small, evenly distributed speckle — reads as poured concrete, not noise. I
looked at all four and my own verdict is this closes the row.

**Verified, not just eyeballed:**
- `npx tsc --noEmit` — clean.
- `node scripts/bugsweep.mjs` against the dev server — 93 shots, zero STATION
  MISS, zero console errors (only pre-existing THREE.Clock deprecation and
  Canvas2D perf warnings, present before my change too).
- Structural fingerprint (`npm run fp` harness, via `scenedump.mjs` + `fpdiff.mjs`,
  captured before/after by `git stash`/`pop` around the same running dev
  server): object count identical (8417 = 8417 both sides), tints identical,
  positions differ on 3 meshes by ≤5 cm (pigeon-noise floor, explicitly allowed
  by CLAUDE.md). Texture and structure hashes DO differ (417 / 574 entries) —
  fully explained by GOTCHAS §31's mechanism: the 5 new `Texture.clone()` calls
  each consume extra `Math.random()` draws via three.js's `generateUUID()`,
  shifting the seeded grain sequence for every texture painted afterward in the
  same module. This is a verification-harness artifact of the seeded-RNG
  cascade, not a moved object — nothing was added, removed, repositioned
  (beyond pigeon-noise), or recoloured (tints identical).

**Owner note:** `int-bank.ts` is owned by **M** per `OWNERSHIP.md`. This fix was
made because the brief routed both the vault and the lot rows to me directly,
naming `int-bank.ts` explicitly. M/the desk should be aware a fix landed in
this file outside the normal ownership flow.

## 2. The car lot's "12 flat, unmapped slabs of 11.59 m²" — FALSE ALARM. Not touched.

**Measured before changing anything, per GOTCHAS §55 ("a row is a hypothesis,
not a finding").** Went looking for the 12 slabs at the exact coordinates the
audit gave (`ct/lot.ts`, x 7.55-25.1, z 6.45-10.75 and z -5.55..-1.25, y~0.15) —
first with a general live scene scan (same class of predicate the audit used:
largest face horizontal, y in [-0.35, 0.55], area ≥ 1 m², no `material.map`),
tagged by `userData.mod`. **Nothing in `ct/lot.ts`'s own coordinate range
matched.** The screenshots taken there (`shots/lot-bays-overview.png`,
`shots/lot-bays-close.png`) show grained asphalt with a visible paint stripe
and oil-stain decals under the parked stock — not a flat unmapped patch.

Git history explains why: commit `97dd4b7e3` ("The lot's flat ground was one
surface, not twelve, and the apron is B's", landed 2026-07-25, an ancestor of
current HEAD) **already found and fixed the one real flat-colour ground surface
`ct/lot.ts` ever had** — the 0.7 m² office door step, now on `slabTex()` — and
in the same commit **diagnosed this exact false positive by name**: a census
that measured the axis-aligned bounding box of the 12 rotated
`PlaneGeometry(0.09, 5.0)` bay-line stripes (each rotated 0.55 rad) instead of
their real, oriented area. The commit message does the arithmetic: *"axis-aligned
box is 2.69 x 4.31 = 11.59 m2 against a real quad of 0.45."* **That number,
11.59 m², is character-for-character the area in the audit's "12 flat slabs"
finding.**

I reproduced this live rather than trust the history alone
(`scripts/verify-lot-bay-stripes.mjs`): found exactly 12
`PlaneGeometry(0.09, 5.0)` meshes, real area 0.45 m² each (5.4 m² total, not
139 m²), `rotation.z = ±0.55`, positioned in two rows of six at world
coordinates matching the audit's bounding-box range exactly (centres at z=8.6
and z=-3.4, and `AABB height = 0.09·sin(0.55) + 5.0·cos(0.55) ≈ 4.31` gives
`8.6 ± 2.15 = [6.45, 10.75]` and `-3.4 ± 2.15 = [-5.55, -1.25]` — matches the
audit's stated bounds to two decimal places). Computed the same AABB the audit
must have: `2.69 x 4.31 = 11.59 m²`, exact match. These are `bayM` — an
intentional translucent paint-stripe decal (`transparent: true, opacity: 0.26`,
correctly carrying no `alphaTest` per GOTCHAS §22's genuine-translucent-decal
exception), not a "shadow geometry" ground slab.

**Verdict: the LEDGER row is a re-measurement of the same
axis-aligned-vs-oriented-bounding-box mistake builder I already named and fixed
five days before the audit reproduced it independently.** There is no flat,
unmapped 139 m² of car-lot ground to fix. `ct/lot.ts` was not touched. This is
the "already fine" outcome GOTCHAS §55 asks builders to report rather than
manufacture work against.

## Files

- Fixed: `src/proto/ct/int-bank.ts` (the vault's `concreteMat` factory).
- Not touched, and should not be: `src/proto/ct/paint.ts`, `src/proto/ct/tex-ground.ts`
  (owned by A/B; only their exported helpers were considered, and neither was
  needed for the vault fix since it reused the room's own existing
  `panelMat`/`topMat` pattern), `src/proto/ct/lot.ts` (owned by I; row is a
  false positive, see above).
- New verification scripts (not owned by anyone per `OWNERSHIP.md`'s
  `scripts/**` rule): `scripts/vault-and-lot-look.mjs` (before/after
  screenshots at named stations), `scripts/find-lot-slabs.mjs` (general flat-
  ground scene scan), `scripts/verify-lot-bay-stripes.mjs` (confirms the bay-
  stripe AABB artifact by measuring `geometry.parameters` directly instead of
  the mesh's world AABB).
- Screenshots (gitignored, not committed, viewed directly this session):
  `shots/vault-from-lobby.png`, `shots/vault-inside-eastwall.png`,
  `shots/vault-inside-throat.png`, `shots/vault-ceiling.png`,
  `shots/lot-bays-overview.png`, `shots/lot-bays-close.png`.

## For the desk / LEDGER (not edited here, per instructions)

- Row *"the bank VAULT room's walls and ceiling read as scattered grey
  noise"* (owner M): can move to CONFIRMED/CLOSED — fixed in this session,
  build `bad863b43+`, see above.
- Row *"the car lot's 12 parking-bay ground slabs (~139 m2)... never adopted"*
  (owner I, `LEDGER.md:314`): should be marked VOID / false positive, not
  OPEN — it double-counts the same AABB-of-a-rotated-plane mistake commit
  `97dd4b7e3` already fixed and explained. Nothing in `ct/lot.ts` needs
  adoption; the one real flat surface was fixed there in 2026-07-25.
