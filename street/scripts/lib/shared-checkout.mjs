// Is this command about to mutate THE SHARED CHECKOUT, run by an agent that
// belongs in a worktree somewhere else?
//
// ── WHY THIS EXISTS (item 243) ────────────────────────────────────────────────
// Four workers in one day ran commands against `/home/erick/projects/rpg/street`
// while believing they were in their own worktree. GOTCHAS 54 and 84 both warn
// about it in bold, BUILDER-BRIEF §0 tells every builder to check, and the desk
// repeats it in every spawn prompt. It kept happening anyway. The worst instance
// ran `npm install` AND `npm run build` there, rebuilding the shared `dist/` and
// killing a preview it did not own.
//
// Writing it down has been tried. This is the mechanism.
//
// ── WHAT THE HARNESS ALREADY COVERS, AND WHAT IT DOES NOT ────────────────────
// Re-measured 2026-08-03 by worker ninetyseven, from inside an isolated worktree
// agent. The Claude Code worktree-isolation guard refuses this:
//
//     cd /home/erick/projects/rpg/street && git rev-parse --show-toplevel
//     -> "Refusing to run it - a worktree-isolated agent's git operations
//         must target its own worktree."
//
// and allows this:
//
//     cd /home/erick/projects/rpg/street && ls -d node_modules
//     -> node_modules            (ran, no complaint -- re-confirmed 2026-08-03)
//
// **The isolation guard is git-only.** `npm install`, `npm run build`, `vite`
// and every `node scripts/*.mjs` run in the shared checkout unopposed. That gap
// is exactly the hole all four incidents went through, and it is what this
// module closes.
//
// ══════════════════════════════════════════════════════════════════════════════
// ── ⚠ THE ENVIRONMENT CANNOT TELL THE DESK FROM A BUILDER. MEASURED. ─────────
// ══════════════════════════════════════════════════════════════════════════════
//
// The first version of this file refused on `CLAUDE_CODE_CHILD_SESSION=1`,
// corroborated by `AI_AGENT` ending `_agent`, on the strength of reading
// `/proc/<pid>/environ` for pids 262802 and 282161 and finding neither variable.
// **It refused the desk**, which is what item 247 is. Here is why, measured
// (worker ninetyseven, 2026-08-03):
//
// Those two pids are the WRONG PROCESSES. The variables are injected by the
// Bash tool into the shell it spawns; they are not on the `claude` process. To
// sample the desk's SHELL you have to find a process the desk's shell started
// and read ITS environ. There is one, and it is long-lived: the live world on
// :5177, which CLAUDE.md makes the desk's own job.
//
//     pid 370039  `npm run dev`, cwd /home/erick/projects/rpg/street
//                 -- started from the DESK's shell, so it carries the desk's env
//     pid 4125211 this builder's shell
//
// Diffed in full, 65 variables each. The ONLY differences:
//
//     _        /home/erick/.nvm/.../npm        vs  /usr/bin/env
//     OLDPWD   /home/erick/projects/rpg        vs  /home/erick/projects
//     PWD      .../rpg/street                  vs  .../worktrees/agent-aae82...
//     SHLVL    1                               vs  2
//
// Four bash intrinsics, all a function of WHERE the shell stands, none of WHO
// is running. Every CLAUDE_* variable is byte-identical, including:
//
//     CLAUDE_CODE_CHILD_SESSION=1          <- on the DESK's shell too
//     AI_AGENT=claude-code_2-1-220_agent   <- on the DESK's shell too
//     CLAUDE_PID=282161                    <- the SAME host process
//     CLAUDE_CODE_SESSION_ID=a6835f8b-...  <- the SAME session
//
// And process ancestry -- item 247's other candidate -- is falsified the same
// way. This builder's shell is pid 4125211, ppid **282161**; the desk's shell is
// also a direct child of 282161. They are SIBLINGS, not ancestor and descendant:
//
//     4125211 bash      <- 282161 (the claude host)  <- 282115 <- 282080
//             ^ builder      ^ ALSO the desk's shell's parent
//
// The desk is not pid 262802 (that is the outer interactive `claude -r`). The
// desk is the background session 282161 — `$CLAUDE_JOB_DIR/state.json` lists
// this very worker in its `fan` array — and a spawned builder is a TASK INSIDE
// THAT SAME PROCESS. It inherits one environment block.
//
// **So no environment variable and no ancestry test can ever separate them, and
// none should be added back.** That also kills item 247's third candidate, "a
// variable the desk sets for itself at session start": Bash-tool shell state
// does not persist between calls, so it would have to be re-set every time —
// which is the escape hatch we are removing.
//
// ── THE FACT THAT DOES SEPARATE THEM: WHERE THE SHELL WAS STANDING ───────────
// A spawned builder is worktree-isolated, and **the harness resets its cwd to
// its own worktree before every single Bash call.** So when a builder reaches
// the shared checkout it must travel, and the trip leaves a trace in its own
// process:
//
//     cd /home/erick/projects/rpg/street && npm run build
//     -> OLDPWD=/home/erick/projects/rpg/.claude/worktrees/agent-aae8230d8559acc5d
//
// Measured, and measured to SURVIVE the hop into npm and node (`npm exec` was
// used to confirm the variable is exported, not shell-local). The desk's shell
// is not reset and does not live in a worktree, so its OLDPWD is the repo root:
// `/home/erick/projects/rpg`, as sampled above from the real :5177 process.
//
// A second, independent witness for the same fact, which catches the shape that
// never cds at all (`npm --prefix /home/erick/projects/rpg/street run build`):
// **the ancestor processes' own cwds**, read from /proc. In that shape the
// builder's shell is still standing in its worktree while npm builds the shared
// one.
//
// Both witnesses answer one question -- *did this caller come out of an agent
// worktree?* -- and a path only counts when it is under `<repo>/.claude/
// worktrees/`, exists, and (when git can be asked) is a REGISTERED worktree.
//
// ── WHAT THIS DELIBERATELY DOES NOT CATCH, SO NOBODY THINKS IT DOES ──────────
// **A spawned agent that was never given a worktree at all** — worker
// seventythree, the incident in GOTCHAS 84 — is indistinguishable from the desk
// by every fact available in this process. It has no worktree to have come from,
// the same env, the same parent. This guard cannot see it and neither can any
// other guard that runs here. That case is fixed at spawn time (give every
// builder `isolation: "worktree"`), not here.
//
// ── FAIL OPEN, ALWAYS ────────────────────────────────────────────────────────
// This runs from `preinstall`, so a bug here would brick `npm install` for every
// builder following BUILDER-BRIEF §0 -- the single most-run command on the
// project. Every uncertain answer is therefore ALLOW. We refuse only on a
// positive determination of all three facts, and `treeKind` returns 'unknown'
// rather than guessing when git is unavailable, when there is no repo, or when
// the command fails for any reason at all.
//
// All of it is demonstrated by `scripts/probes/w94-guard-selftest.mjs`, which
// builds a real throwaway repo with a real linked worktree in a temp dir, runs
// the real classifier and the real CLI in each, and drives the desk case with
// **the 65-variable environment captured from the desk's own live shell** rather
// than with an invented empty object. (The old self-test asserted
// `isSubagent({}) === false, 'the desk (no vars at all) is NOT an agent'` — it
// passed by asserting the model instead of the world, and the model was wrong.)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';

