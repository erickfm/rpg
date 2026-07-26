import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4186/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
const prompt = () => p.evaluate(() => { const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null; });

// 1. COUNT THE MACHINES BY MEASUREMENT, not from the commit message.
// An ATM fascia is a raked panel about 0.5 m wide at chest height on the facade.
const found = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cxm = (bb.min.x + bb.max.x) / 2, czm = (bb.min.z + bb.max.z) / 2;
    if (Math.abs(cxm + 7) > 2.5 || Math.abs(czm - 7.29) > 3.5) return;   // around the ATM spot
    if (bb.max.y < 0.7 || bb.min.y > 1.8) return;                        // chest height
    out.push({ x: +cxm.toFixed(2), z: +czm.toFixed(2),
      w: +(bb.max.z - bb.min.z).toFixed(2), h: +(bb.max.y - bb.min.y).toFixed(2),
      y: [+bb.min.y.toFixed(2), +bb.max.y.toFixed(2)] });
  });
  return out.sort((a, c) => a.z - c.z);
});
console.log(`meshes at chest height on the bank facade: ${found.length}`);
for (const f of found) console.log(`   z ${f.z}  x ${f.x}  ${f.w} m wide, ${f.h} tall, y ${JSON.stringify(f.y)}`);

const spot = await p.evaluate(() => window.__ct.spots()
  .filter(s => /FIRST FEDERAL/.test(s.label)).map(s => ({ x: s.x, z: s.z, r: s.r, l: s.label })));
console.log(`\nregistered ATM spots: ${spot.length}`);
for (const s of spot) console.log(`   (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) r=${s.r}  "${s.l}"`);

// 2. STAND AT EACH MACHINE AND SEE WHETHER IT ANSWERS. A's own claim is that ONE
// spot serves BOTH, and the user's rule is that "a machine that looks usable and
// ignores you" is not an answer. 0.95 m apart, so probe either side of the spot
// along the frontage as well as on it.
console.log('\nstanding along the frontage, 0.8 m out from the wall:');
const sx = spot[0].x, sz = spot[0].z;
for (const dz of [-1.6, -1.2, -0.95, -0.5, 0, 0.5, 0.95, 1.2, 1.6]) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, -Math.PI / 2, 0.14, 0), [sx, sz + dz]);
  await p.waitForTimeout(320);
  const pr = await prompt();
  const tag = Math.abs(dz - -0.95) < 0.01 ? '  <- the LEFT machine, A\'s claim'
    : dz === 0 ? '  <- on the registered spot' : '';
  console.log(`   z offset ${String(dz).padStart(5)}  ${pr === null ? 'NO PROMPT' : JSON.stringify(pr)}${tag}`);
}

// 3. BOTH LIGHTS, from the pavement opposite — the ledger's explicit requirement,
// because the user's shot was at night.
for (const [name, hh] of [['day', 13], ['night', 22]]) {
  await p.evaluate((h) => window.__ct.clock(h, 0), hh);
  await p.waitForTimeout(900);
  await p.evaluate(([z]) => window.__ct.warp(-2.2, z, -Math.PI / 2, 0.14, 0.05), [sz]);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `shots/G-verify-atm-${name}.png` });
  await p.evaluate(([z]) => window.__ct.warp(-5.9, z - 0.6, -Math.PI / 2, 0.14, 0.0), [sz]);
  await p.waitForTimeout(450);
  await p.screenshot({ path: `shots/G-verify-atm-${name}-close.png` });
}
await b.close();
console.log('\nshots/G-verify-atm-{day,night}{,-close}.png');
