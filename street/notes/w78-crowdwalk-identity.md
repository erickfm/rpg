# w78 — item 218: crowd-walk pairs the crowd by IDENTITY, not by array index

Port **4340** (`ss -ltn` clean before binding, `--strictPort`), `vite preview`
over `dist/` — the BUILT bundle, GOTCHAS 28 — aimed with `SHOT_URL` on every
run. Worktree was at the initial commit and was reset to `add-stick-and-city98`
first: **GOTCHAS 54, fifteen for fifteen now.**

## What changed

**`scripts/crowd-walk.mjs`** only, plus one case in `scripts/canfail.mjs`.
**No world source was touched** — `git diff HEAD -- src/` is empty, so the world
the user plays is provably unmoved and no `fp` argument is needed.

| | before | after |
|---|---|---|
| `walkers()` helper | maps the cast, then `.sort((a,b) => a.x-b.x \|\| a.z-b.z)` | carries the cast index `k` **above** the sort; the sort stays, for reading |
| the "they are walking" leg | `w0.filter((p,i) => Math.abs(p.z - (w1[i]?.z ?? p.z)) > 0.2)` | pairs on `k` through the **intersection** of the two samples |
| population | none on this leg; `?? p.z` scored a missing person as "did not move" | derived floor `max(4, ceil(50% of sampled))`, and the leg is red below it |
| negative case | none | inline, runs every time — see below |
| selftest inversion | `crowd-lane` only, a lane-GEOMETRY case | `crowd-frozen` added, aimed at this leg |

**Root cause in one line: the sort exists for READING and the arithmetic was
being done across it.** `ct/crowd.ts:751` maps the `citizens` array, and
`citizens` is only ever pushed to, once, inside the build-time `CAST.forEach`
at :246–:272 — never spliced, never sorted. So the raw index already *is*
identity, and `crowd-walk.mjs` was throwing it away one line later by sorting on
`c.lane`, which `ct/crowd.ts:382` and `:392` move as the crowd routes.

## ⚠ THE ROW IS RIGHT ABOUT THE BUG AND WRONG ABOUT ITS EXPOSURE

The row ranks this as *"a registered check reporting a pass over a genuine
failure"*, present tense. **It is not doing that, and it never has, because it
cannot reach the regime where the bug lives.**

`crowd-walk` takes `w0` about 2.4 s after the page loads and `w1` 1500 ms later
— **once, on a freshly loaded world**. w72's ~19% figure comes from sampling
**one page continuously** for minutes. Those are different worlds.

`scripts/probes/w78-crowdwalk-firstwindow.mjs 40` reloads the page 40 times and
reproduces crowd-walk's own window exactly:

```
40 independent page loads, crowd-walk's own first window (6 walkers each):
  sorted order reordered inside the window   0/40
  honest and counted DISAGREE                0/40
  FALSE GREEN (honest <4, counted >=4)       0/40
  honest count below the check's bar of 4    0/40
  honest `moved` distribution: 6/6:40
  per-person |dz| over 1.5 s, 240 samples: min 0.936  median 1.846  max 2.636
```

The sorted order came out **`4,2,0,5,3,1` on every single load**, and the
smallest step any one person took was **0.936 m against a 0.2 m bar**. The crowd
starts in six fixed home lanes (`ct/crowd.ts:262`) and does not begin reordering
until roughly a minute in; this leg is long finished by then.

**So the fix changes no verdict today, and that is worth saying plainly rather
than dressing the item up.** What it changes is that the leg is no longer one
moved line from lying: put that sample later in the file, or lengthen the gap
past ~60 s, and the reorder rate arrives with it. The protection was accidental
and is now structural. The comment at the leg says so, for whoever edits it next.

**The desk should re-rank on this.** It was ranked high as an *active* false
green; it is a live landmine with a ~60 s fuse that nothing currently lights.

## The bug itself, independently reproduced — and worse than w72 measured

`scripts/probes/w78-crowdwalk-oldvsnew.mjs 110` is a **property sweep**, not a
route: it computes all three counts on every trial and asserts `NEW === truth`
over the whole stream, rather than going looking for w72's trial 47 by number.

```
110 trials, 6 walkers:
  sorted order reordered              22/110
  OLD count disagreed with the truth  13/110
  OLD flipped a RED verdict to GREEN   3/110
  NEW count disagreed with the truth   0/110

  identity pairing agreed with the truth on all 110 trials,
  including the 22 that reordered and the 13 the old line got wrong.
```

The three flips, verbatim — RED by the truth, GREEN as the old line counted them
against its own `moved >= 4` bar:

