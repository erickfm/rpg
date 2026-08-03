# w65 — item 159: one leaf angle for the whole world

**Ports: 4210 (dev) and 4211 (`vite preview`, the built bundle).** Both bound
with `--strictPort` and both took the port — which `notes/w61-flat-doors-flush.md`
is right that curl alone cannot establish, since a port can answer `000` and
still refuse to bind seconds later. Everything below was re-run on the built
bundle **after** merging mainline (`3c81d04b2`). Everything below except `interiors-walk.mjs` was run
against the **built bundle**; that one instrument cannot be — see "the
instrument that only runs on dev", below.

## The root cause, one line

**`leafPair` took the swing angle as an argument, so every room chose its own —
and nobody chose the same one.** The angle was the one fact about an entrance
door that `DoorDecl.leaf` never published, and it is the only one the user has
now complained about twice.

## The item's account was right, and it was an undercount

The row said five rooms hang leaves ajar. Measured in the built world by
`scripts/probes/w65-leaf-angles.mjs` — which reads each leaf's **world normal**,
not its `rotation.y`, because two of the seven places that pick an angle use
opposite sign conventions — it is **eight angles across thirteen rooms**:

| room | before | after | where the angle was chosen |
|---|---|---|---|
| bank | 31.5° | **0.0°** | `int-bank.ts:244`, a literal `0.55` |
| casino | 31.5° | **0.0°** | `int-casino.ts:382`, a literal `0.55` |
| church | 31.5° | **0.0°** | `int-church.ts:278`, a literal `0.55` |
| jail | 31.5° | **0.0°** | `int-jail.ts:318`, `OPEN = 0.55` — *"the casino's and the bank's"* |
| hotel | 28.6° | **0.0°** | `int-hotel.ts:258`, `OPEN = 0.50` |
| library | 48.7° | **0.0°** | `int-library.ts:736`, `OPEN = 0.85` — *"matching the kit"* |
| pawn | 77.3° | 77.3° | `int-pawn.ts:185`, `OPEN = 1.35` — **deliberate, left alone, see below** |
| burger · diner · tax · thrift | 48.7° | 48.7° | `ct/interior.ts:1466`, `SWING = -0.85` — **the kit, see below** |
| apt301 | 90.0° | 90.0° | the same kit leaf |
| bodega | 135.0° | 135.0° | **already shut** — its door is on a 45° cut face, so 135° IS square to its own wall |

`int-jail.ts`'s comment naming its own value *"the casino's and the bank's"* is
the whole story: it was copied from a convention, and the convention was six
disagreeing numbers.

## What I changed

**`ct/vice.ts` — `export const LEAF_AJAR: number = 0`, and `leafPair` no longer
takes a swing.** The parameter is gone from the signature, not defaulted, so a
caller *cannot* pass the wrong angle. That is the user's own principle about
`DoorDecl.leaf`, applied one field further: *"a single-leaf room door in a
double-door building becomes IMPOSSIBLE rather than something a builder has to
remember."*

Typed `number` rather than left to infer the literal `0`, because
`ct/int-jail.ts` does real `cos`/`sin` with it to place its pull handles and a
literal type invites somebody to fold that arithmetic away.

The six named files each lost their number. `int-jail.ts` and `int-library.ts`
import `LEAF_AJAR` (the jail for its handles, the library because its leaves are
hand-rolled back-to-back planes on the outer face rather than `leafPair`'s
mirrored pair).

### `ct/doors.ts` was the obvious home and it is a trap

The angle belongs conceptually on `DoorLeaf`, beside `clearW`, `glazing` and
the rest. **It cannot go there.** `ct/doors.ts:146` eagerly globs `./int-*.ts`,
and its own comment records why every `int-*.ts` imports only `type DoorDecl`:
a TYPE import is erased, so there is no runtime edge back. A runtime
`import { LEAF_AJAR } from './doors'` in five `int-*.ts` files closes that
cycle, and a module in a cycle resolves to `undefined` inside an eager glob —
**silently, in the BUILT BUNDLE only** (GOTCHAS 28; SEVENS was lost exactly that
way once). `ct/vice.ts` already owns `leafPair` and the leaf mirror, imports
nothing that reaches `doors.ts`, and is already imported by four of the six.

