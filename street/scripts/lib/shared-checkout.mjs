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
// plumbed.
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
// ══ ⚠ AND `isSubagent` DOES NOT WORK. CORRECTED 2026-08-03, ITEM 247. ════════
//
// **THIS FILE USED TO CARRY A MEASUREMENT TABLE HERE SAYING THE DESK CARRIES
// NEITHER VARIABLE. IT IS FALSE, AND IT IS WHY THE GUARD REFUSES THE DESK.**
// The table read `/proc/262802/environ` (the human's `claude -r` process) and
// `/proc/282161/environ` (the harness host). **Neither of those is a shell that
// runs a tool command.** A Bash tool call does not execute in the session
// process; the harness SPAWNS A SHELL, and it injects the agent variables into
// that shell -- for the desk exactly as for a builder. The two pids were read
// honestly and they answer a question nobody asked.
//
// Re-measured across every process on the box
// (`scripts/probes/w93-item247-sessions.mjs`, `...-whoisinshared.mjs`):
//
//   distinct CLAUDE_CODE_SESSION_ID values alive .......... 1
//   agent processes carrying CLAUDE_CODE_CHILD_SESSION=1 .. 50 of 50
//   distinct CLAUDE*/AI_AGENT env signatures .............. 2, differing ONLY
//        in `CLAUDE_EFFORT` -- which is an effort level, and the signature
//        lacking it belongs to a BUILDER in a worktree. It does not track
//        desk-vs-builder in either direction.
//
// **The desk and every builder it spawns share ONE session id and one
// environment.** They are the same OS-level identity. Every candidate item 247
// listed was measured and is dead:
//
//   process ancestry .... every tool shell's parent is the same harness host,
//                         pid 282161, whose own cwd is the shared checkout.
//                         And `cd` moves the shell itself, so after a builder
//                         cd's into the shared tree its whole ancestry reads
//                         `/home/erick/projects/rpg/street` -- measured.
//   a variable the desk
//     sets for itself ... inherited by every builder shell, because they are
//                         children of the same session.
//   a claimed queue row
//     naming the caller . the guard runs inside `npm run build` and has no
//                         name to check.
//
// **So `isSubagent()` cannot be repaired by picking a different variable: the
// fact it is testing does not exist in the environment.** Anything that lets
// the desk through will let a wandering builder through, and the reverse.
//
// The guard below is therefore LEFT AS IT IS, deliberately -- it is doing the
// job it was built for and `w94-guard-selftest.mjs` still passes 21/21 -- but
// know that on this machine it refuses the desk too, and that
// `CT_ALLOW_SHARED=1` (which works: verified exit 0) is not a hatch the desk
// forgot to be given, it is the only key that exists. A desk session can set it
// once with `export CT_ALLOW_SHARED=1` rather than per command.
//
// **The real fix is a different question, not a different variable**: stop
// asking WHO is running and ask WHETHER THE ACT IS DESTRUCTIVE RIGHT NOW --
// e.g. refuse a `vite build` only while another process is serving this tree's
// `dist/`. That is a design decision for the desk, and item 247 is released
// with it rather than guessed at. See notes/ninetythree-item247-*.md.
//
// ── ONE MORE HOLE, NAMED BY ITEM 243 AND STILL OPEN ──────────────────────────
// The guard hangs off `package.json` scripts. **`npx vite --port N` bypasses
// package.json entirely and is unguarded**, and so is any bare `node
// scripts/*.mjs`. Nothing in this file can close that; only a wrapper the
// project agrees to use, or a shell hook, could.
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
 * ⚠ **IT CANNOT TELL. READ THE ITEM 247 BLOCK IN THIS FILE'S HEADER.** Measured
 * 2026-08-03: the desk and every builder share one `CLAUDE_CODE_SESSION_ID` and
 * one environment, so what this returns for a builder it also returns for the
 * desk. The docstring here used to claim `CLAUDE_CODE_CHILD_SESSION` "was
 * measured present only in the subagent"; that measurement read the session
 * process rather than a tool shell and is false.
 *
 * What it honestly answers is **"is this process running under Claude Code at
 * all"** -- true of the desk, true of every builder, false for the human at a
 * bare terminal. Two witnesses are still better than one for that narrower
 * fact, so both are kept (BUILDER-BRIEF §8).
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
