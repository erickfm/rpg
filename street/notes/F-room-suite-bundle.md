# The room suite cannot measure the bundle

Split out of `notes/AUDIT-INSTRUMENTS.md`. That file is append-only and shared,
so every builder adding to the end collides with every other; this section
conflicted on four consecutive rebases of mine. The content is unchanged.

## It is dev-only, and making it otherwise is not a rewrite of one line

`scripts/interiors-walk.mjs` — the largest check in the project, 195 assertions
across eight rooms — does `await import('/src/proto/ct/doors.ts')` in two
places. That is a SOURCE path. Only a dev server serves it; against a built
bundle it dies with *"Failed to fetch dynamically imported module"*.

So the suite can only ever see dev, and **dev is not what ships**. Circular
imports resolve differently in the bundle: GOLDEN ACES's door was dropped there
while dev reported all eight, which `scripts/doors-declared.mjs` warns about in
its own output. The check that walks every room is structurally unable to see
the build in the artifact.

Three other harnesses have the same import and the same limit: `mirror-walk`,
`G-rooms-walk`, `G-vice-walk`.

**I tried the obvious fix and reverted it.** Everything those two blocks read is
already published — `at` and `stand` by `__ct.doors()`, resolved room width by
`__ct.roomDims()` — so asking instead of importing looks like a mechanical
swap. It is not. The substituted values are not the same quantities:
`doorWorldFor()` is not `point.z` for a `face`-style declaration, and
`roomWidthFor(frontage)` is not the resolved room width the slab records. The
run went from 195/195 to **152/195**, with `pos=NaN` where an undefined leaked
into a warp.

**Nobody should attempt this as a quick swap.** It needs someone to work out,
per field, which quantity the harness actually wants — and the two `face`
declarations (bodega, and the side-street pair) are where the two conventions
come apart, which is exactly where it broke.

`./scripts/slow-pinned.sh` runs dev by default for this reason, with
`PINNED_MODE=preview` for the bundle-mode checks that can take it.

---

## A keeper-facing guard that did NOT discriminate — do not rebuild it this way

Ported G's facing check (`G-rooms-walk.mjs`, `3ca7e6d0`) into `interiors-walk`
so it would cover all eight rooms rather than G's four. It passed on every room.
Then I put the bug back — reset the thrift keeper to the original
`facing: Math.PI` — and **it passed again**. It does not discriminate, so I did
not ship it.

What I changed from G's version, and the likeliest culprit: **G hardcodes a
customer viewpoint per room; mine derived one** by standing between the keeper
and the room centre. That looked strictly better — no coordinates to go stale,
works for eight rooms instead of four — and it may be the thing that broke it.
Two candidate causes, and I could not separate them with the runway I had:

1. **The viewpoint.** "Most peripheral plane in the slab" may not be selecting
   the keeper at all in every room. The thrift now has a mannequin, a dressed
   window form and a keeper, and only one of those is a citizen sprite.
2. **The sprite may turn to face the player regardless of `facing`.**
   `turn.mjs` reports "own yaw values 8 (spread 5.5 rad)" for every keeper,
   which reads like the figure itself rotating, not just the atlas column
   changing. If `update()` re-aims the figure, the atlas column read from in
   front is "front" whatever `facing` was set to — and no viewpoint-based test
   can see the bug.

If (2) is true it is the more interesting finding, because it means G's check
discriminates for a reason other than the one its comment gives, and the class
of bug is not what any of the three of us thought. **That is worth someone with
`ct/citizens.ts` in their ownership settling, and it is H's file, not mine.**

**The facing derivation itself stays.** It is not justified by this failed
guard: it matches the convention `ct/citizens.ts` documents (`atan2(vx, vz)`,
`0 = +z`), it matches the fix G measured and landed, and deriving from the
counter is strictly better than a literal whatever the runtime does with it.

---

## The keeper-facing decode works; the VIEWPOINT cannot be derived. Twice now.

Second attempt, using H's published layout via G's decode (`64c13034`) instead
of my own threshold. **The decode is right and it discriminates** — proven the
way the first attempt was not:

```
fixed    col 1 mirrored → sector 7, three-quarter on — authored facing  0.20 rad
bugged   col 3          → sector 3, three-quarter away — authored facing -2.94 rad
```

