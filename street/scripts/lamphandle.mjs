// A LIGHT YOU CAN TURN OFF.
//
// `scene.userData.addLamp` could only ever ADD a head. C hit that registering
// the television in 301 and had to delete the registration rather than switch
// it off; until C spotted it the set pooled light on the boards all night with
// the screen dark, against "make the unilluminated stuff darker", in the room
// he sleeps in.
//
// This proves the whole cycle on a real surface rather than on the array: light
// something, watch a material come up, put it out, watch it go back down — and
// then do it again, because a remover that works once and corrupts the list is
// worse than none.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 560 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(23, 30));
await settle(p);

// a spot on the main pavement well away from any existing lamp, so nothing
// else can account for what changes
const AT = [-6.0, -47.0];
const litNear = () => p.evaluate(([X, Z]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let n = 0, sum = 0, cnt = 0;
  s.traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements;
    if (Math.hypot(e[12] - X, e[14] - Z) > 2.2) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m?.color) return;
    cnt++; sum += m.color.r;
    if (m.userData?.poolLit) n++;
  });
  return { poolLit: n, meshes: cnt, meanTint: +(sum / Math.max(1, cnt)).toFixed(4) };
}, AT);

const step = async (label, fn) => {
  if (fn) await p.evaluate(fn, AT);
  await p.waitForTimeout(500);
  const r = await litNear();
  console.log(`  ${label.padEnd(28)} poolLit ${String(r.poolLit).padStart(3)}   mean tint ${r.meanTint}   (${r.meshes} meshes)`);
  return r;
};

console.log(`\n── a lamp at ${JSON.stringify(AT)} at 23:30, and taking it away again ──`);
const dark0 = await step('before', null);
const on1 = await step('addLamp(...)', ([X, Z]) => {
  window.__lampOff = window.__ct.scene().userData.addLamp(X, Z);
});
const off1 = await step('the remover it returned', () => { window.__lampOff(); window.__lampOff = null; });
const on2 = await step('addLamp again', ([X, Z]) => {
  window.__lampOff = window.__ct.scene().userData.addLamp(X, Z);
});
const off2 = await step('removed again', () => { window.__lampOff(); });
await p.evaluate(() => { try { window.__lampOff(); } catch { /* must be safe twice */ } });
const off3 = await step('remover called TWICE', null);

console.log('\n  ── the cycle ──');
const ok = (t, v) => console.log(`  ${v ? 'OK  ' : 'FAIL'}  ${t}`);
ok('the light raises materials near it', on1.poolLit > dark0.poolLit && on1.meanTint > dark0.meanTint);
ok('the remover puts them back exactly', off1.poolLit === dark0.poolLit && off1.meanTint === dark0.meanTint);
ok('and it lights again afterwards', on2.poolLit === on1.poolLit && on2.meanTint === on1.meanTint);
ok('and goes out again', off2.meanTint === dark0.meanTint);
ok('calling the remover twice is harmless', off3.meanTint === dark0.meanTint);
await b.close();
