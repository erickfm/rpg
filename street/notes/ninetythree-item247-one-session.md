# ninetythree / item 247 — the desk and its builders are ONE session

**RELEASED, not done.** Three of the row's four DONE-WHEN clauses are
unachievable as written, and I can prove why rather than guess. The fourth, and
the two "fold in if cheap" gaps, are landed.

---

## The row was right that the guard refuses the desk. It was wrong that a better fact exists

The row asks: *"FIND A FACT THAT SEPARATES THE DESK FROM A BUILDER AND MEASURE IT
FROM BOTH."*

**There is no such fact on this machine.** Measured 2026-08-03 across every
process on the box (`scripts/probes/w93-item247-sessions.mjs`,
`...-whoisinshared.mjs`, `...-ancestry.mjs`):

| | |
|---|---|
| distinct `CLAUDE_CODE_SESSION_ID` values alive | **1** — `a6835f8b-f14f-4c42-8550-fa7d9870806a` |
| agent processes carrying `CLAUDE_CODE_CHILD_SESSION=1` | **50 of 50** |
| distinct `CLAUDE*`/`AI_AGENT` env signatures | **2**, differing **only** in `CLAUDE_EFFORT` |
| …and the signature *lacking* `CLAUDE_EFFORT` belongs to | **a builder, in a worktree** |
| distinct cwds under that one session | **10** — nine worktrees **and `/home/erick/projects/rpg/street`** |

**The desk and every builder it spawns are the same session and the same OS-level
identity.** `isSubagent()` cannot be repaired by picking a different variable,
because the fact it is testing is not in the environment.

### Every candidate the row named, measured and dead

- **Process ancestry.** Every tool shell's parent is the harness host, **pid
  282161, whose own cwd is `/home/erick/projects/rpg`** — the shared checkout,
  for the desk and for builders alike. And `cd` moves the shell itself: after I
  `cd`'d into the shared tree, my *entire* ancestry read
  `/home/erick/projects/rpg/street`. There is no trace of where I started.
- **A variable the desk sets for itself at session start.** Inherited by every
  builder shell, because builders are children of that same session. Setting it
  in `.claude/settings.*` is worse: `.claude/worktrees/` sits *inside* the main
  checkout's `.claude/`, so a project-level `env` is an ancestor of every
  builder's cwd.
- **A claimed queue row naming the caller.** The guard runs *inside* `npm run
  build`. It has no name to check and no way to tie a pid to a claim.

### Why item 243's author got the opposite answer, honestly

The header's table read **`/proc/262802/environ`** (the human's `claude
--dangerously-skip-permissions -r`) and **`/proc/282161/environ`** (the harness
host). Both genuinely lack the variables. **Neither is a shell that runs a tool
command.** A Bash tool call does not execute in the session process — the
harness *spawns a shell* and injects the agent variables into it. The two pids
were read correctly and answer a question nobody asked. That is the whole
mistake, and it is the same shape as item 246's probes: **an instrument aimed at
the wrong subject reports confidently.**

---

## What I landed

1. **The false table is gone** from `scripts/lib/shared-checkout.mjs`, replaced
   with the measurement and with a plain statement that `isSubagent()` cannot
   separate the two. `isSubagent`'s own docstring corrected: what it honestly
   answers is *"is this running under Claude Code at all"*.
2. **The selftest told the same lie and now does not.** Two assertions were
   labelled *"the desk"* and were passing an **empty environment** — a shell
   that does not exist on this box. Relabelled as *the human at a bare
   terminal*, which is a real and worth-guarding case, and **two new assertions
   pin what the REAL desk environment does**: it reads as an agent, and it is
   refused in main. They assert the current *broken* truth on purpose, with a
   comment saying so, **so whoever fixes item 247 gets a red from exactly the
   right line.** Floor 21 → 23. **23/23 pass. The guard itself is untouched and
   not weakened**, as the row required.
3. **BUILDER-BRIEF §0 now names the guard** — what it hooks, that it fails open,
   that you should never see it, that `CT_ALLOW_SHARED=1` is the desk's and not
   yours, and the defect.
4. **The `npx vite` bypass is written down** in both §0 and the lib header: the
   guard hangs off four `package.json` scripts, and `npx vite --port N` or any
   bare `node scripts/*.mjs` goes round it. Nothing in that file can close it.

## Verified, from real shells

| | |
|---|---|
| builder shell, **shared checkout** | `exit 1`, refused |
| builder shell, **own worktree** | `exit 0` |
| builder shell, shared checkout, `CT_ALLOW_SHARED=1` | `exit 0` |
| `w94-guard-selftest.mjs` | **23 passed, 0 failed, floor 23** |

---

## WHY IT IS RELEASED

The row's DONE WHEN: *"the desk runs `npm run build` in the shared tree without
an escape hatch, a spawned builder is still refused, both are demonstrated from
real shells."*

**Those first two clauses are mutually exclusive given the measurement.** The
desk's shell and a wandering builder's shell are environmentally identical, so
any test that admits one admits the other. And the third clause is not something
a builder can do at all: I cannot run a command in the desk's shell, and if I
could, it would produce my own output.

**I am not going to satisfy it by weakening the guard**, which is the only way
to make it pass and is what the row forbids in bold.

## THE DECISION THE DESK HAS TO MAKE — two sound options, neither invented here

1. **Keep `CT_ALLOW_SHARED`, but per SESSION rather than per command.** The row's
   objection is *"an escape hatch the desk must remember every time"*. `export
   CT_ALLOW_SHARED=1` once at the top of a desk session costs one line and the
   guard keeps full strength against builders — who are refused by the same
   mechanism because they will not have exported it. **This is a real
   improvement over today and costs nothing.** Its weakness is honest: a builder
   that reads the desk's habit could export it too, and the guard has always
   been a seatbelt rather than a lock.
2. **Change the question from WHO to WHETHER THE ACT IS DESTRUCTIVE NOW.**
   `vite build` empties `dist/` — the actual harm in the incident the guard was
   written for was blinding a preview somebody else owned. That is *measurable*
   and does not need identity: refuse when another process is serving this
   tree's `dist/`. It would let the desk republish the artifact whenever nothing
   is watching, and refuse anyone — desk included — when something is. **This is
   a design change and I am not making it unasked.**

## FOUND AND NOT FIXED

- **`npm run dev` / `vite --port 5177` is running right now in
  `/home/erick/projects/rpg/street` carrying `CLAUDE_CODE_CHILD_SESSION=1` and
  `AI_AGENT=..._agent`** (pids 370039 / 370051 / 370052). That is the user's
  live integration world. `npm run dev` **is** guarded (`"dev": "npm run guard
  … && vite --port 5177"`), and it is running in the **main checkout**, from a
  shell the guard classifies as a subagent — so it survives only because it was
  started before the guard landed. **The next restart of the user's 5177 world
  will be refused unless `CT_ALLOW_SHARED=1` is set.** That is the first place
  this defect will actually bite a human.
  *(Checked and NOT a problem: `scripts/live-integrate.sh` works in
  `$ROOT/rpg-live`, a separate worktree, and only calls `npx tsc`. I had this
  wrong in a first draft and the shell script says otherwise.)*
- `/home/erick/.claude/jobs/pins.json` exists and is `[]`. If Claude Code ever
  populates it with per-agent worktree pins, that would be the fact this whole
  item wanted. It is empty today.
