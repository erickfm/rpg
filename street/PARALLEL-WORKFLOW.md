# Running agents in parallel on CROSSTOWN '97

How Erick and Claude split work across more than one agent without losing the
hand-authored feel of the world, and without Erick becoming an air-traffic
controller.

Companion to `CLAUDE.md` (project rules) and `FEATURE-REQUESTS.md` (the log).

---

## 1. The thesis

**The bottleneck moves. Find where it is now, not where it was.**

It has been in three different places in one session:

1. *Assumed* to be the user's review capacity. **Wrong** — Erick has a clear
   vision and generates direction faster than agents absorb it.
2. Then genuinely **agent bandwidth** — so we added builders.
3. Then **the desk itself**, and this is the one that actually hurt: builder
   work sat unmerged for over an hour, one builder accumulated a ten-item
   queue on one file, and the live world served a broken build — all while
   the desk was heads-down writing code instead of running the queue.

The lesson is not "add agents". It is that a parallel setup has a *coordination*
job that must be done continuously, and if the coordinator starts building, the
whole thing silently stalls. See §11.

## 2. What makes this project specifically awkward

Four properties, all of which shape the rules below:

1. **`crosstown.ts` is a monolith.** 2313 lines, and `makeCrosstown()` starts at
   line 599 — a single ~1700-line function. Every substantive commit in the
   project's history touches it. Two agents working "on different features"
   still land in the same function.
2. **`FEATURE-REQUESTS.md` is a registry file.** Every round appends to it.
   Registry files are the single most-cited cause of parallel-agent merge pain.
3. **Verification is a shared singleton.** Port `4177` is hardcoded in ~15 of the
   `scripts/*.mjs` screenshot tools; only `shots.mjs` honours `SHOT_URL`. Two
   preview servers at once means one agent screenshots the other's build.
4. **One artifact URL.** Two publishers means Erick playtests a build containing
   half of each.

`shots/` is gitignored and per-worktree, so screenshot output separates for
free. That one's already fine.

---

## 3. Topology: one desk, at most two builders

```
              Erick
                │  (every request goes here, always)
                ▼
        ┌───────────────┐
        │  THE DESK     │  triage · small changes · merge · build · publish
        │  (main tree)  │  owns FEATURE-REQUESTS.md + the artifact URL
        └───────┬───────┘
         brief  │  brief
        ┌───────┴────────┐
        ▼                ▼
   builder A         builder B          ← real `claude` sessions in worktrees
   ../rpg-<topic>    ../rpg-<topic>        addressable: Erick can drop in
```

**The desk** is the session Erick talks to. It never requires him to know who
owns what. It handles small work inline and briefs builders for chunky work.

**Builders** are separate `claude` sessions in git worktrees, each owning a set
of modules. Normally the desk briefs them and Erick ignores them — but because
they are real sessions, he *can* drop into one to tune its area directly.

### Why not a pure orchestrator

An orchestrator spawning subagents is fire-and-forget: subagents run to
completion and report back. You cannot lean in at minute two and say "no,
warmer." For taste-driven tuning that is disqualifying.

Subagents still have a narrower place, spawned from the desk: **read-only** fan
out — bug sweeps, screenshot verification, "check every angle of this atlas."
Bounded, no writes, no steering required.

### Why start at two

Not review bandwidth (see §1) — integration bandwidth. Two is where the desk can
comfortably rebase, verify, and fold in handoff notes each round. Raise it as
soon as the desk is idle waiting on builders; the ceiling is wherever merging
and verifying starts lagging, and we find that empirically rather than guessing.

---

## 4. Triage: the only routing decision that matters

Every incoming request is one of two kinds.

| | **Tuning** | **Building** |
|---|---|---|
| e.g. | "lamps warmer", "crown still too big", "revert the watch" | "add a subway entrance", "build the laundromat interior" |
| Length | minutes | tens of minutes |
| Needs Erick | continuously, mid-flight | only at the end |
| Where | **the desk, serially** | **a builder worktree, parallel** |

Parallelizing tuning is pointless — only one thing can be evaluated at a time.
Serializing building wastes wall-clock. Most setups fail by choosing one
topology for both.

**Measured: the desk is roughly 10x faster than a builder on small work.** The
alley cat took a builder three rounds and 40+ minutes and was still wrong; the
tree rewrite took the desk three minutes. The round trip — write brief, builder
loads context, builder works, user screenshots, desk diagnoses, desk corrects —
dominates anything small. So:

> **If writing the brief would take longer than making the change, make the
> change.**