Those recover the source constants — 0 from my derivation, `Math.PI` from the
bug — **off the rendered sprite, without reading the file.** That is the strong
property, and it independently confirms the facing fix in "The thrift was a boutique: 21 objects for a room whose brief is DENSITY".

**What is still wrong is mine, and it is the same mistake twice.** G authors a
customer viewpoint per room; both my attempts DERIVED one — first "the most
peripheral plane", then "stand between the keeper and the room centre" — because
that looked strictly better: nothing to go stale, eight rooms instead of four.

Run over all eight it reported three failures, and one of them is **G's casino**,
which G has verified reads `sector 0, facing you` from their authored spot. Under
my derived viewpoint it reads `sector 6, in profile`. The dealer stands across
the felt; the room centre is not where a player stands to be served. So the
check was accusing a room G had already proved sound — the third instrument of
mine this session to do that, after the pawn shop's walls and the tax office's
stools.

**The per-room customer spot is load-bearing, not laziness.** It encodes a
design fact — where a player stands to be served — that room geometry does not
contain. I twice mistook it for a coordinate worth eliminating. Anyone tempted
by the same tidy-up should read this instead of finding out.

**RESOLVED — bodega and diner were my viewpoint, not the world.** With an
authored `keeper` spot per room, all four read `sector 0, facing you`, and the
recovered constants match the source exactly: thrift, diner and burger 0 rad,
bodega 1.57 rad. The check ships, discriminates (`facing: Math.PI` put back
reads `sector 4, facing away — authored facing -3.14 rad`), and rooms with no
authored spot are SKIPPED, so G's four stay covered by G's own harness rather
than being accused by mine.

---

## ~~A dev/bundle ground discrepancy at the library kerb~~ — RETRACTED, it was my probe

`716b21d13` made the point that "the pavement is 0.14" is a remembered constant
standing in for a published one, so I stopped hard-coding it in `steps-walk` and
`integration-doors`. Doing that turned up something I had seen once and not
chased.

`steps-walk` reads the settled height at the foot of each flight. Same commit,
two servers:

```
                        DEV (:4185)        BUILT BUNDLE (pinned preview)
library, at the kerb    0.14               0.00
church,  at the kerb    0.14               0.14
```

The climb is unaffected in both — `gy 0.14 → 0.99`, up and back down, and
`the steps climb and descend, and nothing sinks` passes either way. So this is
not a broken flight; it is the floor under the library's kerb answering
differently in the artefact from the dev server, at one of the two flights.

### RETRACTED. There is no discrepancy; the probe was reading a contaminated value.

`steps-walk`'s `gyAt` warped to the point and read `pos()[3]` 25 ms later — the
rig's gy, which is a SHARED last-written value with several writers, the
citizens among them. `9e59be123` found `E-yard-walk` deciding whether to run its
climb from that same reading and SKIPPING an entire flight when it came back
low, while reporting "all walks passed".

Asking `groundAt` instead — the same pick the rig uses, which nothing else
writes — the two servers agree:

```
                        DEV        BUILT BUNDLE
library, at the kerb    0.14       0.14
church,  at the kerb    0.14       0.14
```

**I sent E a reproduction for a fault in their file that does not exist.** The
numbers below were real readings and the conclusion drawn from them was wrong,
which is the worse kind of false report: it carries evidence. Everything from
here down is left as the record of what I claimed, struck through by this.

The original text, wrong:

**Not diagnosed, and deliberately not guessed at.** The one mechanism this
project has already proved does exactly this is module init order differing in
a bundle — that is how GOLDEN ACES's door was dropped in the artefact while dev
showed all eight. The library forecourt's floor comes from `courtGround` in
`ct/civic.ts`, which is **E's**, through the ground registry.

Worth someone's time because the artefact is what ships and the discrepancy is
in the direction that matters: the bundle reads LOWER. A player who cannot be
put at 0.14 there would be standing in the pavement rather than on it. I have no
evidence that happens — the walk works — but "the floor answers differently in
the build" is not a sentence to leave unexamined.

Reproduce: `PINNED_MODE=preview ./scripts/slow-pinned.sh steps-walk` against
`SHOT_URL=http://localhost:4185/ node scripts/steps-walk.mjs`.
