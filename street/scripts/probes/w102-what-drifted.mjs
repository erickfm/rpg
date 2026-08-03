// WHAT ARE THE 8 OBJECTS THAT DRIFTED?
//
// w102-geomdiff.mjs proves geometry is identical and finds 8 of 8612 position
// entries differing by 1-3 cm, all at y ~0.14-0.19 on the x = +-6 sidewalk
// lines. BUILDER-BRIEF calls "4-6 pigeons drifting" the noise floor, but that
// is a thing to CHECK, not to invoke. Name them.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4183/');
const WANT = [
  [-5.69, 0.17, -20.92], [-6.00, 0.14, -28.09], [-6.00, 0.14, -60.17],
  [-6.00, 0.14, 3.80], [-6.51, 0.15, -23.69], [6.00, 0.14, -12.22],
  [6.00, 0.14, -44.11], [6.00, 0.14, -76.14],
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(1200);

const hits = await p.evaluate((want) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    for (const w of want) {
      if (Math.abs(o.position.x - w[0]) < 0.02
        && Math.abs(o.position.y - w[1]) < 0.02
        && Math.abs(o.position.z - w[2]) < 0.02) {
        // walk up for a named ancestor — the mesh itself is usually anonymous
        const chain = [];
        for (let n = o; n; n = n.parent) chain.push(n.name || n.type);
        out.push({
          at: [+o.position.x.toFixed(2), +o.position.y.toFixed(2), +o.position.z.toFixed(2)],
          name: o.name || '(unnamed)',
          geom: o.geometry?.type,
          params: o.geometry?.parameters
            ? Object.entries(o.geometry.parameters)
              .filter(([, v]) => typeof v === 'number')
              .map(([k, v]) => `${k}=${+v.toFixed(2)}`).join(' ')
            : '',
          chain: chain.slice(0, 5).join(' < '),
          ud: JSON.stringify(o.userData).slice(0, 90),
        });
      }
    }
  });
  return out;
}, WANT);

console.log(`matched ${hits.length} of ${WANT.length} drifted positions\n`);
for (const h of hits) {
  console.log(`(${h.at.join(', ')})  ${h.name}  ${h.geom} ${h.params}`);
  console.log(`     ancestry: ${h.chain}`);
  if (h.ud && h.ud !== '{}') console.log(`     userData: ${h.ud}`);
  console.log('');
}
await b.close();