/** The env var that opts out. Retained as a LAST RESORT only -- the desk should
 *  no longer need it, and item 247 is the record of what happens when it does:
 *  an escape hatch the desk must remember every time is a guard that eventually
 *  gets disabled wholesale. */
export const OVERRIDE = 'CT_ALLOW_SHARED';

/** Where isolated agent worktrees live, relative to the repo toplevel. */
export const WORKTREE_DIR = '.claude/worktrees';

const resolve = (p) => { try { return realpathSync(p); } catch { return p; } };

/**
 * 'main'     -- the shared checkout every worktree hangs off
 * 'worktree' -- a linked worktree (`git worktree add`), where builders live
 * 'unknown'  -- no git, no repo, or the command failed. Callers must ALLOW.
 *
 * The test is `--git-dir` against `--git-common-dir`, which is the canonical
 * one: in the main checkout both are `<top>/.git`; in a linked worktree the
 * former is `<main>/.git/worktrees/<name>` and only the latter is `<main>/.git`.
 * Measured in this very worktree:
 *
 *   git-dir:        /home/erick/projects/rpg/.git/worktrees/agent-aae8230d8559acc5d
 *   git-common-dir: /home/erick/projects/rpg/.git
 *
 * Item 243 suggested comparing `--show-toplevel` with `--git-common-dir`
 * instead. That works too, but only because `.git` normally sits directly under
 * the toplevel -- it is a fact about layout, where this is a fact about git's
 * own model. Both are computed here so the caller can name the tree in its
 * error message.
 */
