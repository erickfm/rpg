// Is this command about to mutate THE SHARED CHECKOUT, run by an agent that
// believes it is somewhere else?
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
// Measured 2026-08-03 from inside an isolated worktree agent. The Claude Code
// worktree-isolation guard refuses this:
//
//     cd /home/erick/projects/rpg/street && git rev-parse --show-toplevel
//     -> "Refusing to run it - a worktree-isolated agent's git operations
//         must target its own worktree."
//
// and allows this:
//
//     cd /home/erick/projects/rpg/street && ls -d node_modules
//     -> node_modules            (ran, no complaint)
//
// **The isolation guard is git-only.** `npm install`, `npm run build`, `vite`
// and every `node scripts/*.mjs` run in the shared checkout unopposed. That gap
// is exactly the hole all four incidents went through, and it is what this
// module closes.
//
// ── THE TWO QUESTIONS, AND WHY BOTH ARE NEEDED ───────────────────────────────
// The desk legitimately builds, installs, lands and archives from the shared
// tree all session (CLAUDE.md: "Republish the artifact with `cd street && npm
// run build`"). So "am I in the shared checkout" ALONE is the wrong trigger --
// a blanket refusal breaks the desk, which item 243 forbids in bold. The guard
// must also answer "and am I someone who should not be here".
//
//   1. treeKind()   -- main checkout, or a linked worktree?
//   2. isSubagent() -- is this a spawned agent, or the desk / the user?
//
// Refuse only when BOTH say yes.
//
// ── HOW `isSubagent` IS DECIDED, AND WHY IT NEEDED NO PLUMBING ───────────────
// Item 243 guessed the answer would be "an environment variable set in builder
// worktrees, or a marker file". A marker file cannot work: the marker would live
// in the worktree, and the mistaken command runs in the SHARED tree, where it is
// invisible. An env var is right -- and one already exists, so nothing had to be
// plumbed. Measured by reading `/proc/<pid>/environ` of the live processes:
//
//   pid 262802  the desk    (`claude -r`, cwd /home/erick/projects/rpg)
//                           CLAUDE_CODE_CHILD_SESSION  absent
//                           AI_AGENT                   absent
//   pid 282161  the harness host
//                           CLAUDE_CODE_CHILD_SESSION  absent
//                           AI_AGENT   claude-code_2-1-220_harness
//   this process, a spawned builder
//                           CLAUDE_CODE_CHILD_SESSION  1
//                           AI_AGENT   claude-code_2-1-220_agent
//
// The decisive property is that an environment variable is INHERITED BY EVERY
// CHILD PROCESS. It travels from the agent's shell into `npm`, into `node`, into
// `vite` -- and it travels with the agent when it `cd`s into the shared tree,
// which is the one moment we need it to. A marker file, a lock, or a check of
// "are any agent worktrees present" all fail that test.
//
// (That last one was measured and rejected outright: there are 45 directories
// under `.claude/worktrees/agent-*` and 40 registered worktrees, nearly all of
// them dead. Their presence says nothing about whether an agent is running.)
//
// ── FAIL OPEN, ALWAYS ────────────────────────────────────────────────────────
// This runs from `preinstall`, so a bug here would brick `npm install` for every
// builder following BUILDER-BRIEF §0 -- the single most-run command on the
// project. Every uncertain answer is therefore ALLOW. We refuse only on a
// positive determination of both facts, and `treeKind` returns 'unknown' rather
// than guessing when git is unavailable, when there is no repo, or when the
// command fails for any reason at all.
//
// Both signs are demonstrated by `scripts/probes/w94-guard-selftest.mjs`, which
// builds a real throwaway repo with a real linked worktree in a temp dir and
// runs the classifier in each.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

/** The env var that opts out. For the rare case where a subagent is genuinely
 *  meant to act on the shared tree -- and it should be rare, because doing so is
 *  what GOTCHAS 84 is about. */
export const OVERRIDE = 'CT_ALLOW_SHARED';

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
 *   git-dir:        /home/erick/projects/rpg/.git/worktrees/agent-a160fbb7920ab449c
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
 * Is the caller a SPAWNED agent, as opposed to the desk or the human?
 *
 * `CLAUDE_CODE_CHILD_SESSION` is the primary signal and was measured present
 * only in the subagent (see the table in this file's header). `AI_AGENT`'s
 * `_agent` suffix is a second, independent witness of the same fact -- kept so
 * the guard does not rest on one undocumented variable, in the spirit of
 * BUILDER-BRIEF §8: two derivations of the same fact, neither retyped.
 */
export function isSubagent(env = process.env) {
  if (env[OVERRIDE]) return false;                    // explicit opt-out wins
  if (env.CLAUDE_CODE_CHILD_SESSION === '1') return true;
  return /_agent$/.test(env.AI_AGENT || '');
}

/**
 * The whole decision, as a pure function of two facts, so the truth table can be
 * tested without spawning agents or vandalising the shared tree.
 *
 * Returns `null` to allow, or a string to print and die with.
 */
export function verdict({ kind, subagent, top, what }) {
  if (kind !== 'main' || !subagent) return null;
  return [
    '',
    `  REFUSED: ${what} in THE SHARED CHECKOUT.`,
    '',
    `  You are a spawned agent and this is the main checkout, not a worktree:`,
    `      ${top || '(unknown)'}`,
    '',
    '  This is the tree the desk commits from and the tree the user plays.',
    '  Four workers have done this by accident; one rebuilt the shared dist/',
    '  and killed a preview it did not own. (GOTCHAS 54, 84; queue item 243.)',
    '',
    '  FIX: cd to YOUR OWN worktree and run it there.',
    '      cd .claude/worktrees/agent-<your-id>/street',
    '  Confirm with `git rev-parse --show-toplevel` before you re-run.',
    '',
    `  If you really do mean the shared tree, set ${OVERRIDE}=1 and say so in`,
    '  your handoff -- it is not a normal thing for an agent to want.',
    '',
  ].join('\n');
}
