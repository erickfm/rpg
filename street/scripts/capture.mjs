// Build, serve, run the full bugsweep, and file the shots under shots/<label>/.
// Usage: node scripts/capture.mjs base-a [port]
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync, existsSync } from 'node:fs';

const label = process.argv[2];
const port = process.argv[3] ?? '4177';
if (!label) { console.error('usage: capture.mjs <label> [port]'); process.exit(2); }

console.log('building…');
execSync('npm run build', { stdio: 'inherit' });

const srv = spawn('npx', ['vite', 'preview', '--port', port], { stdio: 'ignore', detached: true });
try {
  await new Promise((r) => setTimeout(r, 2500));
  console.log('sweeping…');
  execSync('node scripts/bugsweep.mjs', { stdio: 'inherit', env: { ...process.env, SHOT_URL: `http://localhost:${port}/` } });
} finally {
  try { process.kill(-srv.pid); } catch {}
}

const out = `shots/${label}`;
if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out, { recursive: true });
let n = 0;
for (const f of readdirSync('shots')) {
  if (f.startsWith('bug-') && f.endsWith('.png')) { renameSync(`shots/${f}`, `${out}/${f}`); n++; }
}
console.log(`filed ${n} shots -> ${out}`);