export function treeKind(cwd = process.cwd()) {
  let gitDir, commonDir, top;
  try {
    const out = execFileSync(
      'git', ['rev-parse', '--git-dir', '--git-common-dir', '--show-toplevel'],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).split('\n').map((s) => s.trim()).filter(Boolean);
    if (out.length !== 3) return { kind: 'unknown', top: null };
    [gitDir, commonDir, top] = out;
  } catch {
    return { kind: 'unknown', top: null };            // fail open
  }
  const abs = (p) => resolve(p.startsWith('/') ? p : `${cwd}/${p}`);
  return { kind: abs(gitDir) === abs(commonDir) ? 'main' : 'worktree', top: resolve(top) };
}

/**
 * Is the caller a Claude Code tool shell at all (as opposed to the human at a
 * terminal, or CI)?
 *
 * THIS IS NOT AN AGENT TEST. It was called `isSubagent` and used as one, and
 * that is precisely the bug item 247 records: the desk's shell carries these
 * variables too, byte for byte (see this file's header). It survives only as a
 * NECESSARY condition -- it keeps the guard off the user's own terminal -- and
 * is never sufficient on its own.
 */
export function isClaudeShell(env = process.env) {
  if (env[OVERRIDE]) return false;                    // explicit opt-out wins
  if (env.CLAUDE_CODE_CHILD_SESSION === '1') return true;
  return /_agent$/.test(env.AI_AGENT || '');
}

/** Read a process's cwd. Linux /proc only; anything else is simply no witness. */
function procCwd(pid) {
  try { return realpathSync(readlinkSync(`/proc/${pid}/cwd`)); } catch { return null; }
}

/** Parent pid from /proc/<pid>/stat, parsed after the last ')' so a comm
 *  containing spaces or brackets cannot shift the fields. */
function procPpid(pid) {
  try {
    const st = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const rest = st.slice(st.lastIndexOf(')') + 2).split(' ');
    const ppid = Number(rest[1]);
    return Number.isFinite(ppid) && ppid > 1 ? ppid : null;
  } catch { return null; }
}

/** The cwds of this process and its ancestors, nearest first, depth-capped. */
function ancestorCwds(pid = process.pid, depth = 6) {
  const out = [];
  let p = pid;
  for (let i = 0; i < depth && p; i++) {
    const c = procCwd(p);
    if (c) out.push(c);
    p = procPpid(p);
  }
  return out;
}

/** Every worktree git currently has registered, as absolute real paths.
 *  Returns null (not []) when git could not be asked, so callers can tell
 *  "no worktrees" from "no answer". */
function registeredWorktrees(cwd) {
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n')
      .filter((l) => l.startsWith('worktree '))
      .map((l) => resolve(l.slice('worktree '.length).trim()));
  } catch { return null; }
}