```
  85  3,5,2,4,0,1 -> 3,5,2,0,4,1   truth 3/6   OLD 4/6   NEW 3/6
  94  3,0,4,1,5,2 -> 3,0,4,1,2,5   truth 3/6   OLD 5/6   NEW 3/6
  97  3,0,4,1,2,5 -> 3,0,4,1,5,2   truth 2/6   OLD 4/6   NEW 2/6
```

That is w72's finding confirmed from scratch on a different run, and three
instances rather than one. The error only ever ran one way, as w72 said: a
mispair can only ADD to a count of "how many moved", so **a stalled crowd could
certify as walking**. `NEW` was never wrong, on any of the 110.

The probe carries its own population floor: fewer than 3 reordered trials and it
**exits 3** rather than reporting a green it did not earn — which is the trap
w72 named (its own first 12-trial probe returned 0/12 and nearly filed the file
clean).

## The negative case, and the two goes it took

The item asks for a population floor that fails when it measured nothing. A
floor nobody has watched reject anything is the same empty promise as a check
nobody has watched fail, so the judgement is authored **once** and called twice
— for real, and by a negative case that runs on **every** invocation rather than
behind a flag.

**My first negative case proved nothing and I nearly shipped it.** It handed the
judgement a second sample of one person: red, as wanted — but `moved` can never
exceed `judged`, so `moved >= 4` would have failed on its own and the floor was
never the deciding clause. The case that isolates it feeds a cast of **twelve**
of which **five** come back, all five having moved 99 m: the movement bar is
satisfied outright, and the floor of 6 is the only thing that can reject it.

```
OK   and the population floor rejects a thin sample — 5 of 5 moved 99 m, so the
     movement bar of 4 is satisfied, and it is STILL red because only 5 of 12
     came back against a floor of 6
```

## The selftest inversion — `crowd-frozen`, watched red with a FULL population

`crowd-walk` had one case in `canfail.mjs`, `crowd-lane`, and it is a lane-
GEOMETRY case: it moves the walkable network and the people keep walking. So the
leg this item rewrote could have been turned into something that measures
nothing and canfail would still have called crowd-walk guarded — GOTCHAS 34
inside the tool whose job is catching it, the same shape w72 hit in item 209.

`crowd-frozen` zeroes `ct/crowd.ts:595`'s `step`, which is the only thing that
advances a citizen along its edge. All six stay in the world, planned, routed
and reported by `walkers()` — so the leg reddens **with a full population, not
as NOTHING TO CHECK**. Applied by hand, rebuilt, and watched:

```
  OK   the crowd is six (found 6)
  FAIL they are walking — 0/6 moved >0.2 m in 1.5 s, paired by cast identity
       (6 of 6 present in both samples, floor 4)
  OK   all 6/6 feet planted on the floor beneath them
  ...
  5 CHECK(S) FAILED                                              exit 1
```

**It discriminates** — the feet-planted leg and both lane-walk legs stayed OK
under it, so it is not a blanket "everything falls over". Through canfail
proper, both cases together:

```
  OK   crowd-lane   CAUGHT  citizens standing where a stopped body seals the walk
  OK   crowd-frozen CAUGHT  a crowd that is planned and routed but never takes a step
  2/2 checks caught their mutation
  every mutated file restored byte-for-byte
```

## Proof

