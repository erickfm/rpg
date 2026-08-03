# ninetyseven / item 247 — the fact is not WHO you are, it is WHERE YOU STOOD

**DONE.** The desk is no longer refused, a spawned builder still is, and both
were demonstrated from real shells standing in the real shared checkout.

Worker ninetythree released this item as unachievable and its measurement was
**right about every candidate the row named**. It missed one fact, and this note
is mostly about that fact.

---

## The row's diagnosis was correct, and so was ninetythree's refutation

The desk and every builder it spawns are **one session, one process, one
environment**. I re-derived it independently before reading ninetythree's note:

| | |
|---|---|
| the desk's shell, sampled from | **pid 370039** — `npm run dev`, cwd `/home/erick/projects/rpg/street`, the process serving the user's live :5177 world. Started *from the desk's own shell*, so it carries the desk's env |
| a builder's shell | pid 4125211, this worker |
| variables in each | **65 and 65** |
| differences, in full | **`_`, `OLDPWD`, `PWD`, `SHLVL`** — four bash intrinsics |
| `CLAUDE_CODE_CHILD_SESSION` | `1` on **both** |
| `AI_AGENT` | `claude-code_2-1-220_agent` on **both** |
| `CLAUDE_PID` | **282161 on both** — the same host process |
| `CLAUDE_CODE_SESSION_ID` | `a6835f8b-…` on both |

**Ancestry dies the same way.** My shell is ppid **282161**; the desk's shell is
also a direct child of 282161. They are **siblings, not ancestor and
descendant** — so "a builder is a descendant of the desk" is false. The desk is
*not* pid 262802 (that is the outer interactive `claude -r`); it is the
background session 282161, and `$CLAUDE_JOB_DIR/state.json` lists this very
worker in its `fan` array, which is how I confirmed it.

**Why item 243's author got the opposite answer, and it was honest.** They read
`/proc/262802/environ` and `/proc/282161/environ`. Both genuinely lack the
variables — because **the variables are injected into the shell the Bash tool
spawns, never onto the `claude` process itself.** Two pids read correctly,
answering a question nobody asked. To sample the desk's *shell* you must find
something the desk's shell *started*, which is why :5177 is the right witness.

---

## The one fact they both missed

ninetythree's note says:

> *"And `cd` moves the shell itself: after I `cd`'d into the shared tree, my
> entire ancestry read `/home/erick/projects/rpg/street`. **There is no trace of
> where I started.**"*

The ancestry half is exactly right — I measured the same thing. **The last
sentence is not.** `cd` leaves the trace in the shell's own environment:

```
cd /home/erick/projects/rpg/street && npm run build
  -> OLDPWD=/home/erick/projects/rpg/.claude/worktrees/agent-aae8230d8559acc5d
```

**`OLDPWD` is where you were one `cd` ago, and it is exported**, so it survives
into `npm` and into `node`. Confirmed two ways: `npm exec` and `npm run env`
both show it in the script environment, which is the path `npm run build`
actually takes to reach the guard.

**Why this is a fact about builders and not a coincidence.** The harness
**resets an agent's cwd to its own worktree before every single Bash call.** So a
builder that reaches the shared checkout *had to travel*, and the trip is
recorded. The desk's shell is not reset and does not live in a worktree — its
OLDPWD is the repo root, `/home/erick/projects/rpg`, exactly as sampled from the
real :5177 process.

A **second, independent witness** for the same question covers the shape that
never `cd`s at all — `npm --prefix /home/erick/projects/rpg/street run build` —
where the builder's shell is still standing in its worktree while npm builds the
shared one: **the ancestor processes' own cwds**, read from `/proc`.

A candidate path counts only when it is under `<top>/.claude/worktrees/`,
**exists on disk**, and (when git can be asked) is a worktree git actually lists.

---

## What changed

| file | what |
|---|---|
| `scripts/lib/shared-checkout.mjs` | `isSubagent` → **`isClaudeShell`** (necessary, never sufficient — it matches the desk exactly, and the rename says so). New **`worktreeProvenance()`** and **`checkHere()`**. `verdict()` now takes three facts. `treeKind()` unchanged — it was always correct |
| `scripts/guard-shared-checkout.mjs` | thin front end over `checkHere` |
| `vite.config.ts` | **closes the `npx vite` bypass** the row named. Vite reads its config for dev, build *and* preview, so one hook covers all three |
| `scripts/probes/w94-guard-selftest.mjs` | 23 → **30 assertions**, floor 29 |
| `notes/BUILDER-BRIEF.md` §0 | names the guard, shows the refusal, states what it cannot cover |
| `notes/GOTCHAS.md` 84 | the env-var trigger paragraph **retracted in place**, with the numbers, so nobody rebuilds it |

