// IS THE RAIN OBJECT EVEN BEING DRAWN? — the question no pixel probe can answer.
//
// Facing yaw 0 at (-6,-34) a 3x native crop of both the sky slot and the road
// shows ZERO streaks, while 660 drops project inside the camera frustum and
// facing yaw 90 from the same spot in the same second is a downpour. Drops in
// the frustum that do not appear on screen means the DRAW never happened.
//
// `onBeforeRender` fires only for objects the renderer actually submits — it
// is called after the frustum-cull test, not before — so counting it per
// heading is a direct read of "was this drawn", with none of the world-motion
// contamination that makes screenshot diffing useless here (a car crossing the
// frame moves more pixels than the rain does).
//
// Fails loudly: any heading where the rain is not drawn is a heading with no
// weather in it.
import { chromium } from 'playwright';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4195/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await goto(p, URL);
await p.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 30000 });
await settle(p);

const hour = await p.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  for (let h = 24; h < 4000; h++) { const d = ((h % 24) + 24) % 24; if (d >= 11 && d <= 15 && f(h)) return h; }
  return null;
});
await p.evaluate(() => window.__ct.warp(-6, -34, 0, 0.14, 0));
await p.evaluate(([h]) => window.__ct.clock(h, 10), [hour]);
let lvl = 0;
for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); lvl = await p.evaluate(() => window.__ct.scene().userData.rainLevel); if (lvl > 0.99) break; }

const info = await p.evaluate(() => {
  const s = window.__ct.scene();
  let r = null; s.traverse((o) => { if (o.type === 'Points' && o.material?.map) r = o; });
  r.onBeforeRender = () => { r.userData.w16drawn = (r.userData.w16drawn ?? 0) + 1; };
  r.geometry.computeBoundingSphere();
  const bs = r.geometry.boundingSphere;
  return { culled: r.frustumCulled, c: [bs.center.x, bs.center.y, bs.center.z], rad: bs.radius };
});
console.log(`rainLevel ${lvl.toFixed(3)}  frustumCulled=${info.culled}`);
console.log(`bounding sphere as the renderer sees it: centre (${info.c.map((v) => v.toFixed(1)).join(', ')}) r ${info.rad.toFixed(1)}`);
console.log(`player stands at (-6, -34) — distance from that centre ${Math.hypot(-6 - info.c[0], -34 - info.c[2]).toFixed(1)} m\n`);

console.log('  heading   frames the rain was DRAWN in (over ~0.6 s)');
const bad = [];
for (let k = 0; k < 8; k++) {
  const yaw = (k * Math.PI) / 4;
  await p.evaluate(([y]) => window.__ct.warp(-6, -34, y, 0.14, 0), [yaw]);
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const s = window.__ct.scene();
    s.traverse((o) => { if (o.type === 'Points' && o.material?.map) o.userData.w16drawn = 0; });
  });
  await p.waitForTimeout(600);
  const n = await p.evaluate(() => {
    const s = window.__ct.scene();
    let r = null; s.traverse((o) => { if (o.type === 'Points' && o.material?.map) r = o; });
    return r.userData.w16drawn;
  });
  const deg = Math.round((yaw * 180) / Math.PI);
  console.log(`  yaw ${String(deg).padStart(3)}    ${String(n).padStart(4)}   ${n === 0 ? '<-- NOT DRAWN: no rain in this direction at all' : ''}`);
  if (n === 0) bad.push(deg);
}
console.log(errs.length ? `\n  page errors: ${errs.join('\n')}` : '');
if (bad.length) {
  console.error(`\nFAIL: it is raining (rainLevel ${lvl.toFixed(2)}) but the drops are not drawn facing ${bad.join(', ')} deg.`);
  process.exit(1);
}
console.log('\nPASS: the rain is drawn on every heading.');
await b.close();
