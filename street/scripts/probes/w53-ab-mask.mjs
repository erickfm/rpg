// ITEM 141: WHERE do the pixels move? w53-ab.mjs counts them; this paints them.
//
// Writes shots/w53-mask-<room>-<yaw>-control.png and -treated.png: white where
// the frame changed, black where it did not. A count cannot tell a lost wall
// from a clock digit ticking over in the corner; a mask can.
//
// Usage: SHOT_URL=... node scripts/probes/w53-ab-mask.mjs <roomId> <yaw> [pitch]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = aim('http://localhost:4183/');
const ROOM = process.argv[2] ?? 'apt301';
const YAW = Number(process.argv[3] ?? 0);
const PITCH = Number(process.argv[4] ?? 0);
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(13, 30));

await p.evaluate(() => {
  window.__shot = () => document.querySelector('canvas').toDataURL('image/png');
  window.__mask = async (a, b) => {
    const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height);
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height);
    const out = g.createImageData(c.width, c.height);
    let n = 0, box = [1e9, 1e9, -1, -1];
    for (let i = 0; i < da.data.length; i += 4) {
      const hit = Math.abs(da.data[i] - db.data[i]) > 6 || Math.abs(da.data[i + 1] - db.data[i + 1]) > 6
        || Math.abs(da.data[i + 2] - db.data[i + 2]) > 6;
      const v = hit ? 255 : 0;
      out.data[i] = v; out.data[i + 1] = v; out.data[i + 2] = v; out.data[i + 3] = 255;
      if (hit) {
        n++; const px = (i / 4) % c.width, py = Math.floor((i / 4) / c.width);
        box[0] = Math.min(box[0], px); box[1] = Math.min(box[1], py);
        box[2] = Math.max(box[2], px); box[3] = Math.max(box[3], py);
      }
    }
    g.putImageData(out, 0, 0);
    return { n, box, url: c.toDataURL('image/png') };
  };
});

const st = await p.evaluate((room) => {
  const r = window.__ct.roomDims().find((q) => q.id === room);
  return r ? { x: r.cx, z: r.cz } : null;
}, ROOM);
await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, undefined, pi), [st.x, st.z, YAW, PITCH]);

await p.evaluate(() => window.__ct.cullRegions(false));
await p.waitForTimeout(260);
const a1 = await p.evaluate(() => window.__shot());
await p.waitForTimeout(260);
const a2 = await p.evaluate(() => window.__shot());
await p.evaluate(() => window.__ct.cullRegions(true));
await p.waitForTimeout(260);
const b = await p.evaluate(() => window.__shot());

for (const [tag, x, y] of [['control', a1, a2], ['treated', a2, b]]) {
  const m = await p.evaluate(([u, v]) => window.__mask(u, v), [x, y]);
  const f = `shots/w53-mask-${ROOM}-${YAW}-${tag}.png`;
  writeFileSync(f, Buffer.from(m.url.split(',')[1], 'base64'));
  console.log(`${tag.padEnd(8)} ${String(m.n).padStart(6)} px  bbox x ${m.box[0]}..${m.box[2]}  y ${m.box[1]}..${m.box[3]}   -> ${f}`);
}
await browser.close();
