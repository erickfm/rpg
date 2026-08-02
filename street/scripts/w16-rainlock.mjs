// IS THE RAIN STILL WORLD-LOCKED after the density change — measured against
// the RIGHT OBJECT.
//
// scripts/rain-check.mjs answers this question by traversing for `o.type ===
// 'Points'` and keeping the LAST match. There are three Points objects in the
// scene (2600 mapped = the rain, then a 77-point and a 13-point unmapped set),
// so it has been measuring a 13-point object that never moves, and reporting
// "12/12 drops world-locked" about rain it never looked at. Its drop deltas
// come back as exactly 0.000 on every drop, which is the tell: the wrap it is
// supposed to be observing can only produce 0 or a multiple of 30.
//
// The rain is the one with a map on its material. Same test, right subject.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { goto, settle } from './lib/reachable.mjs';

const BOX = 30;
const URL = aim('http://localhost:4195/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await goto(p, URL);
await p.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 30000 });
await settle(p);

const res = await p.evaluate(async ([BOX]) => {
  const s = window.__ct.scene();
  let rain = null;
  s.traverse((o) => { if (o.type === 'Points' && o.material?.map) rain = o; });
  if (!rain) return { err: 'no MAPPED Points object — the rain is not in the scene' };

  const f = s.userData.rainAt;
  let hr = -1;
  for (let h = 24; h < 4000; h++) { const d = ((h % 24) + 24) % 24; if (d >= 11 && d <= 15 && f(h)) { hr = h; break; } }
  window.__ct.warp(-1, -20, Math.PI, 0.14, 0.05);
  window.__ct.clock(hr, 30);                       // ABSOLUTE hour: rainAt hashes hourAbs
  // the wrap only runs while the drops are visible, so wait for the level to
  // come up before sampling — otherwise every delta is 0 and reads as a pass
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (s.userData.rainLevel > 0.9) break;
  }
  const lvl = s.userData.rainLevel;

  const sample = (n) => {
    const a = rain.geometry.getAttribute('position');
    const out = [];
    for (let i = 0; i < n; i++) out.push([a.getX(i), a.getZ(i)]);
    return { pts: out, objX: rain.position.x, objZ: rain.position.z };
  };
  const before = sample(16);
  window.__ct.warp(-1, -65, Math.PI, 0.14, 0.05);   // 45 m, not a multiple of the box
  await new Promise((r) => setTimeout(r, 900));
  const after = sample(16);

  const isPeriodic = (d) => Math.abs(d - BOX * Math.round(d / BOX)) < 0.01;
  const verdicts = before.pts.map(([x0, z0], i) => {
    const [x1, z1] = after.pts[i];
    const dx = x1 - x0, dz = z1 - z0;
    return { dx: +dx.toFixed(3), dz: +dz.toFixed(3), ok: isPeriodic(dx) && isPeriodic(dz) };
  });
  return { hr, lvl, moved: verdicts.filter((v) => v.dx || v.dz).length,
           objMoved: { x: after.objX - before.objX, z: after.objZ - before.objZ }, verdicts };
}, [BOX]);

if (res.err) { console.error(res.err); await b.close(); process.exit(1); }
console.log(`rainy absolute hour ${res.hr}, rainLevel ${res.lvl.toFixed(3)}; player teleported 45 m`);
console.log(`rain object itself moved: x=${res.objMoved.x} z=${res.objMoved.z}  (must be 0 — nonzero means it is pinned to the camera)`);
for (const v of res.verdicts.slice(0, 6)) {
  console.log(`  drop dx=${String(v.dx).padStart(8)} dz=${String(v.dz).padStart(8)}  ${v.ok ? 'world-locked' : 'FOLLOWS CAMERA'}`);
}
const bad = res.verdicts.filter((v) => !v.ok);
console.log(`\n${res.verdicts.length - bad.length}/${res.verdicts.length} drops world-locked; ${res.moved} of them actually wrapped`);
console.log(errs.length ? `page errors: ${errs.join('\n')}` : '');
if (bad.length || res.objMoved.x || res.objMoved.z) { console.error('FAIL: rain is not world-locked'); await b.close(); process.exit(1); }
if (!res.moved) { console.error('FAIL: no drop moved at all — the wrap never ran, so nothing was tested'); await b.close(); process.exit(1); }
console.log('PASS: the rain is locked to the world');
await b.close();
