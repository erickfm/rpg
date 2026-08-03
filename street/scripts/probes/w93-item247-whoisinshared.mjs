// w93 / item 247 — is there ANY per-process fact that separates the desk from a
// spawned builder? Every candidate item 247 names, measured.
//
// Run it from anywhere:  node scripts/probes/w93-item247-whoisinshared.mjs
import { readFileSync, readdirSync, realpathSync, statSync, existsSync } from 'node:fs';

const SHARED = '/home/erick/projects/rpg';
const rd = (p) => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
const cmdOf = (pid) => (rd(`/proc/${pid}/cmdline`) || '').replace(/\0/g, ' ').trim();
const cwdOf = (pid) => { try { return realpathSync(`/proc/${pid}/cwd`); } catch { return null; } };
const ttyOf = (pid) => { const s = rd(`/proc/${pid}/stat`); return s ? Number(s.slice(s.lastIndexOf(')') + 2).split(' ')[4]) : null; };
const ppidOf = (pid) => { const s = rd(`/proc/${pid}/stat`); return s ? Number(s.slice(s.lastIndexOf(')') + 2).split(' ')[1]) : null; };
const envOf = (pid) => {
  const raw = rd(`/proc/${pid}/environ`); if (raw === null) return null;
  const o = {}; for (const kv of raw.split('\0')) { const i = kv.indexOf('='); if (i > 0) o[kv.slice(0, i)] = kv.slice(i + 1); }
  return o;
};

const pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d)).map(Number);

// ── 1. WHO IS SITTING IN THE SHARED CHECKOUT RIGHT NOW? ───────────────────
console.log('── processes whose cwd is inside the SHARED checkout (not a worktree) ──');
let inShared = 0;
for (const pid of pids) {
  const c = cwdOf(pid); if (!c) continue;
  if (!c.startsWith(SHARED) || c.includes('/.claude/worktrees/')) continue;
  const e = envOf(pid); if (!e || (!e.CLAUDE_CODE_SESSION_ID && !e.AI_AGENT)) continue;
  inShared++;
  console.log(`  pid ${String(pid).padEnd(8)} ppid ${String(ppidOf(pid)).padEnd(8)} tty=${ttyOf(pid)} `
    + `child=${e.CLAUDE_CODE_CHILD_SESSION ?? '-'} ai=${e.AI_AGENT ?? '-'}`);
  console.log(`      cwd=${c}`);
  console.log(`      ${cmdOf(pid).slice(0, 100)}`);
}
if (!inShared) console.log('  (none)');

// ── 2. IS THERE MORE THAN ONE SESSION? ────────────────────────────────────
const sids = new Set(), agentEnvs = [];
for (const pid of pids) {
  const e = envOf(pid); if (!e) continue;
  if (e.CLAUDE_CODE_SESSION_ID) { sids.add(e.CLAUDE_CODE_SESSION_ID); agentEnvs.push({ pid, e }); }
}
console.log(`\n── distinct CLAUDE_CODE_SESSION_ID values alive: ${sids.size} ──`);
for (const s of sids) console.log(`  ${s}`);

// ── 3. DO ANY TWO AGENT SHELLS DIFFER IN *ANY* CLAUDE VARIABLE? ───────────
// If they do not, no environment test can ever separate the desk from a
// builder, and the guard's whole approach is unfixable as designed.
const keysOf = (e) => Object.keys(e).filter((k) => /^(CLAUDE|AI_AGENT|ANTHROPIC)/.test(k)).sort();
const sig = new Map();
for (const { pid, e } of agentEnvs) {
  const k = keysOf(e).map((n) => `${n}=${e[n]}`).join('\n');
  if (!sig.has(k)) sig.set(k, []);
  sig.get(k).push(pid);
}
console.log(`\n── distinct CLAUDE*/AI_AGENT environment signatures among ${agentEnvs.length} agent processes: ${sig.size} ──`);
let i = 0;
for (const [k, ps] of sig) {
  console.log(`  signature ${++i} — ${ps.length} process(es), e.g. pid ${ps[0]} (cwd ${cwdOf(ps[0])})`);
  for (const line of k.split('\n')) console.log(`      ${line}`);
}

// ── 4. DOES ANYTHING ON DISK MAP AN AGENT TO ITS WORKTREE, LIVE? ──────────
console.log('\n── on-disk per-agent records ──');
for (const d of ['/home/erick/.claude/jobs', '/tmp/cc-daemon-1000']) {
  if (!existsSync(d)) { console.log(`  ${d}: absent`); continue; }
  let kids = [];
  try { kids = readdirSync(d); } catch { /* */ }
  console.log(`  ${d}: ${kids.length} entr(ies) — ${kids.slice(0, 8).join(' ')}`);
}
const wt = `${SHARED}/.claude/worktrees`;
if (existsSync(wt)) {
  const all = readdirSync(wt);
  const recent = all.filter((n) => { try { return Date.now() - statSync(`${wt}/${n}`).mtimeMs < 6 * 3600e3; } catch { return false; } });
  console.log(`  ${wt}: ${all.length} worktree dirs, ${recent.length} touched in the last 6 h`);
}

// ── 5. THE VERDICT THE GUARD NEEDS ────────────────────────────────────────
console.log('\n── VERDICT ──');
console.log(`  sessions alive: ${sids.size}`);
console.log(`  distinct claude-env signatures among agent processes: ${sig.size}`);
console.log(sig.size <= 1
  ? '  => EVERY agent process on this box carries a BYTE-IDENTICAL claude environment.\n'
    + '     The desk and every builder share one session id. NO environment variable\n'
    + '     can separate them, so isSubagent() cannot be repaired by picking a\n'
    + '     different variable — the fact it is testing does not exist in the env.'
  : '  => signatures differ; a variable-based test may be possible. Inspect above.');
