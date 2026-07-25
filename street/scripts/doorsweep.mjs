// DOOR SWEEP — find every [E] door by walking the pavement, not by reading
// coordinates out of source.
//
// Why: `4fe23d0f` shipped a diner prompt standing outside a bank, because
// `int-diner.ts` still held DZ = 9.6 after D moved the building. My own trigger
// harness held the same stale number. A hand-copied coordinate is exactly the
// defect this audit keeps reporting, so the instrument should not contain one.
//
// Method: warp along the reachable line in front of each facade in small steps
// and record which prompt is showing. That yields, per door, the SPAN of
// pavement from which it can be triggered — which is the thing that actually
// matters — and it finds doors this auditor has never heard of.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

// the reachable line in front of each facade (round 6/11 facade map)
const LINES = [
  { id: 'west walk',        x: -6.30, z0: 14,   z1: -108, step: 0.25 },
  { id: 'west walk (south)',x: -6.62, z0: -70,  z1: -108, step: 0.25 },
  { id: 'east walk',        x:  6.30, z0: 14,   z1: -96,  step: 0.25 },
  { id: 'side st north',    z: -97.3, x0: 8,    x1: 56,   step: 0.25 },
  { id: 'side st south',    z: -108.7,x0: -6,   x1: 56,   step: 0.25 },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const hits = await p.evaluate(async (LINES) => {
  const showing = () => {
    const n = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /\[E\]/.test(e.textContent ?? ''));
    if (!n) return null;
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
    }
    return n.textContent.trim();
  };
  const out = [];
  for (const L of LINES) {
    if (L.x !== undefined) {
      const dir = L.z1 < L.z0 ? -1 : 1;
      for (let z = L.z0; dir < 0 ? z >= L.z1 : z <= L.z1; z += dir * L.step) {
        window.__ct.warp(L.x, z, 0, 0.14, 0);
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));
        const s = showing();
        if (s) out.push({ line: L.id, at: [L.x, +z.toFixed(2)], prompt: s });
      }
    } else {
      for (let x = L.x0; x <= L.x1; x += L.step) {
        window.__ct.warp(x, L.z, 0, 0.14, 0);
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));
        const s = showing();
        if (s) out.push({ line: L.id, at: [+x.toFixed(2), L.z], prompt: s });
      }
    }
  }
  return out;
}, LINES);

// collapse to one row per prompt: the span of pavement it fires from
const byPrompt = new Map();
for (const h of hits) {
  const k = h.prompt;
  const along = h.line.startsWith('side') ? h.at[0] : h.at[1];
  const e = byPrompt.get(k) ?? { prompt: k, line: h.line, min: Infinity, max: -Infinity, n: 0 };
  e.min = Math.min(e.min, along); e.max = Math.max(e.max, along); e.n++;
  byPrompt.set(k, e);
}
const rows = [...byPrompt.values()].sort((a, b2) => a.line.localeCompare(b2.line) || a.min - b2.min);
writeFileSync('shots/door-sweep.json', JSON.stringify({ rows, hits }, null, 2));
console.log(`${hits.length} sample points fired a prompt; ${rows.length} distinct doors found\n`);
console.log('prompt'.padEnd(34), 'line'.padEnd(18), 'span along the walk', '  width');
for (const r of rows)
  console.log(r.prompt.padEnd(34), r.line.padEnd(18),
    `${r.min.toFixed(2)} … ${r.max.toFixed(2)}`.padStart(18),
    `${(r.max - r.min).toFixed(2)} m`.padStart(8));
await b.close();