## Verified — the step item 243 missed

Both roles run **from real shells, cwd `/home/erick/projects/rpg/street`**, via
`scripts/probes/w97-guard-both-shells.sh`. Exit codes are from the command, not
after a pipe.

| | |
|---|---|
| this spawned builder, untouched env | **exit 1, REFUSED** — and the message names its worktree |
| the desk (`OLDPWD=/home/erick/projects/rpg`, the real value) | **exit 0, allowed** |
| builder in its own worktree | exit 0 |
| builder + `CT_ALLOW_SHARED=1` | exit 0 |
| `npm install` in a worktree (the `preinstall` path) | exit 0 |
| `npm run build` in a worktree, post-merge | exit 0, `tsc --noEmit` clean |
| `w94-guard-selftest.mjs` | **30 passed, 0 failed, floor 29 — 5 runs, no spread** |
| `node scripts/health.mjs` on the built bundle, :4552 | exit 0, `WORLD OK` |
| `npm run sweep` on the built bundle | 96 shots, **0 STATION MISS, 0 COVERAGE** |

**I could not literally run `npm run build` in the shared tree as the desk** —
that is the one thing a builder must not do, and doing it would have rebuilt the
tree the user plays. What I ran is the **gate** that was blocking it, from that
directory, with the desk's real environment: it now exits 0, and `build` is
`npm run guard … && tsc --noEmit && vite build`, so the guard no longer stops it.

## Both signs, watched red — and the first attempt at it was vacuous

Two things went red before they went green, and neither was luck:

1. **The self-test's subdirectory assertion failed on the first run** because the
   temp worktree had no `street/` directory — proving `existsSync` is really
   enforced rather than decorative. Fixture fixed, not the check.
2. **The first mutation used to prove the vite hook can fire did not fire.**
   Forcing `kind` alone still allowed the build, because provenance is `null` in
   a worktree *and* `checkHere` short-circuits before the decision. It took
   mutating the short-circuit **and** the provenance to watch `npx vite build`
   exit 1 and never build. Had I stopped at the first mutation I would have
   reported a red-check that was never red.

**And my own probe lied first.** `w97-guard-both-shells.sh` originally `cd`-ed
into the shared tree *itself*, and reported **the desk REFUSED** — because the
outer shell was still standing in my worktree, so the ancestor-cwd witness fired
correctly on a fake desk. The caller must `cd` in the *real* shell. The probe now
refuses to be run any other way and says why.

---

## FOUND AND NOT FIXED

- **The guard cannot see an agent spawned with no worktree at all** — worker
  seventythree, the original GOTCHAS 84 incident. It has no worktree to have come
  from and is identical to the desk in every fact available inside the process.
  **This is a spawn-time fix** (`isolation: "worktree"` on every builder), not a
  guard fix. Stated in the lib header, GOTCHAS 84 and BUILDER-BRIEF §0 so nobody
  assumes coverage that is not there.
- **A double `cd` evades the OLDPWD witness** — `cd /home/erick/projects/rpg &&
  cd street && npm run build` leaves OLDPWD at the repo root. The ancestor-cwd
  witness does not cover it either, because the shell has moved. Cheap to make
  worse by trying to be clever; I left it, because the guard is a seatbelt and
  the shape is not one anybody types by accident.
- **The desk sitting *inside* a worktree and then `cd`-ing to the shared tree
  would be refused** — its OLDPWD would be a worktree. Plausible, since the desk
  inspects builder worktrees. If it happens the desk gets a clear message naming
  the worktree, and `CT_ALLOW_SHARED=1` still works. Worth watching.
- ninetythree's live finding stands and is now **resolved by this change**: the
  user's :5177 world was going to be refused on its next restart. The desk starts
  it with `cd street && npm run dev` from the repo root, so OLDPWD is the repo
  root and it is allowed.
- `/home/erick/.claude/jobs/pins.json` is still `[]` (ninetythree's note). If the
  harness ever populates it with per-agent worktree pins, that is a cleaner
  witness than OLDPWD and this file should switch to it.

## Derived or copied?

`WORKTREE_DIR` (`.claude/worktrees`) is **declared once** in
`scripts/lib/shared-checkout.mjs` and **imported** by the self-test, which builds
its temp fixture from it — so the fixture cannot drift from the thing it tests.
The `DESK_ENV` constant in the self-test is **transcribed** from
`/proc/370039/environ` and says so at the line; it is evidence, not a value the
code owns, and there is nothing to import it from.