**Collision rule:** a request that lands in a module a builder already owns does
not start a second agent. It goes to that builder as a follow-up, or waits.

### Rebase before every item, not at the end

Builders drifted **85–91 commits behind mainline** before landing today, and
every one of the three hand-resolved conflicts came from that staleness.
Rebasing at the *start* of a queue item is nearly free. Rebasing after an hour
of work is where conflicts live. It is now the first line of every queue file.

### The queue is a file, not a message

Each builder has `street/notes/queues/<agent>.md`. **The desk writes; builders
only read.** That asymmetry is deliberate — if both sides edited it they would
conflict on every merge, which is exactly the problem the queue exists to fix.
Builders report completion in their handoff note instead.

`scripts/queues.sh` prints every queue plus each worktree's git state in one
view: what each agent is on, how much is behind it, and whether its work is
uncommitted, unmerged or behind mainline.

This replaced typing tasks into a builder's terminal, which had **no
visibility** (the desk could not list what was pending), **no ordering** ("do
this first" was a plea), **no persistence** (a context reset silently dropped
items), and **no accounting** — nothing flagged that one builder was holding ten
items while a functional blocker sat third in line.

### Always name the owner, out loud

**Every time Erick gives the desk something, the reply must say which agent it
went to.** Not a summary at the end of a batch — per request, every time.

> "Tree tufts → **me** (desk, `tex-world.ts`), landing in a minute."
> "Church tower → **builder D**, queued behind the BURGER BARN palette."

Why it matters:

- **Routing is invisible otherwise.** The desk hides who-owns-what by design
  (§3), and the cost of that convenience is that Erick cannot tell whether a
  request is being done now, queued behind six others, or dropped.
- **It makes reordering possible.** If he can see something landed behind a
  ten-item queue, he can say "jump that". He cannot ask for a priority change
  he cannot see. The bodega corner sat behind lower-value work for three
  separate asks because the queue position was never stated.
- **It surfaces desk mistakes early.** Saying "→ builder D" out loud when D
  already has ten items is the moment the desk should notice the queue is
  wrong. Written down, it is obvious; unwritten, it accumulates.

State the queue position too when it is not immediate: *"builder C, third in
line, roughly 20 minutes"* beats *"sent to builder C"*.

---

## 5. Prerequisites (do these before adding a second agent)

- [x] **Split `crosstown.ts`** — 2314 → 1213 lines, done 2026-07-24. Modules now
      live in `src/proto/ct/`, each independently ownable:

      | module          | lines | owns |
      |-----------------|-------|------|
      | `ct/paint.ts`   | 23    | `pixTex`, `dither` — the texel-painting primitives |
      | `ct/rng.ts`     | 13    | street dimensions + the ONE shared seeded `rnd()` |
      | `ct/tex-world.ts`| 197  | facade, shopfront, asphalt, walk, tree, pit, hydrant, pigeon, payphone |
      | `ct/cars.ts`    | 252   | the fleet: body/cabin/glass tex, `loftCabin`, `makeCar` |
      | `ct/citizens.ts`| 104   | `citizenAtlas`, `viewFor` |
      | `ct/street.ts`  | 407   | every building on the block + the alley |
      | `ct/bodega.ts`  | 151   | the corner-store interior |

      **Still in `crosstown.ts` (Stage 2b, not yet split):** the apartment
      walk-up (~400), clock/sky/watch/wallet (~150), weather + lamps + props
      (~200), and the sim loop (~250). These are coupled through shared *mutable*
      state — `lastGy` is written by `aptGround`, the `warp` hook and the sim
      loop; `wetMats`/`propColliders`/`boards` are appended to from several
      regions. They need a deliberately designed context object, not a
      mechanical extraction. Until then, treat `crosstown.ts` as one owner.

- [x] **Make the preview port env-driven.** Done — all 19 scripts honour
      `SHOT_URL`. Each agent gets its own port: 5177 the live world, 4178+ per
      builder.
- [x] **Create `street/notes/`** for handoff notes (§7).
- [ ] **Stamp the build.** Render the short commit sha somewhere in-frame so
      playtest feedback can be tied to a specific build (§9). Still not done,
      and stale-build feedback has cost real work twice.

**Stage 2b landed too** (a builder did it): `crosstown.ts` 1213 → ~440 lines,
with `ct/apartment.ts`, `ct/hud.ts`, `ct/props.ts` and `ct/ctx.ts` split out.
The `lastGy` floor-picker became module-owned with `gy()`/`setGy()`. Later
splits added `ct/tex-ground.ts` (kerb/gutter/walk) and `ct/cat.ts`.

