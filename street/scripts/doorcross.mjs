// WALKED vs AUTHORED, for every frontage, with BOTH axis conventions handled.
//
// My earlier cross-check compared four doors and got agreement inside 8 cm --
// but it silently skipped every `axis: 'x'` frontage, which is a third of the
// roster. This walks all four pavement lines, collapses prompts to spans, and
// compares each against the authored door position with the axis honoured.
//
//   axis 'z'  frontage runs along z, facade at x = facePos, door z = doorWorld
//   axis 'x'  frontage runs along x, facade at z = facePos, door x = doorWorld
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const hits = await p.evaluate(async () => {
  const read = () => {
    const n=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/\[E\]/.test(e.textContent??''));
    if(!n) return null;
    for(let e=n;e&&e!==document.body;e=e.parentElement){const st=getComputedStyle(e);
      if(st.display==='none'||st.visibility==='hidden') return null;}
    return n.textContent.trim();
  };
  const out = [];
  const LINES = [
    { id:'west', kind:'z', fixed:-6.30, from:14,  to:-108 },
    { id:'east', kind:'z', fixed: 6.30, from:14,  to:-96  },
    { id:'sideN',kind:'x', fixed:-97.3, from:8,   to:56   },
    { id:'sideS',kind:'x', fixed:-108.7,from:-6,  to:56   },
  ];
  for (const L of LINES) {
    const step = L.from > L.to ? -0.5 : 0.5;
    for (let v = L.from; step<0 ? v>=L.to : v<=L.to; v += step) {
      const x = L.kind==='z' ? L.fixed : v, z = L.kind==='z' ? v : L.fixed;
      window.__ct.warp(x, z, 0, 0.14, 0);
      await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
      const s = read(); if (s) out.push({ line:L.id, kind:L.kind, v:+v.toFixed(2), prompt:s });
    }
  }
  return out;
});
const fronts = await p.evaluate(() => (globalThis.__frontages||[]).map(f=>({
  name:f.name, axis:f.axis, lo:f.loWorld, hi:f.hiWorld, face:f.facePos, door:f.doorWorld })));
const spans = new Map();
for (const h of hits) {
  const k = h.prompt;
  const s = spans.get(k) ?? { kind:h.kind, lo:h.v, hi:h.v };
  s.lo=Math.min(s.lo,h.v); s.hi=Math.max(s.hi,h.v); spans.set(k, s);
}
console.log(`${hits.length} prompt samples · ${spans.size} distinct doors across all four walks\n`);
console.log('prompt                          walked centre   authored door   diff    axis');
const rows = [];
for (const [prompt, s] of spans) {
  const centre = (s.lo + s.hi) / 2;
  const f = fronts.find(q => prompt.toUpperCase().includes(q.name.toUpperCase()));
  if (!f) { console.log(`${prompt.padEnd(31)} ${centre.toFixed(2).padStart(9)}       — no roster entry —`); continue; }
  const d = +(centre - f.door).toFixed(2);
  rows.push({ prompt, centre:+centre.toFixed(2), door:+f.door.toFixed(2), diff:d, axis:f.axis });
  console.log(`${prompt.padEnd(31)} ${centre.toFixed(2).padStart(9)}   ${f.door.toFixed(2).padStart(9)}   ${String(d).padStart(6)}    ${f.axis}`);
}
const ok = rows.filter(r=>Math.abs(r.diff) <= 0.6).length;
console.log(`\n${ok} of ${rows.length} agree within 0.6 m`);
writeFileSync('shots/doorcross.json', JSON.stringify({rows, fronts},null,2));
await b.close();
