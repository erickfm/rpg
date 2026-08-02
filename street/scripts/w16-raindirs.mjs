// IS THE RAIN REALLY DIRECTIONAL, OR IS THE INSTRUMENT? — eight headings.
//
// The first version of this probe hid the drops with `points.visible = false`
// and diffed. That measures NOTHING: `updateRain` writes `rain.visible =
// rainLevel > 0.02` every single frame, so the "rain hidden" frame had rain in
// it and the diff was reading drop MOTION between two frames. One heading came
// back 0.00% — pixel-identical frames, which falling rain cannot produce — and
// that is what gave it away.
//
// `scene.remove(rain)` is the honest switch: updateRain only ever sets
// `.visible`, so a detached object stays detached and the second frame really
// has no rain in it.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4195/';
const TAG = process.argv[2] ?? 'now';
const OUT = `shots/w16-dirs-${TAG}`;
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await goto(p, URL);
await p.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 30000 });
await settle(p);

const hour = await p.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  for (let h = 24; h < 4000; h++) {
    const d = ((h % 24) + 24) % 24;
    if (d >= 11 && d <= 15 && f(h)) return h;
  }
  return null;
});
await p.evaluate(() => window.__ct.warp(-6, -34, 0, 0.14, 0));
await p.evaluate(([h]) => window.__ct.clock(h, 10), [hour]);
let lvl = 0;
for (let i = 0; i < 80; i++) {
  await p.waitForTimeout(250);
  lvl = await p.evaluate(() => window.__ct.scene().userData.rainLevel);
  if (lvl > 0.99) break;
}
const st = await p.evaluate(() => ({ storm: window.__ct.scene().userData.stormNow,
                                     heavy: window.__ct.scene().userData.rainHeavy }));
console.log(`hour ${hour} (${hour % 24}:10)  rainLevel ${lvl.toFixed(3)}  stormNow ${st.storm?.toFixed(3)}  heavy ${st.heavy?.toFixed(3)}`);

const rows = [];
for (let k = 0; k < 8; k++) {
  const yaw = (k * Math.PI) / 4;
  await p.evaluate(([y]) => window.__ct.warp(-6, -34, y, 0.14, 0), [yaw]);
  await p.waitForTimeout(350);
  const a = await p.screenshot();
  await p.evaluate(() => {
    const s = window.__ct.scene();
    let r = null; s.traverse((o) => { if (o.type === 'Points' && o.material?.map) r = o; });
    s.userData.w16stash = r; s.remove(r);
  });
  await p.waitForTimeout(300);
  const bb = await p.screenshot();
  await p.evaluate(() => {
    const s = window.__ct.scene();
    s.add(s.userData.w16stash); delete s.userData.w16stash;
  });
  await p.waitForTimeout(300);

  const stat = await p.evaluate(async ([x, y]) => {
    const load = (d) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + d; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height;
    const g = cv.getContext('2d');
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, cv.width, cv.height).data;
    g.clearRect(0, 0, cv.width, cv.height); g.drawImage(ib, 0, 0);
    const db = g.getImageData(0, 0, cv.width, cv.height).data;
    let touched = 0, strong = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      if (d > 12) touched++;
      if (d > 45) strong++;
    }
    const px = da.length / 4;
    return { pct: +(100 * touched / px).toFixed(2), strong: +(100 * strong / px).toFixed(2) };
  }, [a.toString('base64'), bb.toString('base64')]);

  const name = `yaw${String(Math.round((yaw * 180) / Math.PI)).padStart(3, '0')}`;
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${OUT}/${name}.png`, a);
  rows.push({ name, ...stat });
}

console.log('\n  heading   rain px    strong px');
let min = 100, max = 0;
for (const r of rows) {
  console.log(`  ${r.name}  ${String(r.pct).padStart(7)}%  ${String(r.strong).padStart(8)}%`);
  min = Math.min(min, r.pct); max = Math.max(max, r.pct);
}
console.log(`\n  spread ${min}% .. ${max}%  (ratio ${(max / Math.max(min, 0.001)).toFixed(1)}x)`);
console.log(errs.length ? `  page errors: ${errs.join('\n')}` : '  no page errors');
await b.close();
