// SELF-LOCATING door shots. The old version pasted its prompt spans out of a
// doorsweep run -- flagged in notes/AUDIT-INSTRUMENTS.md as re-derive-first,
// because a door that moves leaves the camera pointed at the wall beside it.
//
// Now it does its own sweep first, the way scripts/doorsweep.mjs does: walk the
// pavement, read whatever `[E]` is on screen, collapse to one span per prompt,
// then stand at the centre of each span and face the facade. No coordinate is
// typed in and none survives between runs.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4184/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(800);

const LINES = [
  { id: 'west walk', x: -5.9, from: 10, to: -104, face: -1 },
  { id: 'east walk', x:  5.9, from: 10, to: -100, face:  1 },
];
const hits = await p.evaluate(async (LINES) => {
  // The prompt element STAYS IN THE DOM and is hidden by CSS, so reading its
  // text without checking visibility returns the last prompt that fired -- which
  // is how the first version of this script reported THRIFT STORE firing across
  // 29 m of the EAST walk. Lifted verbatim from scripts/doorsweep.mjs, which
  // has this right and is the reason it has never been wrong.
  const read = () => {
    const n = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /\[E\]/.test(e.textContent ?? ''));
    if (!n) return null;
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden') return null;
    }
    return n.textContent.trim();
  };
  const out = [];
  for (const L of LINES) {
    for (let z = L.from; z >= L.to; z -= 0.5) {
      window.__ct.warp(L.x, z, L.face > 0 ? Math.PI/2 : -Math.PI/2, 0.14, 0.06);
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      const s = read();
      if (s) out.push({ line: L.id, x: L.x, z: +z.toFixed(2), face: L.face, prompt: s });
    }
  }
  return out;
}, LINES);

// collapse to one span per prompt per line
const spans = new Map();
for (const h of hits) {
  const k = `${h.line}|${h.prompt}`;
  const s = spans.get(k) ?? { line: h.line, x: h.x, face: h.face, prompt: h.prompt, lo: h.z, hi: h.z };
  s.lo = Math.min(s.lo, h.z); s.hi = Math.max(s.hi, h.z);
  spans.set(k, s);
}
console.log(`${hits.length} sample points fired a prompt; ${spans.size} distinct doors found by walking\n`);
let i = 0;
for (const s of spans.values()) {
  const zc = (s.lo + s.hi) / 2;
  const r = await p.evaluate(([x, zc, face]) => {
    const RAD=0.36, cols=window.__ct.colliders().filter(q=>q&&isFinite(q.minX)&&Math.abs(q.minX)<500);
    if (cols.some(q=>x>q.minX-RAD&&x<q.maxX+RAD&&zc>q.minZ-RAD&&zc<q.maxZ+RAD)) return {ok:false};
    window.__ct.warp(x, zc, face > 0 ? Math.PI/2 : -Math.PI/2, 0.14, 0.06);
    return {ok:true};
  }, [s.x, zc, s.face]);
  if (!r.ok) { console.log(`   MISS  ${s.prompt} — centre not standable`); continue; }
  await p.waitForTimeout(240);
  const q = await p.evaluate(() => window.__ct.pos());
  const landed = Math.abs(q[0]-s.x) < 0.06 && Math.abs(q[2]-zc) < 0.06;
  const tag = s.prompt.replace(/[^a-z0-9]+/gi,'-').toLowerCase().slice(0,28);
  await p.screenshot({ path: `shots/ds-${tag}.png` });
  console.log(`   ${landed?'shot ':'DRIFT'}  ${s.prompt.padEnd(30)} ${s.line}  span ${s.lo} … ${s.hi}  centre ${zc.toFixed(2)}`);
  i++;
}
writeFileSync('shots/doorshot.json', JSON.stringify([...spans.values()], null, 2));
await b.close();
