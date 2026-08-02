// Is BURGER BARN still red-and-beige, or has it gone back to mustard?
//
// The user corrected this THREE TIMES. From the queue: "burgerFront ... kept its
// mustard through three fixes". It is now right, and nothing would notice if it
// went back — e90c6736's audit lists it under "verified once by hand, nothing
// would notice a regression", alongside most of the appearance requests.
//
// Appearance is where most of the user's requests live and where the suite is
// thinnest, because a colour is hard to assert without crying wolf. So this
// asserts only what the failure mode actually was, with margin measured off the
// current world rather than chosen:
//
//   mustard must be ABSENT   measured 0.0% of the band; fails above 15%
//
// THE RED HALF IS NOT ASSERTED, and dropping it is the honest outcome. I first
// measured "red 18%" with a probe that had no saturation floor, set the
// threshold at 8%, and then this check — which requires sat >= 0.25 — read
// 1.9% and failed a world that is correct. The 18% was mostly DESATURATED
// brick-red, which is the wall, not the paintwork. A threshold carried across
// from a different metric is how a check cries wolf on day one, and I would
// rather ship half a guard than a wrong one. What "enough red" means on that
// facade needs someone looking at it, which is the whole difficulty with
// appearance and the reason it is unguarded.
//
// Mustard is the saturated yellow at hue 45-70 — that is what "it is still
// mustard" meant. Beige is hue 20-45 at low saturation and is NOT constrained
// here, because beige and tan and orange all live in that bin and pinning it
// would be asserting a taste rather than a defect.
//
//   node scripts/burger-palette.mjs
//   node scripts/burger-palette.mjs --selftest
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = aim('http://localhost:4177/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

const r = await p.evaluate(([selftest]) => {
  const fr = (globalThis.__frontages ?? []).find((f) => f.name === 'BURGER BARN');
  if (!fr) return { err: 'no BURGER BARN frontage registered' };
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let best = null;
  s.traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements;
    const along = fr.axis === 'z' ? e[14] : e[12];
    if (along < fr.loWorld || along > fr.hiWorld || e[13] < 1 || e[13] > 4) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const im = m?.map?.image;
      if (!im?.width || m.map.userData?.surface !== 'brick') continue;
      if (!best || im.width * im.height > best.im.width * best.im.height) best = { im };
    }
  });
  if (!best) return { err: 'no brick-declared band found on the BURGER BARN frontage' };
  const c = document.createElement('canvas');
  c.width = best.im.width; c.height = best.im.height;
  const g = c.getContext('2d');
  g.drawImage(best.im, 0, 0);
  if (selftest) {                       // repaint it mustard, the exact regression
    g.fillStyle = '#c9a227';
    g.fillRect(0, 0, c.width, Math.round(c.height * 0.8));
  }
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0, red = 0, mustard = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    n++;
    const R = d[i], G = d[i + 1], B = d[i + 2];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if (mx === mn) continue;
    const dd = mx - mn;
    let h = mx === R ? ((G - B) / dd + (G < B ? 6 : 0)) : mx === G ? ((B - R) / dd + 2) : ((R - G) / dd + 4);
    h *= 60;
    const sat = (mx - mn) / mx;
    if (sat < 0.25) continue;
    if (h >= 345 || h <= 18) red++;
    else if (h >= 45 && h <= 70) mustard++;
  }
  return { size: [c.width, c.height], red: +(100 * red / n).toFixed(1), mustard: +(100 * mustard / n).toFixed(1) };
}, [SELFTEST]);
await b.close();

if (r.err) { console.error(r.err); process.exit(2); }
console.log(`BURGER BARN band ${r.size.join('x')}:  red ${r.red}%   mustard ${r.mustard}%`);
const bad = r.mustard > 15;
if (SELFTEST) {
  if (bad) { console.log('SELFTEST PASSED — a mustard repaint was caught'); process.exit(0); }
  console.error('SELFTEST FAILED — the band was repainted mustard and this did not notice.');
  process.exit(2);
}
if (!bad) { console.log('  not mustard — the regression the user corrected three times has not returned'); process.exit(0); }
console.error('  IT HAS GONE BACK TO MUSTARD.');
process.exit(1);