**The file that is now the monolith is `ct/street.ts`** — every building, the
alley and the corner. It is where one builder accumulated a ten-item queue.
Split it the same way before putting more than one agent on the block.

### Worktree setup

```bash
git worktree add ../rpg-<topic> -b feat/<topic>
ln -s /home/erick/projects/rpg/street/node_modules ../rpg-<topic>/street/node_modules
cd ../rpg-<topic> && claude
```

The symlink matters — a fresh worktree has no `node_modules`, and a per-agent
`npm i` is pure waste.

---

## 6. The brief (desk → builder)

A builder cannot ask questions mid-run, so every ambiguity becomes a wrong guess.
Specs should be self-contained, cap acceptance criteria at 3–7 items, keep them
as a **list** (prose criteria get read as suggestions, lists get checked), and
state an explicit *not included* boundary.

```markdown
# feat/<topic>

## Goal
<one paragraph, in playtest language — what Erick will see and feel>

## Owns (edit only these)
- street/src/proto/props.ts
- street/scripts/<topic>.mjs   (new file, yours)

## Do not touch
- crosstown.ts entry point, FEATURE-REQUESTS.md, package.json, other modules

## Acceptance criteria
- [ ] <concrete, checkable>
- [ ] <concrete, checkable>
- [ ] Walkable: no new collider blocks the 2 m sidewalk lane
- [ ] Verified at day / dusk / night in a screenshot

## Style bar
Match the existing texel density and muted palette. Read the nearest
comparable prop before drawing a new one.

## Verify
PORT=4178 npm run build && npx vite preview --port 4178 &
SHOT_URL=http://localhost:4178/ node scripts/<topic>.mjs
```

---

## 7. The handoff note (builder → desk)

Builders **never** write to `FEATURE-REQUESTS.md`. They write
`street/notes/<branch>.md`, which cannot conflict. The desk folds those into the
log at merge time and deletes the note.

```markdown
## feat/trees — <what changed, in playtest language>
Touched:   props.ts makeTree() 140-190, tex/world.ts treeSprite() 146-167
Verified:  node scripts/trees.mjs -> shots/trees-{day,dusk}.png; walked 8.3 m past, no stop
Risk:      shares the collider array with the hydrant work on feat/props
Left:      crown palette still identical on trees 3 and 7
Base:      e23490f
```

`Touched` with line ranges earns its keep: it is how a conflict gets predicted
rather than discovered.

---

## 7b. Verifying a change didn't move the world

**Screenshots cannot be diffed on this project.** Two runs of *identical* code
differ in ~20% of pixels, for two independent reasons:

1. The sim never stops — the clock advances, citizens walk, cars drive — and
   `__ct.warp()` sets the camera without freezing any of it.
2. `dither()` and 13 other paint sites use **unseeded `Math.random()`**. The
   world's grain is genuinely different on every page load. (Not a bug — but it
   means `seed`/`rnd()` governs almost nothing in the art layer, contrary to
   what the code reads like.)

So verification is **structural**, via `__ct.scene()`:

```bash
node scripts/scenedump.mjs before      # -> shots/before.json
# …make the change, rebuild…
node scripts/scenedump.mjs after
node scripts/fpdiff.mjs shots/before.json shots/after.json
```

`scenedump.mjs` seeds `Math.random` in the harness only, then fingerprints three
things independently: **textures** (FNV-1a over every unique texture's pixels —
this is where all the authored art lives), **structure** (type ∣ geometry ∣
params ∣ material, position-independent), and **places** (sorted rounded
positions). `fpdiff.mjs` compares them as multisets, so you learn *which*
elements moved, not just that a hash changed.

Measured noise floor, two runs of identical code:

| textures (222) | structure (395) | places |
|---|---|---|
| identical | identical | 4–6 differ (the pigeons, sub-5 cm) |

**For a pure refactor, textures and structure must come back identical.** That
is exactly how the Stage 1 split above was proven faithful at each step. For a
feature change, the fingerprint tells you the blast radius — "17 structure
entries changed and nothing else" is a much better review artifact than a
screenshot, and it's what a builder should paste into its handoff note.

`scripts/capture.mjs <label> [port]` + `scripts/shotdiff.mjs` still exist for
screenshots; use them for looking, not for proving.

---

## 8. Merge protocol

Order the queue **largest diff first**, and rebase the rest onto each landing.

