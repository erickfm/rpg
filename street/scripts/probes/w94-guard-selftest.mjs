// Does the shared-checkout guard refuse the right thing and ONLY the right
// thing? Items 243 (worker ninetyfour) and 247 (worker ninetyseven).
//
// This project's standing complaint is checks that pass by measuring nothing
// (GOTCHAS 34, and the "population floor on every assertion" rule). A guard is
// the worst possible place for that: a guard that cannot fire is indistinguish-
// able from a guard that is working, right up until the day it was needed.
//
// So this drives BOTH SIGNS against a REAL repository -- `git init` a throwaway
// tree in a temp dir, `git worktree add` a real linked worktree UNDER
// `.claude/worktrees/agent-*` (the real layout, because the guard now reads the
// path), and run the real classifier and the real CLI in each. No mocking of
// git, because the entire question is what git reports, and the one thing I am
// not allowed to do is run any of this against the shared checkout I am
// guarding.
//
// ── WHAT ITEM 247 CHANGED HERE, AND WHY ──────────────────────────────────────
// The old version's desk case was:
//
//     ok(isSubagent({}) === false, 'the desk (no vars at all) is NOT an agent');
//
// It passed. It was also **the bug** — it asserted a MODEL of the desk's shell
// (`{}`) instead of the desk's shell. Measured for real, the desk's shell
// carries `CLAUDE_CODE_CHILD_SESSION=1`, `AI_AGENT=..._agent` and the same
// `CLAUDE_PID` as every builder; 65 variables, byte-identical but for `_`,
// `OLDPWD`, `PWD` and `SHLVL`. The guard therefore refused the desk in real
// life while this file reported green.
//
// So the desk case is now driven by DESK_ENV below: the real environment block,
// transcribed from `/proc/370039/environ` — the `npm run dev` that serves the
// user's live world on :5177, started from the desk's own shell. If a future
// change makes the guard refuse the desk again, that assertion goes red.
//
// Run:  node scripts/probes/w94-guard-selftest.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  treeKind, isClaudeShell, worktreeProvenance, verdict, checkHere, OVERRIDE, WORKTREE_DIR,
} from '../lib/shared-checkout.mjs';

const GUARD = fileURLToPath(new URL('../guard-shared-checkout.mjs', import.meta.url));

let pass = 0, fail = 0;
const ok = (cond, what) => {
  if (cond) { pass++; console.log(`  ok    ${what}`); }
  else { fail++; console.log(`  FAIL  ${what}`); }
};

// ── the two environments, both MEASURED, neither invented ───────────────────
//
// The CLAUDE_* half of the desk's real shell env (pid 370039, `npm run dev`,
// cwd /home/erick/projects/rpg/street). The point of this constant is that it
// is NOT `{}`: every one of these was on the desk's shell when item 247 was
// filed, and the first guard refused on two of them.
const DESK_ENV = {
  CLAUDE_CODE_CHILD_SESSION: '1',
  AI_AGENT: 'claude-code_2-1-220_agent',
  CLAUDE_PID: '282161',
  CLAUDE_CODE_SESSION_ID: 'a6835f8b-f14f-4c42-8550-fa7d9870806a',
  CLAUDECODE: '1',
  CLAUDE_CODE_ENTRYPOINT: 'cli',
  OLDPWD: '/home/erick/projects/rpg',          // <- the repo root. NOT a worktree.
  PWD: '/home/erick/projects/rpg/street',
};
// A builder's shell differs in exactly one thing that matters: it travelled
// here out of its own worktree, and OLDPWD says so.
const BUILDER_ENV = { ...DESK_ENV, OLDPWD: null, PWD: null };  // filled in per-tree below

// ── a real main checkout with a real agent worktree under .claude/worktrees ──
const root = mkdtempSync(join(tmpdir(), 'w94-guard-'));
const main = join(root, 'main');
const wt = join(main, WORKTREE_DIR, 'agent-deadbeefcafe1234');
const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

