// w93 / item 247 — every live Claude session on this box, and what each one's
// SHELLS carry. This is the measurement item 243's author did not take.
//
// 243 read `/proc/262802/environ` — the desk's LAUNCH environment — and
// concluded the desk carries neither agent variable. That is true of pid 262802
// and irrelevant: a Bash tool call does not run in the session process, it runs
// in a SHELL THE HARNESS SPAWNS, and the harness injects the agent variables
// into that shell. So the environment the guard actually sees is a child's, and
// nobody had looked at one belonging to the desk.
//
// This groups every readable process by CLAUDE_CODE_SESSION_ID and prints, per
// session, the agent variables its shells carry plus the cwds they run in — so
// the desk's shells and a builder's shells can be compared side by side without
// anyone having to be in the other's terminal.
//
// Read-only. Run from anywhere:  node scripts/probes/w93-item247-sessions.mjs
import { readFileSync, readdirSync, realpathSync } from 'node:fs';

const rd = (p) => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
const cmdOf = (pid) => (rd(`/proc/${pid}/cmdline`) || '').replace(/\0/g, ' ').trim();
const cwdOf = (pid) => { try { return realpathSync(`/proc/${pid}/cwd`); } catch { return null; } };
const envOf = (pid) => {
  const raw = rd(`/proc/${pid}/environ`); if (raw === null) return null;
  const o = {}; for (const kv of raw.split('\0')) { const i = kv.indexOf('='); if (i > 0) o[kv.slice(0, i)] = kv.slice(i + 1); }
  return o;
};
const ppidOf = (pid) => {
  const s = rd(`/proc/${pid}/stat`); if (!s) return null;
  return Number(s.slice(s.lastIndexOf(')') + 2).split(' ')[1]);
};

const pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d)).map(Number);
const seen = [];
for (const pid of pids) {
  const e = envOf(pid); if (!e) continue;
  const sid = e.CLAUDE_CODE_SESSION_ID, ai = e.AI_AGENT;
  if (!sid && !ai) continue;
  seen.push({ pid, ppid: ppidOf(pid), sid: sid ?? null, ai: ai ?? null,
    child: e.CLAUDE_CODE_CHILD_SESSION ?? null, cc: e.CLAUDECODE ?? null,
    job: e.CLAUDE_JOB_DIR ?? null, cwd: cwdOf(pid), cmd: cmdOf(pid).slice(0, 78) });
}

// group by session
const bySid = new Map();
for (const r of seen) { const k = r.sid ?? `(no sid) ${r.ai}`; if (!bySid.has(k)) bySid.set(k, []); bySid.get(k).push(r); }

console.log(`${seen.length} processes carrying CLAUDE_CODE_SESSION_ID or AI_AGENT, `
  + `in ${bySid.size} group(s)\n`);
for (const [k, rows] of bySid) {
  const shells = rows.filter((r) => /(^|\/)(ba|z|)sh( |$)/.test(r.cmd) || /shell-snapshots/.test(r.cmd));
  const cwds = [...new Set(rows.map((r) => r.cwd).filter(Boolean))];
  console.log(`── session ${k}`);
  console.log(`   ${rows.length} process(es), ${shells.length} shell(s)`);
  console.log(`   AI_AGENT values      : ${[...new Set(rows.map((r) => r.ai ?? '-'))].join(' | ')}`);
  console.log(`   CHILD_SESSION values : ${[...new Set(rows.map((r) => r.child ?? '-'))].join(' | ')}`);
  console.log(`   CLAUDECODE values    : ${[...new Set(rows.map((r) => r.cc ?? '-'))].join(' | ')}`);
  console.log(`   distinct cwds        : ${cwds.length}`);
  for (const c of cwds.slice(0, 6)) console.log(`       ${c}`);
  for (const r of rows.slice(0, 6)) {
    console.log(`   pid ${String(r.pid).padEnd(8)} ppid ${String(r.ppid).padEnd(8)} `
      + `child=${String(r.child ?? '-').padEnd(3)} ai=${String(r.ai ?? '-').padEnd(30)} ${r.cmd}`);
  }
  if (rows.length > 6) console.log(`   … and ${rows.length - 6} more`);
  console.log('');
}
console.log(`this process: pid ${process.pid} sid ${process.env.CLAUDE_CODE_SESSION_ID} `
  + `child=${process.env.CLAUDE_CODE_CHILD_SESSION} ai=${process.env.AI_AGENT}`);
