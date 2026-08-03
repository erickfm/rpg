# item 243 — guarding the shared checkout

Worker ninetyfour, 2026-08-03. Full write-up lives in **GOTCHAS 84**, where the
next reader will actually look; this note is the handoff summary and the things
that did not fit there.

## What shipped

| file | role |
|---|---|
| `scripts/lib/shared-checkout.mjs` | `treeKind()`, `isSubagent()`, `verdict()` — the decision, as pure functions |
| `scripts/guard-shared-checkout.mjs` | the CLI the npm scripts call |
| `scripts/probes/w94-guard-selftest.mjs` | 21 assertions over a real `git init` + `git worktree add` |
| `package.json` | wired at `preinstall`, `build`, `dev`, `live` |
| `notes/GOTCHAS.md` §84 | now points at the guard, per the item's DONE WHEN |

## The one thing worth re-reading: I measured the hole before building

The harness's own worktree-isolation guard is **git-only**. From inside this
isolated worktree:

```
cd /home/erick/projects/rpg/street && git rev-parse --show-toplevel
  -> "Refusing to run it - a worktree-isolated agent's git operations ..."
cd /home/erick/projects/rpg/street && ls -d node_modules
  -> node_modules            (ran, no complaint)
```

So every `npm`, `node` and `vite` invocation walked straight through. That is the
gap all four incidents used, and it is now closed for the four commands that
mutate or serve.

## What I chose for the trigger, and why (the item asked to be told)

Two facts, ANDed — main checkout **and** spawned agent. One fact alone is wrong:
the desk builds and installs in the shared tree all session, and item 243 forbids
breaking it.

**The agent test needed no plumbing.** The item guessed at "an env var set in
builder worktrees, or a marker file". A marker file cannot work — it would live
in the worktree, and the mistaken command runs in the *shared* tree, where
nothing looks for it. An env var is right, and one already exists. Read from
`/proc/<pid>/environ` of the live processes:

| process | `CLAUDE_CODE_CHILD_SESSION` | `AI_AGENT` |
|---|---|---|
| desk, pid 262802, cwd `/home/erick/projects/rpg` | absent | absent |
| harness host, pid 282161 | absent | `..._harness` |
| this builder | `1` | `..._agent` |

The load-bearing property is that env vars are **inherited by every child
process** — the flag reaches `npm`, `node`, `vite`, and it travels with the agent
at the exact moment it `cd`s into the shared tree.

## What I rejected, and why — this one nearly bit me

My first instinct for "is an agent running" was to look for
`.claude/worktrees/agent-*`. **Measured before trusting it: 45 such directories
exist and `git worktree list` reports 40 registered worktrees, nearly all dead.**
Their presence says nothing about whether anybody is running. Had I used it, the
guard would have fired permanently, including at the desk — the exact failure the
item warns about in bold.

The queue's own `DOING` rows are a far better liveness signal (5 at the time of
writing) and would have worked, but they still cannot distinguish *which* actor
is at the keyboard. The env var can, so neither was needed.

## Proof, both signs, against the real trees

No `npm` was ever run in the shared checkout — the guard CLI is read-only, so the
negative case was demonstrated without doing the harm it prevents.

| case | result |
|---|---|
| agent + real shared checkout | **exit 1**, message names the tree, the fix and the gotcha |
| agent + own worktree | `npm install` exit 0, `npm run build` exit 0 |
| desk (env cleared) + real shared checkout | **exit 0**, unaffected |
| agent + `CT_ALLOW_SHARED=1` | exit 0 |

`w94-guard-selftest.mjs`: **21 passed, 0 failed, 21 run** behind a population
floor. **Watched failing under two mutations** — `isSubagent` hard-wired false
(3 red) and `treeKind` hard-wired `'main'` (2 red), both exit 1. A guard nobody
has seen fire is indistinguishable from one that is broken.

## Fails open, deliberately

`preinstall` is the command BUILDER-BRIEF §0 tells *every* builder to run, so a
bug here would brick the project. No git, no repo, any thrown error → **ALLOW**.
It refuses only on a positive determination of both facts.

## Verification inherited and run

- `npm run build` (includes `tsc --noEmit`) — **exit 0**
- `node scripts/health.mjs` — **exit 0, WORLD OK**, on the built bundle at `c6e89ed32`, port **4507**
- `npm run sweep` — **96 shots, 0 STATION MISS, 0 COVERAGE, no console errors**

Inherited warnings, unchanged by this item and NOT mine: the `[interior:hotel]
NO BUILDING NAME` DoorDecl warning, repeated `Canvas2D getImageData
willReadFrequently` notices, `THREE.Clock` deprecation, and WebGL `GPU stall due
to ReadPixels` driver messages.

**`health.mjs` exit 3 caught me once and was right**: I built before committing,
so `dist/` carried `8b6d3f17b+` while HEAD was `c6e89ed32`. `which-world.mjs`
refused to measure rather than reporting a green it had not earned. Rebuild,
re-run, green. Exactly the behaviour GOTCHAS 32 asks for.

## Found and NOT fixed — for the desk to queue

1. **`package-lock.json` gained `"hasInstallScript": true`.** Unavoidable once
   `preinstall` exists, and it is committed. If a future worker sees that line
   appear as an unexplained diff, this is why.
2. **The read-only measurement scripts are still unguarded** — `sweep`, `fp`,
   `checks`, `capture` and ~790 others will happily run in the shared checkout.
   That is a deliberate scope choice, not an oversight: their failure mode is
   *reading the wrong world*, which `scripts/lib/which-world.mjs` already owns
   (GOTCHAS 26, 48), and doubling up would blunt both messages. If the desk wants
   them covered too, that is a separate row.
3. **`npm install` is guarded; a bare `npx vite` is not.** Several workers start
   servers with `npx vite --port NNNN` rather than an npm script, which bypasses
   `package.json` entirely. Covering that needs a different mechanism (a shell
   wrapper, or a `.npmrc`/hook) and I did not attempt it.
4. **BUILDER-BRIEF §0 still describes only the manual check.** One line pointing
   at the guard would close the loop, but §0 is not a file this item names, so I
   left it alone (BUILDER-BRIEF §9).