```bash
git switch feat/trees
git rebase add-stick-and-city98     # the authoring agent resolves
npm run build && node scripts/bugsweep.mjs
git switch add-stick-and-city98 && git merge --ff-only feat/trees
```

Three rules:

1. **The authoring agent resolves its own conflicts.** It knows which of two
   versions of a texture function was intended; an integrator guessing gets it
   wrong.
2. **Rebase, not merge**, so conflicts arrive one commit at a time rather than
   as one 500-line blob.
3. **Build + sweep between merges, not only at the end.** Worktrees prevent file
   clobbering but not *logical* conflicts — one agent changing `obstacle()`'s
   shape while another adds callers merges clean and renders wrong. A screenshot
   is the only real check for that.

---

## 9. Publishing and the feedback-integrity rules

**One publisher: the desk.** Merge everything, build once,
`node scripts/pack-artifact.mjs` once, publish once, to the existing URL.

**Publish in batches, not per-merge.** Land merges continuously; publish when
there is a coherent set worth a playtest.

Two known ways feedback goes bad here:

- **Stale-build feedback.** This has already happened once on this project — the
  "SEVILLE" note in `FEATURE-REQUESTS.md` referred to a build that no longer
  existed, and sent work after an already-fixed problem. Parallel agents landing
  merges between playtests make it routine. Mitigation: the in-frame commit
  stamp, so "on `e23490f` the lamps look orange" is unambiguous.
- **Habituation.** Longitudinal work on human review of agent code finds
  approval rates rise and scrutiny declines with repeated exposure — reviewers
  normalise to agent output and quietly lower the bar. This project's whole
  value is the bar. Mitigation: keep the screenshot sweep mandatory rather than
  vibes-based, and periodically re-compare against the early rounds' shots (a
  discipline `FEATURE-REQUESTS.md` already committed to under "Working mode").

---

## 10. Scaling rules

- **Start at one** (desk only). Add a builder when there is a genuinely
  independent chunky request *and* the module split has landed.
- **Add a second builder** only if Erick is idle waiting on both.
- **Drop back to one** whenever the unplaytested merge queue exceeds two, or
  when the session is mostly tuning.
- **Never spin up an agent for a request smaller than its brief.** If writing
  the brief takes longer than the change, the desk just does it.

---

## 11. The desk's own failure modes

The desk is the single point of failure and it fails **silently**. Every one of
these happened in one session:

| failure | what it looked like | the rule |
|---|---|---|
| **Stopped merging** | 7 builder commits stranded on branches for an hour, then 13 more. Work reached the user only through the live world, unverified and unbuildable-on. | Merge after *every* builder task. A branch with commits on it is a bug. |
| **Went heads-down building** | Spent a long stretch writing the watch. In that window a builder stalled 42 min with 0 commits, another broke the live world, and nobody noticed. | The desk does not take long IC tasks. Small changes yes; anything needing sustained focus goes to a builder. |
| **Let one builder become a queue** | One agent held ~10 items on one file. That is not a team, it is a serial worker with extra steps. | If a builder's queue exceeds ~2 items, the file needs splitting, not the queue lengthening. |
| **Bookkeeping ate the clock** | 43% of desk commits were logging-only. Every one is latency the user waits through. | Batch the log. Ship first, write it up at a breakpoint. |
| **Edited another builder's file** | Extracted `cat.ts` out of `street.ts` while a builder was in it. Broke the live merge; repairing it corrupted a third worktree. | **File ownership beats speed, even for one-liners.** A queued one-liner costs a minute; a cross-builder conflict costs ten plus a broken world. |

The meta-lesson: **a parallel setup has a coordination job that must run
continuously.** The moment the coordinator starts building, everything stalls
and nothing announces it.

---

## 12. How to give a builder feedback

This turned out to matter more than how briefs are written, because most builder
time is spent on *corrections*, not first drafts.

**Diagnose, don't instruct.** The single highest-leverage habit. Examples that
all paid off:

- *"the l is backwards"* → the real finding was **the whole sign is mirrored**;
  H, O and T are symmetrical so they hide it. Patching the L would have shipped
  a broken E. The instruction became "audit every sign for back-face rendering".
- *red kerb speckle* → not "make it less noisy" but **the kerb face is 1–2
  texels tall; any fine detail on it must alias**. That produced a general rule
  for thin faces instead of a fourth failed attempt.
- *cars turning brown* → not "tune the lighting" but **lerping toward amber
  replaces the colour instead of warming it; multiply the base instead**.