**Five runs, unchanged source, identical every time** (`git status` clean across
all five; the only untracked file was this note's probe):

```
run 1 exit=0  11 OK  0 FAIL  all crowd checks pass
run 2 exit=0  11 OK  0 FAIL  all crowd checks pass
run 3 exit=0  11 OK  0 FAIL  all crowd checks pass
run 4 exit=0  11 OK  0 FAIL  all crowd checks pass
run 5 exit=0  11 OK  0 FAIL  all crowd checks pass
```

Suite level, all on the built bundle at :4340:

- `npm run sweep` — **96 shots, 0 STATION MISS, 0 COVERAGE**, no new console
  errors. The only warnings are the known pre-existing set: `[interior:hotel] NO
  BUILDING NAME`, the THREE.Clock deprecation, the Canvas2D `willReadFrequently`
  notices and the WebGL ReadPixels stalls.
- `node scripts/health.mjs` — **exit 0, WORLD OK**.
- `npx tsc --noEmit` — **exit 0**.

**A first attempt at the five runs came back `exit=3` five times for five, and
it was right to.** `reportWorld` refused: I had committed after building, so
`dist/` held `317dd1323` while the checkout was at `53e2c6239`. `MEASURING THE
WRONG WORLD` is exactly the GOTCHAS 26/48 guard doing its job, and exit 3 for
"nothing measured" is the correct code (GOTCHAS 32). Rebuilt, re-ran, five green.

## Found and NOT fixed

### 1. `canfail.mjs --only` is VACUOUSLY GREEN on a name it does not know

`scripts/canfail.mjs:1223–1224`:

```js
const only = process.argv.slice(2).filter((a) => a !== PORT_ARG);
const run = CASES.filter((c) => !only.length || only.includes(c[0]));
```

`only.includes` is an **exact** match, and an unmatched name is not refused. I
ran `node scripts/canfail.mjs crowd`, meaning "the crowd guards", and got:

```
can my checks fail?   (mutation must go red)

0/0 checks caught their mutation
every mutated file restored byte-for-byte          exit 0
```

**Zero cases selected, exit 0, and a sentence that reads like success.** In a
tool whose entire purpose is proving guards are awake, that is the failure mode
it exists to catch, and I created a fresh user for it by adding a second
crowd case — the natural way to run "both crowd guards" is the one word that
silently runs neither.

`checks.mjs` already solved this, deliberately, and says so in its own comment
at :52–:56: *"a spelling this does not recognise must not silently select
nothing … an unmatched name is refused below rather than producing an empty,
green, entirely vacuous run (GOTCHAS 34)"*. canfail needs the same three lines.
I have **not** written them: it is outside item 218 (BUILDER-BRIEF §9), and I
had already stretched into this file for the one case the item's DONE WHEN
requires. **Wants its own row — it is a one-line guard and I am confident of the
diagnosis, having watched it print.**

### 2. Two probes still sit on the pose-identity bug — already item 217

Unchanged and unrelated to this item; noted only so the desk does not read my
silence as a clearance. `w69-seated-offers.mjs:64`, `w69-seated-loan.mjs:70`.

### 3. A process failure of my own, recorded because it nearly mattered

**My first ten minutes ran in `/home/erick/projects/rpg/street` — the SHARED
checkout the desk commits from — not in my worktree.** GOTCHAS 84 exactly, and I
caught it only because the harness refused a `Write`. I had run `npm install`
and one `npm run build` there.

**Nothing was harmed and I checked rather than assuming:** no file was edited,
`npm install` found the lock satisfied, and the build only rewrote `dist/`, which
is gitignored. The staged artifact GOTCHAS 63 warns about survived —
`street/artifact/crosstown-97.html`, 1,121,715 bytes, mtime Aug 2 05:06,
untouched. But a bare `npm run build` in the shared tree is precisely the thing
that entry says destroys `dist/artifact.html`, and I ran one. **The desk should
re-pack before publishing if it was relying on `street/dist/artifact.html`
rather than the staged copy.**

## What I derived vs copied

- The **identity** is derived, not copied: I read `ct/crowd.ts:751` and then
  checked every mention of `citizens` in that file (:246 declare, :272 the only
  push, :293/:503/:539 reads, :746–:796 the four map-based affordances) to
  establish that array order is stable for the life of the world. It is not
  assumed from w72's note.
- The **fix shape the row prescribed — `material.uuid` keying, four samples per
  hour, excluding self-animating materials — does not apply here and I did not
  copy it.** That template is for a NIGHT-LIGHT comparison over a box of
  materials; this leg compares six people's positions. There is no uuid to key
  on, `walkers()` publishes no id, and "self-animating" is what the subject is
  *for*. The transferable half is the reasoning — key on identity, judge the
  intersection, carry a derived floor — and that is what was taken.
- The **floor's shape** (`max(n, fraction of sampled)`) is copied from
  `scripts/interiors-walk.mjs:1227` by way of w72's account of it. The
  **numbers** are re-derived: `max(4, 50%)`, because 4 is this leg's own movement
  bar and anything under it makes `moved >= 4` meaningless. w72's own §1 is the
  argument for not transferring a floor between files.
- The **0.2 m movement bar and the `moved >= 4` threshold are untouched.** I
  measured the distribution before deciding (min individual step 0.936 m over
  240 samples, honest count 6/6 on 40 of 40 loads) precisely so that I could
  leave them alone with a reason rather than out of caution. **Nothing was
  loosened to make anything pass** (BUILDER-BRIEF §7).

## The probes

Both in `scripts/probes/`, named for the question they answer (§7a):

- `w78-crowdwalk-firstwindow.mjs [loads]` — does the bug reach the window the
  check runs in? Exits 3 if it saw no walkers.
- `w78-crowdwalk-oldvsnew.mjs [trials]` — over a long horizon, does identity
  pairing agree with the truth where the old line did not? Exits 3 if fewer than
  3 trials reordered, i.e. if it had nothing to prove against.
