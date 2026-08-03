// Does the shared-checkout guard refuse the right thing and ONLY the right
// thing? Item 243, worker ninetyfour.
//
// This project's standing complaint is checks that pass by measuring nothing
// (GOTCHAS 34, and the "population floor on every assertion" rule). A guard is
// the worst possible place for that: a guard that cannot fire is indistinguish-
// able from a guard that is working, right up until the day it was needed.
//
// So this drives BOTH SIGNS against a REAL repository -- `git init` a throwaway
// tree in a temp dir, `git worktree add` a real linked worktree off it, and run
// the real classifier and the real CLI in each. No mocking of git, because the
// entire question is what git reports, and the one thing I am not allowed to do
// is run any of this against the shared checkout I am guarding.
//
// Run:  node scripts/probes/w94-guard-selftest.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { treeKind, isSubagent, verdict, OVERRIDE } from '../lib/shared-checkout.mjs';

const GUARD = fileURLToPath(new URL('../guard-shared-checkout.mjs', import.meta.url));

let pass = 0, fail = 0;
const ok = (cond, what) => {
  if (cond) { pass++; console.log(`  ok    ${what}`); }
  else { fail++; console.log(`  FAIL  ${what}`); }
};

// ── a real main checkout with a real linked worktree ────────────────────────
const root = mkdtempSync(join(tmpdir(), 'w94-guard-'));
const main = join(root, 'main');
const wt = join(root, 'wt');
const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

try {
  execFileSync('git', ['init', '-q', '-b', 'trunk', main], { stdio: 'ignore' });
  git(['config', 'user.email', 'w94@example.invalid'], main);
  git(['config', 'user.name', 'w94'], main);
  writeFileSync(join(main, 'f.txt'), 'x\n');
  git(['add', 'f.txt'], main);
  git(['commit', '-qm', 'init'], main);
  git(['worktree', 'add', '-q', '-b', 'side', wt], main);

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
  ok(inMain.top !== inWt.top, 'the two trees are genuinely different directories');

  // A directory that is not a repo at all must be 'unknown', never 'main'.
  // This is the fail-open case, and getting it wrong would refuse the world.
  const bare = mkdtempSync(join(tmpdir(), 'w94-norepo-'));
  ok(treeKind(bare).kind === 'unknown', 'a non-repo directory is unknown, not main');
  rmSync(bare, { recursive: true, force: true });

  console.log('\nagent detection (measured env shapes):');
  ok(isSubagent({ CLAUDE_CODE_CHILD_SESSION: '1' }) === true,
    'CLAUDE_CODE_CHILD_SESSION=1 (a spawned builder) reads as agent');
  ok(isSubagent({ AI_AGENT: 'claude-code_2-1-220_agent' }) === true,
    'AI_AGENT=..._agent reads as agent (independent second witness)');
  ok(isSubagent({}) === false, 'the desk (no vars at all) is NOT an agent');
  ok(isSubagent({ AI_AGENT: 'claude-code_2-1-220_harness' }) === false,
    'the harness host (..._harness) is NOT an agent');
  ok(isSubagent({ CLAUDE_CODE_CHILD_SESSION: '1', [OVERRIDE]: '1' }) === false,
    `${OVERRIDE}=1 opts an agent out`);

  console.log('\nverdict truth table (all four combinations):');
  const v = (kind, subagent) => verdict({ kind, subagent, top: '/t', what: 'x' });
  ok(v('main', true) !== null, 'main + agent      -> REFUSE');
  ok(v('main', false) === null, 'main + desk       -> allow (the desk must keep working)');
  ok(v('worktree', true) === null, 'worktree + agent  -> allow (the normal builder case)');
  ok(v('worktree', false) === null, 'worktree + desk   -> allow');
  ok(v('unknown', true) === null, 'unknown + agent   -> allow (fail open)');
  const m = v('main', true);
  ok(/cd .*worktree/i.test(m) && /GOTCHAS/.test(m),
    'the refusal names the fix and cites the gotcha');

  console.log('\nthe real CLI, end to end, in the real trees:');
  const run = (cwd, env) => {
    try {
      execFileSync('node', [GUARD, 'npm run build'],
        { cwd, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env }, stdio: 'pipe' });
      return 0;
    } catch (e) { return e.status ?? -1; }
  };
  const AGENT = { CLAUDE_CODE_CHILD_SESSION: '1' };
  ok(run(main, AGENT) === 1, 'agent in the MAIN checkout  -> exit 1, refused');
  ok(run(wt, AGENT) === 0, 'agent in a WORKTREE         -> exit 0, runs normally');
  ok(run(main, {}) === 0, 'desk in the MAIN checkout   -> exit 0, unaffected');
  ok(run(main, { ...AGENT, [OVERRIDE]: '1' }) === 0, `agent + ${OVERRIDE}=1        -> exit 0`);
} finally {
  try { git(['worktree', 'prune'], main); } catch { /* best effort */ }
  rmSync(root, { recursive: true, force: true });
}

// POPULATION FLOOR. If the temp repo failed to build, the try block would have
// thrown out of most of these and we would print a triumphant "0 failed".
const EXPECTED = 21;
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} run (floor ${EXPECTED})`);
if (pass + fail < EXPECTED) {
  console.log(`FAIL: only ${pass + fail} assertions ran; expected at least ${EXPECTED}`);
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
