import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const r = await p.evaluate(async () => {
  const showing = () => {
    const n = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /\[E\]/.test(e.textContent ?? ''));
    if (!n) return null;
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
    }
    return n.textContent.trim();
  };
  const at = async (x, z, label) => {
    window.__ct.warp(x, z, 0, 0.14, 0);
    await new Promise(r => setTimeout(r, 420));
    return { label, standingOn: [x, z], prompt: showing() };
  };
  const out = [];
  out.push(await at(51.29, -97.0, 'GOLDEN ACES door'));
  out.push(await at(39.51, -97.0, 'HOTEL ORPHEUS door'));
  out.push(await at(6.55, -15.25, 'A-1 TAX door'));
  // what is now near the thrift door that was not before?
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const near = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = [(bb.min.x+bb.max.x)/2, (bb.min.y+bb.max.y)/2, (bb.min.z+bb.max.z)/2];
    const d = Math.hypot(c[0] - (-6.55), c[2] - (-74.94));
    if (d < 2.6 && c[1] < 3) near.push({ d: +d.toFixed(2), geo: g.type,
      size: [bb.max.x-bb.min.x, bb.max.y-bb.min.y, bb.max.z-bb.min.z].map(v => +v.toFixed(2)),
      c: c.map(v => +v.toFixed(2)) });
  });
  near.sort((a, b2) => a.d - b2.d);
  return { prompts: out, nearThriftDoor: near.slice(0, 8) };
});
for (const x of r.prompts) console.log(JSON.stringify(x));
console.log('\nwithin 2.6 m of the THRIFT door spot (-6.55, -74.94):');
for (const n of r.nearThriftDoor) console.log(`  ${String(n.d).padStart(5)} m  ${n.geo} ${n.size.join('x')} at (${n.c.join(', ')})`);
await b.close();
