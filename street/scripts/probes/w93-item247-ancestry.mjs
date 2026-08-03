// w93 / item 247 — WHAT ACTUALLY SEPARATES THE DESK FROM A SPAWNED BUILDER?
//
// `scripts/lib/shared-checkout.mjs` decides it with `CLAUDE_CODE_CHILD_SESSION`
// / `AI_AGENT`, and the desk has measured — from its own shell, in the shared
// checkout — that IT CARRIES BOTH, so the guard refuses the desk. This walks
// the process tree and prints, for every claude process on the box and for this
// process's own ancestry, the facts a replacement test could be built on.
//
// Read-only. Prints; asserts nothing. Run it from wherever you are:
//   node scripts/probes/w93-item247-ancestry.mjs
import { readFileSync, readdirSync } from 'node:fs';

const rd = (p) => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
const cmd = (pid) => (rd(`/proc/${pid}/cmdline`) || '').replace(/\0/g, ' ').trim();
const envOf = (pid) => {
  const raw = rd(`/proc/${pid}/environ`);
  if (raw === null) return null;                     // not ours to read
  const o = {};
  for (const kv of raw.split('\0')) { const i = kv.indexOf('='); if (i > 0) o[kv.slice(0, i)] = kv.slice(i + 1); }
  return o;
};
const ppidOf = (pid) => {
  const s = rd(`/proc/${pid}/stat`); if (!s) return null;
  // comm can contain spaces and parens; everything after the LAST ')' is safe
  const tail = s.slice(s.lastIndexOf(')') + 2).split(' ');
  return Number(tail[1]);                            // field 4 overall = ppid
};
const cwdOf = (pid) => { try { return readFileSync(`/proc/${pid}/cwd`) && require('node:fs').realpathSync(`/proc/${pid}/cwd`); } catch { return null; } };

const KEYS = ['CLAUDE_CODE_CHILD_SESSION', 'AI_AGENT', 'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_PID', 'CLAUDE_JOB_DIR', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDECODE', 'CLAUDE_EFFORT'];

console.log('── MY OWN ANCESTRY ────────────────────────────────────────────────');
let p = process.pid, depth = 0;
const chain = [];
while (p && p > 1 && depth++ < 40) { chain.push(p); p = ppidOf(p); }
for (const pid of chain) {
  const e = envOf(pid);
  console.log(`  pid ${String(pid).padEnd(8)} ${cmd(pid).slice(0, 90)}`);
  if (e) console.log(`      ${KEYS.map((k) => `${k}=${e[k] ?? '-'}`).join('  ')}`);
  else console.log('      (environ unreadable)');
  let cw = null; try { cw = require('node:fs').realpathSync(`/proc/${pid}/cwd`); } catch { /* */ }
  console.log(`      cwd=${cw ?? '?'}`);
}

console.log('\n── EVERY `claude` PROCESS ON THE BOX ──────────────────────────────');
const pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d)).map(Number).sort((a, b) => a - b);
const rows = [];
for (const pid of pids) {
  const c = cmd(pid);
  if (!c) continue;
  const e = envOf(pid);
  if (!e || !e.CLAUDECODE) continue;                 // only claude-owned processes
  // the interesting ones are the session hosts, not every `npm`/`node` child
  if (!/(^|\/)claude( |$)/.test(c) && !/claude\/versions/.test(c) && !/cli\.js/.test(c)) continue;
  let cw = null; try { cw = require('node:fs').realpathSync(`/proc/${pid}/cwd`); } catch { /* */ }
  rows.push({ pid, ppid: ppidOf(pid), c: c.slice(0, 70), cwd: cw,
    child: e.CLAUDE_CODE_CHILD_SESSION ?? '-', ai: e.AI_AGENT ?? '-',
    sid: (e.CLAUDE_CODE_SESSION_ID ?? '-').slice(0, 8), cp: e.CLAUDE_PID ?? '-',
    ep: e.CLAUDE_CODE_ENTRYPOINT ?? '-' });
}
console.log(`  ${rows.length} claude process(es) whose environ this process may read`);
for (const r of rows) {
  console.log(`  pid ${String(r.pid).padEnd(8)} ppid ${String(r.ppid).padEnd(8)} child=${String(r.child).padEnd(4)}`
    + ` AI_AGENT=${r.ai.padEnd(30)} sid=${r.sid} CLAUDE_PID=${String(r.cp).padEnd(8)} entry=${r.ep}`);
  console.log(`      cwd=${r.cwd}`);
  console.log(`      ${r.c}`);
}

console.log('\n── THIS PROCESS ───────────────────────────────────────────────────');
console.log(`  pid ${process.pid}  cwd ${process.cwd()}`);
for (const k of KEYS) console.log(`  ${k.padEnd(28)} ${process.env[k] ?? '(absent)'}`);