try {
  execFileSync('git', ['init', '-q', '-b', 'trunk', main], { stdio: 'ignore' });
  git(['config', 'user.email', 'w94@example.invalid'], main);
  git(['config', 'user.name', 'w94'], main);
  writeFileSync(join(main, 'f.txt'), 'x\n');
  git(['add', 'f.txt'], main);
  git(['commit', '-qm', 'init'], main);
  mkdirSync(join(main, WORKTREE_DIR), { recursive: true });
  git(['worktree', 'add', '-q', '-b', 'side', wt], main);
  // The real layout: builders stand in `<worktree>/street`, not at its root.
  // Provenance must accept a subdirectory, and the path must EXIST on disk --
  // this mkdir is load-bearing, and its absence turned the subdirectory
  // assertion red the first time this ran.
  mkdirSync(join(wt, 'street'), { recursive: true });

  console.log('tree classification (real git, both signs):');
  const inMain = treeKind(main);
  const inWt = treeKind(wt);
  ok(inMain.kind === 'main', `main checkout classifies as 'main' (got '${inMain.kind}')`);
  ok(inWt.kind === 'worktree', `linked worktree classifies as 'worktree' (got '${inWt.kind}')`);
  // Population floor: if git silently gave us nothing, BOTH would read
  // 'unknown' and the two assertions above would have been the only evidence.
  ok(inMain.kind !== 'unknown' && inWt.kind !== 'unknown',
    'neither tree classified as unknown -- git actually answered');
  ok(inMain.top !== null && inWt.top !== null, 'both trees reported a toplevel');
  ok(inMain.top !== wt, 'the two trees are genuinely different directories');

  // A directory that is not a repo at all must be 'unknown', never 'main'.
  // This is the fail-open case, and getting it wrong would refuse the world.
  const bare = mkdtempSync(join(tmpdir(), 'w94-norepo-'));
  ok(treeKind(bare).kind === 'unknown', 'a non-repo directory is unknown, not main');
  rmSync(bare, { recursive: true, force: true });

  console.log('\nclaude-shell detection (NECESSARY, never sufficient -- item 247):');
  ok(isClaudeShell({ CLAUDE_CODE_CHILD_SESSION: '1' }) === true,
    'CLAUDE_CODE_CHILD_SESSION=1 reads as a claude shell');
  ok(isClaudeShell({ AI_AGENT: 'claude-code_2-1-220_agent' }) === true,
    'AI_AGENT=..._agent reads as a claude shell (independent second witness)');
  ok(isClaudeShell(DESK_ENV) === true,
    'THE DESK ALSO READS AS A CLAUDE SHELL -- this is why it cannot be the whole test');
  ok(isClaudeShell({}) === false, 'a bare terminal / CI is not a claude shell');
  ok(isClaudeShell({ AI_AGENT: 'claude-code_2-1-220_harness' }) === false,
    'the harness host (..._harness) is not a claude shell');
  ok(isClaudeShell({ CLAUDE_CODE_CHILD_SESSION: '1', [OVERRIDE]: '1' }) === false,
    `${OVERRIDE}=1 opts out`);

  console.log('\nworktree provenance (the fact that actually separates them):');
  const prov = (env) => worktreeProvenance({ env, top: inMain.top, pid: process.pid });
  ok(prov({ ...BUILDER_ENV, OLDPWD: wt }) === wt,
    'OLDPWD inside .claude/worktrees/agent-* -> provenance found (a builder)');
  ok(prov({ ...BUILDER_ENV, OLDPWD: join(wt, 'street') }) === join(wt, 'street'),
    'a SUBDIRECTORY of the worktree also counts (agents cd into street/)');
  ok(prov(DESK_ENV) === null,
    'THE DESK: OLDPWD=/home/erick/projects/rpg -> no provenance -> allowed');
  ok(prov({ OLDPWD: join(main, 'src') }) === null,
    'somewhere else inside the main checkout is not provenance');
  ok(prov({ OLDPWD: join(main, WORKTREE_DIR, 'agent-doesnotexist') }) === null,
    'a worktree path that does not exist on disk is not provenance (stale string)');
  ok(worktreeProvenance({ env: { OLDPWD: wt }, top: null }) === null,
    'no toplevel -> no provenance (fail open)');

  console.log('\nverdict truth table (every combination that decides):');
  const v = (kind, claudeShell, provenance) =>
    verdict({ kind, claudeShell, provenance, top: inMain.top, what: 'x' });
  ok(v('main', true, wt) !== null, 'main + claude shell + worktree provenance -> REFUSE');
  ok(v('main', true, null) === null, 'main + claude shell + NO provenance      -> allow (THE DESK)');
  ok(v('main', false, wt) === null, 'main + human terminal                    -> allow');
  ok(v('worktree', true, wt) === null, 'worktree + agent                         -> allow (normal builder)');
  ok(v('unknown', true, wt) === null, 'unknown + agent                          -> allow (fail open)');
  const m = v('main', true, wt);
  ok(m.includes(wt) && /GOTCHAS/.test(m),
    'the refusal names the worktree to go back to, and cites the gotcha');

  console.log('\nthe real CLI, end to end, in the real trees:');
  const run = (cwd, env) => {
    try {
      execFileSync('node', [GUARD, 'npm run build'],
        { cwd, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env }, stdio: 'pipe' });
      return 0;
    } catch (e) { return e.status ?? -1; }
  };
  // A builder that travelled from its worktree into the main checkout.
  const BUILDER = { ...DESK_ENV, OLDPWD: wt, PWD: main };
  ok(run(main, BUILDER) === 1, 'builder (came from its worktree) in MAIN -> exit 1, refused');
  ok(run(wt, BUILDER) === 0, 'builder in ITS OWN worktree              -> exit 0, runs');
  ok(run(main, DESK_ENV) === 0, 'THE DESK in MAIN, real env              -> exit 0, unaffected');
  ok(run(main, { ...BUILDER, [OVERRIDE]: '1' }) === 0, `builder + ${OVERRIDE}=1            -> exit 0`);

  console.log('\ncheckHere(), the wrapper package.json and vite.config both call:');
  // Run it with cwd inside the real temp worktree -- must allow, and must not throw.
  ok(checkHere('vite', wt, { ...DESK_ENV, OLDPWD: wt }) === null,
    'checkHere in a worktree -> null (allow)');
  ok(checkHere('vite', join(root, 'nope'), DESK_ENV) === null,
    'checkHere in a path that does not exist -> null (fails open, does not throw)');
} finally {
  try { git(['worktree', 'prune'], main); } catch { /* best effort */ }
  rmSync(root, { recursive: true, force: true });
}

// POPULATION FLOOR. If the temp repo failed to build, the try block would have
// thrown out of most of these and we would print a triumphant "0 failed".
const EXPECTED = 29;
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} run (floor ${EXPECTED})`);
if (pass + fail < EXPECTED) {
  console.log(`FAIL: only ${pass + fail} assertions ran; expected at least ${EXPECTED}`);
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
