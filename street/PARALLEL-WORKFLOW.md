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

- [ ] **Make the preview port env-driven.** One line per script:
      `const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';`
      Then each agent gets its own port: 4177 desk, 4178 builder A, 4179 B.
- [ ] **Create `street/notes/`** for handoff notes (§7).
- [ ] **Stamp the build.** Render the short commit sha somewhere in-frame so
      playtest feedback can be tied to a specific build (§8).

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