- *"what is this?" (a litter can)* → **it was a billboard**, which always rotates
  to face you, so a side-view can stands on end as a card when you look down.

A builder given a symptom fixes one instance. A builder given the cause fixes
the class and stops reintroducing it.

**Lead with what is approved, quoting the user.** Builders regress liked work
while fixing something adjacent. Every correction should open with the specific
things to protect — *"the user said 'this corner looks so good'; the gutter,
rounded kerb and corner return are landed and approved, do not disturb them"*.

**Two failures, then delete.** If a detail has been redrawn twice and still
misses, remove it. The trash bags took two passes; the red kerb took four
before this rule was applied. Say it in the brief: *"if you cannot make it read
within these rules, delete it and say so in your handoff."*

**Never interrupt mid-task.** Corrections mid-flight reset a builder's context
and stretch a 20-minute job into an hour. Queue them as the next task, and say
explicitly *"finish and commit what you are on first."*

**Verify claims before relaying them.** A user report of *"the neighbour is
still flat"* looked like a builder failure. Reading the code showed the 8-angle
atlas was implemented correctly — he simply stood in a doorway where only one
angle is ever visible. The fix was to move him, not to redo the work.

---

## 13. The integration world

Builders work in isolated worktrees, but the user needs **one** world to play
that shows everything at once, or feedback is always about a stale build.

`scripts/live-integrate.sh` rebuilds a `live` branch every 15s as
*mainline + every worktree's current state*, and `rpg-live` is served on 5177.

Three hazards, all hit for real:

1. **`git stash create` silently ignores untracked files.** A new module a
   builder had written but not committed never reached the live world while
   everything importing it did — "cannot find module". Snapshot through a
   separate `GIT_INDEX_FILE` instead, which captures untracked files without
   touching the worktree's real index, files or branch.
2. **`node_modules/` with a trailing slash does not match a symlink.** The
   per-worktree symlinks leaked into every merge and blocked it. Also: a
   `reset --hard` can delete the live worktree's own symlink, which silently
   breaks the dev server.
3. **One builder mid-edit can break the world.** The integrator now typechecks
   the merged result and, if it fails, rebuilds from base adding worktrees one
   at a time, **dropping whichever one is broken**. The user keeps a working
   world; the broken builder stops appearing until it is green.

Corollary: **`live` is a scratch branch**, rebuilt from scratch each cycle.
Real merges into the mainline still go through rebase + typecheck + build.
Nothing half-finished enters real history.

---

## 14. Working with taste

Most requests here are judgements, not specifications. Three things that helped:

**Comparison rigs beat iteration.** The alley cat took four rounds one-at-a-time
and was still wrong. Rendering **six variants side by side** in one screenshot
resolved it in two. When a request is "make it nicer", build a rig showing N
options at once and let the user point. It is usually cheaper than one more
round trip.

**Parameterise only after the shape is approved.** Once the user picked two
silhouettes out of six, those became templates taking a "coat" description, and
twelve more variants cost one line each. Parameterising *before* approval just
multiplies the wrong thing.

**Keep the machinery after shipping one.** Only one cat shipped, but the
`alert`/`curl` templates and the coat options stayed. Four rounds of iteration
became reusable structure rather than being thrown away.

**Read the request for the constraint underneath it.** *"Steps up to a library"*
plus a 2 m sidewalk with zero setback is a contradiction; the resolution
(recess the entrance into the building mass) is the actual answer and neither
half of the request states it. Finding that is the desk's job, not the
builder's.

---

## 15. Retrospective: what to fix next

Measured after a full day of four agents on one world.

### The contention is the WIRING, not the big files

| file | lines | commits touching it (last 120) |
|---|---:|---:|
| `ct/street.ts` | 1277 | 6 |
| `ct/apartment.ts` | 1054 | 12 |
| **`crosstown.ts`** | **579** | **23** |
| `ct/tex-world.ts` | 507 | 16 |
| `ct/props.ts` | 648 | 15 |

`crosstown.ts` is half the size of `street.ts` and gets touched **four times as
often**. Splitting it further will not help, because it is not big — it is the
*entry point*. Every new prop registers a collider there, every interactive
object registers an `[E]` spot there, every module has its update hook called
there. Any builder adding anything must edit it.

**The fix is a registration pattern, not a split.** Modules should return what
they contribute — colliders, `[E]` spots, update hooks — and the entry point
should *iterate a list* rather than enumerate call sites.

