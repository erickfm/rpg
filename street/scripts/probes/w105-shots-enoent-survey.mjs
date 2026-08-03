// Item 260 part 4 — "report whether any script still dies on a missing `shots/`".
//
// THE SHAPE OF THE BUG, so the scan looks for the right thing. `shots/` is
// gitignored, so a FRESH WORKTREE has no such directory. A script that writes
// into it without creating it first dies with ENOENT — and `ghosts.mjs` died on
// its final `writeFileSync`, AFTER printing its verdict, so the suite recorded
// a missing directory as a corridor defect. That is item 191's exact shape and
// it has now happened at least twice.
//
// So the dangerous pattern is not "writes a file". It is **writes into a
// gitignored directory that the script does not create**. Both halves matter:
// a script that writes to `notes/` is fine (tracked, always there), and a
// script that calls `mkdirSync` first is fine wherever it writes.
//
// ⚠ THIS IS A STATIC SCAN AND STATIC SCANS LIE. It cannot see a path built at
// runtime from a variable. So it reports what it found AND what it could not
// read, and the run ends by actually deleting `shots/` and executing one
// flagged script and one clean script — both signs — rather than trusting
// itself. A survey that only greps is a hypothesis.
import { readFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const DIRS = ['scripts', 'scripts/probes'];

// which directories are gitignored, asked of git rather than assumed
const ignored = (rel) => {
  try {
    execFileSync('git', ['check-ignore', '-q', rel], { cwd: ROOT });
    return true;
  } catch { return false; }
};
const GITIGNORED = ['shots', 'dist', 'tmp', 'out'].filter((d) => ignored(d + '/x'));
console.log(`\ngitignored output dirs, per \`git check-ignore\`: ${GITIGNORED.join(', ') || '(none)'}\n`);

const files = [];
for (const d of DIRS) {
  for (const f of readdirSync(join(ROOT, d))) {
    if (f.endsWith('.mjs') || f.endsWith('.js')) files.push(join(d, f));
  }
}

// ⚠ THE FIRST CUT OF THIS SCAN WAS WRONG BY A FACTOR OF TEN, AND THE EMPIRICAL
// HALF BELOW IS WHAT CAUGHT IT. It counted `path:` — the Playwright screenshot
// option — as a write, and flagged 197 scripts. Then `SELFTEST=scripts/trash.mjs`
// deleted `shots/`, ran it, and it came back **exit 0, no ENOENT, "shots ->
// shots/tr-*.png"**. **`page.screenshot({ path })` creates its parent
// directories itself; `fs.writeFileSync` does not.** That is precisely why
// `ghosts.mjs` died on its FINAL `writeFileSync` and never on any of the
// screenshots before it.
//
// So only node's own fs writes are at risk, and the population is small.
const FS_WRITE = /\b(writeFileSync|appendFileSync|createWriteStream|copyFileSync)\s*\(/g;
const SHOT_OPT = /\bpath\s*:\s*[`'"]/g;
const rows = [];
for (const rel of files) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  const makes = /\bmkdirSync\s*\(|\bmkdir\s*\(|mkdir -p/.test(src);
  const targets = new Set();
  for (const m of src.matchAll(/[`'"]([A-Za-z0-9_./-]*?)(?:\$\{[^}]*\})?[A-Za-z0-9_./-]*[`'"]/g)) {
    const head = (m[1] || '').split('/')[0];
    if (GITIGNORED.includes(head)) targets.add(head);
  }
  if (!targets.size) continue;
  const fsWrites = (src.match(FS_WRITE) || []).length;
  const shots = (src.match(SHOT_OPT) || []).length;
  if (!fsWrites && !shots) continue;
  rows.push({ rel, makes, targets: [...targets].join(','), fsWrites, shots });
}

const bad = rows.filter((r) => !r.makes && r.fsWrites > 0);
const shotOnly = rows.filter((r) => !r.makes && r.fsWrites === 0);
console.log(`${files.length} scripts scanned; ${rows.length} touch a gitignored dir.\n`);
console.log(`AT RISK — an \`fs\` write into a gitignored dir with no mkdirSync anywhere: ${bad.length}`);
for (const r of bad) console.log(`  ${r.rel.padEnd(46)} -> ${r.targets}   (${r.fsWrites} fs write(s))`);
if (!bad.length) console.log('  none.');
console.log(`\nNOT at risk — screenshots only (${shotOnly.length}). Playwright makes the`
  + ` directory; measured, not assumed (see the header).`);
console.log(`Safe by construction — calls mkdirSync: ${rows.filter((q) => q.makes).length}`);

// ── THE EMPIRICAL HALF, BOTH SIGNS ────────────────────────────────────────
// SELFTEST=<script.mjs> deletes `shots/` and runs it, so a claim about ENOENT
// is a claim somebody watched. Run it once on a flagged script (expect ENOENT)
// and once on a clean one (expect no ENOENT) — a check that only ever sees one
// sign cannot tell which it is measuring.
const target = process.env.SELFTEST;
if (target) {
  const shots = join(ROOT, 'shots');
  if (existsSync(shots)) rmSync(shots, { recursive: true, force: true });
  console.log(`\n── deleted shots/, running ${target} ──`);
  let code = 0, out = '';
  try {
    out = execFileSync('node', [target], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }, timeout: 300000,
    });
  } catch (e) { code = e.status ?? -1; out = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
  const enoent = /ENOENT/.test(out);
  console.log(`exit ${code};  ENOENT in output: ${enoent ? 'YES' : 'no'}`);
  const tail = out.trim().split('\n').slice(-6).join('\n  ');
  console.log(`  ${tail}`);
  mkdirSync(shots, { recursive: true });
}
