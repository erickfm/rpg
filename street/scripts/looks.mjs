// TWO "APPEARANCE" REQUESTS THAT DO NOT NEED AN EYE.
//
// The suite guards behaviour and geometry and almost no appearance, and
// appearance is where most of the user's asks live. But some of them are
// numbers, not judgement. Proof of concept for two:
//
//   wheel arches read as arches   -> the arch must clear the tyre's top
//   BURGER BARN is red and beige  -> no yellow on that frontage
//
// Both read the live scene. Neither needs a camera or a human.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // ── 1. wheel arches: every tyre's top must sit below its arch line ──
  const tyres = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const m = Array.isArray(o.material)?o.material[0]:o.material;
    if (!m || !m.color) return;
    const hex = m.color.getHexString();
    if (hex !== '101114') return;                       // the tyre black
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x > 400) return;
    if (bb.min.y > 0.2) return;
    tyres.push(+bb.max.y.toFixed(3));
  });
  // ── 2. BURGER BARN: sample the materials on its frontage for yellow ──
  const F = (globalThis.__frontages||[]).find(f => f.name === 'BURGER BARN');
  const yellows = [];
  let sampled = 0;
  if (F) {
    const lo = Math.min(F.loWorld, F.hiWorld), hi = Math.max(F.loWorld, F.hiWorld);
    s.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
      const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      const cz=(bb.min.z+bb.max.z)/2, cx=(bb.min.x+bb.max.x)/2;
      if (cz < lo || cz > hi) return;
      if (Math.abs(cx - F.facePos) > 1.6) return;        // on the frontage plane
      if (bb.max.y > 5) return;                          // shopfront band only
      const m = Array.isArray(o.material)?o.material[0]:o.material;
      if (!m || !m.color) return;
      sampled++;
      const c = m.color, r=c.r, g2=c.g, bl=c.b;
      // yellow: red and green both high, blue clearly lower, and not near-white
      if (r > 0.55 && g2 > 0.45 && bl < g2 - 0.18 && Math.abs(r-g2) < 0.28)
        yellows.push('#'+c.getHexString());
    });
  }
  return { tyres, yellows, sampled, hasFrontage: !!F };
});
const TOP = Math.max(...out.tyres), ARCH = 0.72;   // arch line: rocker 0.34 + ARCH_H 0.38
console.log(`WHEEL ARCHES  ${out.tyres.length} tyres · highest tyre top ${TOP} m · arch line ${ARCH} m`);
console.log(`   ${TOP < ARCH ? `PASS — ${((ARCH-TOP)*100).toFixed(1)} cm of arch above the tyre` : '** FAIL — the tyre stands above the arch **'}`);
console.log(`\nBURGER BARN   frontage ${out.hasFrontage?'found':'MISSING'} · ${out.sampled} materials on the shopfront band`);
console.log(`   ${out.yellows.length === 0 ? 'PASS — no yellow' : '** FAIL — yellow present: ' + [...new Set(out.yellows)].join(' ') + ' **'}`);
await b.close();