**Interactions are done** (`e22dd99`): `CtxBuild` now carries `spot()` and
`player`, so a module registers its own `[E]` spots and the entry point knows
nothing about any of them. Adding a door touches exactly one file. Verified
structurally identical, and walked, since fingerprints cannot see interactions.
Migrating each module's existing spots out of `crosstown.ts` is queued to the
builder that owns each module.

**Per-frame update hooks are the remaining half.** `apt.updateHermit`,
`props.updateRain`, `props.updatePigeons`, `apt.updateCaps` are still called by
name from the sim loop. Same treatment: `ctx.onFrame(fn)`. Riskier than spots
because ORDER matters — the rain tint must run before the billboard pass — so
it needs an explicit ordering key rather than registration order.

### Splitting that IS still worth doing

`ct/street.ts` at 1277 lines is where one builder accumulated ten queue items.
It has clean seams already marked by its own comment banners:

| new module | current lines | contents |
|---|---|---|
| `ct/street.ts` | 25–217 | rosters, `placeBld`, ordinary shopfronts |
| `ct/landmarks.ts` | 218–638 | civic stone, the library, the church |
| `ct/corner.ts` | 639–1020 | side street, far end, the bodega canted bay |
| `ct/alley.ts` | 1021–end | the alley |

`ct/apartment.ts` at 1054 splits the same way: shell + stairwell, rooms +
hermit, street entrance.

Both splits are worth doing **while the owning builder is idle**, never while it
is mid-task — extracting `cat.ts` out of `street.ts` under a working builder
cost about ten minutes and corrupted a third worktree during the repair.

### Shared leaf modules must be desk-owned

Every hand-resolved conflict traced to the same shape: a builder changed a
shared leaf, callers in other owners' files broke, and the builder made a
"drive-by" edit to somebody else's file to unbreak the tree. That drive-by is
what conflicted — three separate times on `apartment.ts` alone. Two builders
also rewrote `citizens.ts` simultaneously and the merge resolution silently
dropped a feature (`grime`).

`notes/OWNERSHIP.md` now records this, and `scripts/ownership.sh <agent>` checks
it. The rule: **a builder may read a shared module and may add an export, but
changing an existing signature is a desk operation**, done with every caller in
one commit.

### Tooling that came out of this

- **`scripts/land.sh`** — the merge train. Rebases and merges every green
  builder in one pass, typechecking *after each one* so a break is attributed
  rather than discovered. Skips and names anything that conflicts or breaks.
  Refuses to run if mainline is already broken.
- **`scripts/queues.sh`** — every agent's current task, queue depth, and git
  state in one view.
- **`scripts/ownership.sh`** — pre-commit boundary check.
- **`scripts/live-integrate.sh`** — the integration world, now typecheck-gated
  so one broken builder cannot take down the world the user is playing.

### Still open

- The **masonry-density refactor** the seam audit calls for: texture px/m is
  computed per-mesh in isolation, so no two neighbours agree. `walkTex` already
  solves this (world extents in, repeat + offset out) and is the model.
- **Build stamping** — still not done, and stale-build feedback has cost real
  work twice.
- **Publishing** — the artifact and Pages have not been updated in hours.

---

## Sources

- [The Human Review Bottleneck — Codex KB](https://codex.danielvaughan.com/2026/05/24/human-review-bottleneck-code-review-strategies-agent-output/)
- [Habituation at the Gate: Rising Approval and Declining Scrutiny in Human Review of AI Agent Code (arXiv 2606.22721)](https://arxiv.org/pdf/2606.22721)
- [AgenticFlict: A Large-Scale Dataset of Merge Conflicts in AI Coding Agent PRs (arXiv 2604.03551)](https://arxiv.org/pdf/2604.03551)
- [Humans and Agents in Software Engineering Loops — Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/humans-and-agents.html)
- [Embracing the parallel coding agent lifestyle — Simon Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- [How to Run a Multi-Agent Coding Workspace (2026) — Augment Code](https://www.augmentcode.com/guides/how-to-run-a-multi-agent-coding-workspace)
- [When Multi-Agent Is Overkill — Augment Code](https://www.augmentcode.com/guides/when-multi-agent-ai-is-overkill)
- [AI Spec Template: What to Include and Leave Out — Augment Code](https://www.augmentcode.com/guides/ai-spec-template)
- [How to Write a Good Spec for AI Agents — O'Reilly Radar](https://www.oreilly.com/radar/how-to-write-a-good-spec-for-ai-agents/)
- [Claude Code subagents — Anthropic docs](https://docs.anthropic.com/en/docs/claude-code/sdk/subagents)