/**
 * Did this caller come out of an isolated agent worktree?
 *
 * Returns the worktree path, or null. Null means "cannot show that it did",
 * which every caller must treat as ALLOW -- the desk lands here, and so does a
 * spawned agent that was never given a worktree (see the header: that case is
 * not detectable from inside this process by any means).
 *
 * Witnesses, both answering the same question, neither retyped from the other:
 *   1. OLDPWD -- where the shell stood one `cd` ago. An agent's cwd is reset to
 *      its worktree before every Bash call, so travelling to the shared tree
 *      always leaves the worktree here.
 *   2. the cwds of this process and its ancestors -- catches the shape that
 *      never cds (`npm --prefix <shared> run build`), where the agent's shell is
 *      still standing in its worktree.
 *
 * A candidate counts only when it is under `<top>/.claude/worktrees/`, exists on
 * disk, and -- when git can be asked -- is a worktree git actually knows about.
 */
export function worktreeProvenance({ env = process.env, top, pid = process.pid } = {}) {
  if (!top) return null;
  const base = resolve(`${top}/${WORKTREE_DIR}`);
  const registry = registeredWorktrees(top);

  const candidates = [env.OLDPWD, ...ancestorCwds(pid)].filter(Boolean).map(resolve);
  for (const c of candidates) {
    if (c !== base && !c.startsWith(`${base}/`)) continue;   // not an agent worktree path
    if (!existsSync(c)) continue;                            // stale string, no such tree
    // Corroborate with git when it answered: the candidate must be at or under
    // some registered worktree. If git could not be asked we still accept the
    // path shape -- `<repo>/.claude/worktrees/...` is unambiguous by construction.
    if (registry && !registry.some((w) => c === w || c.startsWith(`${w}/`))) continue;
    return c;
  }
  return null;
}

/**
 * The whole decision, as a pure function of three facts, so the truth table can
 * be tested without spawning agents or vandalising the shared tree.
 *
 * Returns `null` to allow, or a string to print and die with.
 */
export function verdict({ kind, claudeShell, provenance, top, what }) {
  if (kind !== 'main') return null;          // a worktree, or git said nothing
  if (!claudeShell) return null;             // the human's own terminal, or CI
  if (!provenance) return null;              // cannot show it owns a worktree -> the desk
  return [
    '',
    `  REFUSED: ${what} in THE SHARED CHECKOUT.`,
    '',
    `  This is the main checkout, not a worktree:`,
    `      ${top || '(unknown)'}`,
    `  and you came here from your own worktree:`,
    `      ${provenance}`,
    '',
    '  This is the tree the desk commits from and the tree the user plays.',
    '  Four workers have done this by accident; one rebuilt the shared dist/',
    '  and killed a preview it did not own. (GOTCHAS 54, 84; queue items 243, 247.)',
    '',
    '  FIX: go back to YOUR OWN worktree and run it there.',
    `      cd ${provenance}/street`,
    '  Confirm with `git rev-parse --show-toplevel` before you re-run.',
    '',
    `  If you really do mean the shared tree, set ${OVERRIDE}=1 and say so in`,
    '  your handoff -- it is not a normal thing for an agent to want.',
    '',
  ].join('\n');
}

/** Everything above, wired together, for the CLI and for vite.config.ts.
 *  Never throws: every failure path is ALLOW. */
export function checkHere(what = 'this command', cwd = process.cwd(), env = process.env) {
  try {
    const { kind, top } = treeKind(cwd);
    if (kind !== 'main') return null;                     // cheap exit, no /proc walk
    const claudeShell = isClaudeShell(env);
    if (!claudeShell) return null;
    const provenance = worktreeProvenance({ env, top });
    return verdict({ kind, claudeShell, provenance, top, what });
  } catch {
    return null;                                          // fail open, always
  }
}