## The street face is the truth, and it is not a taste call

Nine of the twelve shopfronts **have no exterior door geometry at all** — the
door is painted into the facade texture (`doormatch12`'s "outside" column reads
`none (painted facade)` for nine rows, and `ct/civic.ts:1178-1181` is the
church's: one timber rectangle with a meeting-stile shadow down the middle). A
painted door is shut and cannot be anything else. The two buildings that do hang
real leaves on the street — the jail and the bodega — hang them shut. `0` is the
only value that can agree with what is already outside.

**Measured, both faces, one run** — `scripts/probes/w65-jail-both-faces.mjs`:

```
street face  (61.0, -103.0): 2 leaves  0.0° 0.0°
lobby face   (1000.0, 13.0): 2 leaves  0.0° 0.0°
PASS — 4 leaves across both faces, none more than 0.0° off shut
```

That is the exact disagreement w60 measured (`0°` outside, `±31.5°` inside) and
could not act on, closed.

## A second defect the shut doors exposed, and fixed

The first frames of the shut pairs had **a bright grey-white slit down the
meeting stile** — the jail's and the church's worst. `gap` is documented in
`leafPair` as *"the shadow line between the leaves"*, and with the leaves swung
apart it never had to actually be one; shut, that 2·`gap` strip stands open onto
the void behind the doorway. So does the 0.06 m above the leaves (`DH - 0.06`).

This is w60's own "found and NOT fixed": *"the interior doorway opens onto
nothing … whichever way that goes, the opening wants something behind it."*

**`doorRebate()` in `ct/vice.ts`**: one dark plane across the whole opening,
0.012 m behind the leaf plane — far enough that no depth test has to break a tie
(GOTCHAS 6, and `w59-jail-door.md` is what two coplanar opaque faces cost).
Called by `leafPair` for five rooms and by `int-library.ts` for its hand-rolled
pair. **No leaf width changes** — `leafPair` already refuses to *"quietly change
one of their leaf widths by a centimetre"*.

The hotel is the proof this is the right object: it is the one room that already
had a centre mullion, and the one room whose shut doors photographed with no
slit at all.

**I got it wrong first and the screenshot caught it.** The first commit's
material had `side: THREE.DoubleSide` **in the comment and not in the code**. A
`PlaneGeometry` normal is +z and the player looks along +z, so the rebate was
invisible from inside all six rooms — and the only reason I know is that I
re-shot the doors instead of trusting the diff.

## What I did NOT touch, and why — precisely, for the desk

**Both are places a leaf angle is still chosen, and both are outside the item.**

1. **`ct/interior.ts:1466`, `const SWING = -0.85`** — the kit's single leaf, worn
   by **burger, diner, tax, thrift** (48.7°) and **apt301** (90.0°). Their street
   faces are painted shut, so they are the same mismatch. I left it because
   `ct/interior.ts` is not named by item 159 (BUILDER-BRIEF §9) **and because
   those four rooms are already RED in `doormatch12` for a bigger reason — they
   are wearing the wrong leaf entirely.** The recipe that fixes that hangs
   `leafPair`'s own pair, at which point they inherit `LEAF_AJAR` for free. The
   fix is forward-compatible; changing `SWING` now would be fixing the angle of a
   leaf that is itself scheduled for replacement. **One line if the desk wants it
   sooner:** `const SWING = -LEAF_AJAR;` plus the import.

2. **`ct/int-pawn.ts:185`, `OPEN = 1.35` (77.3°)** — **do not change this without
   reading its comment first.** It is the only one of the eight that was chosen
   on purpose, it quotes the user (*"the door reads as SHUT-BUT-OPEN — the leaf
   is swung in with a dark void behind it"*), and it records a **measured
   sight-line trap**: at a smaller angle the leaf stood in the `canSee` line to
   the way-out spot and *"the prompt is live 0.16 m from the spot and null at
   0.37 m"* — the *"im literally stuck here"* class. Laying it back along the
   jamb was the fix. It is a single leaf, not a pair, so `leafPair` does not
   reach it. Bringing it to 0 is defensible but is a decision about a room whose
   file the item does not name.

3. **`[interior:hotel] NO BUILDING NAME`** fires on every `bugsweep` run. The
   hotel's `DOOR` declares `building: 'HOTEL ORPHEUS'` (`int-hotel.ts:82`) but
   its `buildRoom` spec does not name a building, so w57's guard is correctly
   saying the declaration is being dropped. **Pre-existing and identical on
   mainline** — I checked `git show add-stick-and-city98:…int-hotel.ts`, same
   line 82, same absence. Not mine, and worth a row: it is exactly the fault w57
   built that warning to make visible.

## Could the shut leaves eat the way out?

**This was the real risk and it is the reason `int-pawn.ts` exists in the shape
it does.** `crosstown.ts:2016`'s `seeRaw` raycasts **the whole scene** — any
visible mesh blocks a `[E]` sight line, and the pawn shop has already lost its
exit prompt to a door leaf once.

It cannot happen here, and the arithmetic says why before the walk does: the
way-out spot sits at `hd - 0.55` (`interior.ts:1338`) and the leaves hang at
`hd - 0.12`, i.e. **0.43 m on the far side of the spot**, with `seeRay.far` set
to `dist - 0.35` so the ray stops short of the spot in any case. Shutting the
leaves moves them **away** from the player: ajar, the jail's pair leaned to
`hd - 0.73`, *inside* the room and past the spot. This change strictly reduces
the hazard.

Confirmed by looking as well: `[E] out to the street` is up in **all six**
after-frames, from 3.2 m back — and `pickSpot` only ever offers a spot `canSee`
returned true for, so a live prompt in the frame IS an unblocked sight line.
Then confirmed by walking it, six for six, at 0.4 m. See the walk table below.

## How it was proved

| | |
|---|---|
| `scripts/probes/w65-leaf-angles.mjs` | 13 of 13 rooms measured, before and after. Six went 31.5/31.5/31.5/31.5/28.6/48.7 → **0.0** |
| `scripts/probes/w65-jail-both-faces.mjs` | **PASS** — both faces of the door the user named, 4 leaves, all 0.0° |
| `scripts/probes/w65-leaf-shot.mjs` | 6 of 6 doors photographed, `/tmp/w65-final2/` |
| `node scripts/doormatch12.mjs` | **exit 1, 4 of 12 — byte-identical to the baseline table.** Red on mainline before I started (burger, diner, tax, thrift); same four, same rows, after |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, exit 0, no new console warnings |
| `node scripts/health.mjs` | `WORLD OK — __ct initialised`, exit 0 |
| `npm run typecheck` | clean — and it is what proved every `leafPair` call site was converted, since the signature lost a parameter |
| `scripts/interiors-walk.mjs <id>` | **all six rooms walked.** See below |
| mutation, red then green | `LEAF_AJAR = 0.55` → `w65-jail-both-faces.mjs` **exit 1**, `lobby face: 31.5° -31.5°` while the street face held at `0.0° 0.0°`; restored → **exit 0**. Both statuses watched (GOTCHAS 72) |

### The walk — the assertion that actually mattered

`interiors-walk.mjs` warps the player 0.9 m inside the door, walks him **at** it,
and requires the way-out prompt to come up and `[E]` to land him on the street.
That puts him within ~0.4 m of the now-shut leaves, which is the tightest
version of the sight-line question. **Six for six:**

| room | | |
|---|---|---|
| bank | 25/25 | `prompt="[E] out to the street"`, `pos=-5.8,1.62,6.1` |
| casino | 25/26 · 24/26 | see the two pre-existing reds below |
| church | 25/25 | `pos=7.2,1.62,-79.5` |
| hotel | 25/26 | pre-existing red below |
| jail | 24/25 | pre-existing red below |
| library | 25/25 | `pos=-7.9,1.62,-13` |

Every one printed `ok … walking to the inside of the door raises the way-out
prompt` and `ok … E at the inside door puts you back on the street`.

**The full 13-room run is not usable and I stopped it twice.** It buffers its
whole report to the end, takes past its own 40-minute cap, and — the part worth
knowing — **it can only run against a DEV server** (it does
`import('/src/proto/ct/doors.ts')` inside the page, which a `vite preview`
answers with `Failed to fetch dynamically imported module`, a message that reads
like a broken world). Running it against dev while still editing source is worse
than useless: **vite HMR reloads the page under the walk.** Per-room is the
usable form.

### Three reds in those runs that are NOT mine, each proved

1. **`jail: the room keeps its own light after dark — 6/501 dimmed`.** Proved
   pre-existing by checking out mainline's seven files onto the dev server and
   re-walking: **identical, 6/501, 24/25**.
2. **`casino`/`hotel`: the customer station comes from the world, not from
   memory.** Pre-existing; the message names its own cause (*"no served-spot
   published in this room"*) and cites `F-keeper-stations-audit.md`.
3. **`casino: keeps its own light after dark` IS FLAKY, AND THAT IS THE REAL
   FINDING.** Four runs, two on mainline and two on mine: **109, 109, 110, 0**.
   I nearly reported the `0` as my change fixing something. It does not.
   `interiors-walk.mjs:1130` compares two material-colour samples **by array
   index** — `noon.filter((c, i) => night[i] !== c)` — taken 500 ms and 900 ms
   after a clock snap, and the casino's bulbs are animated, so one frame's
   difference in phase moves ~110 entries. That is GOTCHAS 76's *"never recover
   ordered classes by material reference"* in a different file: **a positional
   comparison over a traversal of a room that animates.** Worth a row; it is a
   check that can go green by luck.

**`fp`/`fpdiff` was NOT used and would have been invalid.** This change adds six
meshes (`doorRebate`), and `scenedump.mjs:26` seeds one global `Math.random`
that every `generateUUID()` draws from — GOTCHAS 75, three builders confirmed it
independently. The claim under test is an ANGLE, which `w65-leaf-angles.mjs`
reads directly off the world matrix.

## My own verdict on the after-images

`/tmp/w65-final2/{bank,casino,church,hotel,jail,library}-door.png`, built
bundle, against `/tmp/w65-after/` (shut, no rebate) and the ajar originals.

**Jail:** one solid steel double leaf, shut, panels and kick plates continuous,
a dark meeting stile — indistinguishable in state from the street pair, which is
the whole ask. **Church:** shut timber boards with two brass ring handles on the
free edges, matching the painted west front. **Bank** and **casino** read as
shut glazed entrances with their push bars on the free edges. **Hotel** keeps its
own brass mullion and needed nothing. **Library** is the biggest improvement of
the six — 48.7° open was two panels hanging in a hole; shut it is a panelled
double door with brass push plates.

Honest reservations: the rebate is one flat dark colour behind every door, so at
the church — where the reveal either side is pale limestone — the joint reads
slightly *darker* than a real shadow would. And `doorRebate` draws a plane the
full `DW × DH` for the sake of the 0.06 m over the leaves; a caller whose leaves
already fill the opening pays for a mesh it cannot see. Neither is worth another
round.

## Two traps I walked into, both already written down

1. **`pkill -f vite` killed my own shell** (exit 144) and took the preview with
   it. GOTCHAS 64 says this in bold and I did it anyway. `lsof -ti :PORT | xargs
   -r kill` is the version that works.
2. **`interiors-walk.mjs` cannot run against a built preview** — it does
   `import('/src/proto/ct/doors.ts')` inside the page, which only a dev server
   serves. It fails with `Failed to fetch dynamically imported module`, which
   reads like a broken world rather than a wrong URL. And running it against dev
   while still editing source is worse than useless: **vite HMR reloads the page
   under the walk.** I killed one run for exactly that and re-ran it after the
   last commit.

Third, smaller: the build-stamp guard caught me serving a `dist/` built one
commit before HEAD and said so precisely. It is a good instrument and it saved a
run I would have believed.
