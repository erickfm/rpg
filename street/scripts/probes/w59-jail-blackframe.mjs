// Standing at the jail's own [E] spot renders a BLACK CANVAS. Why?
//
// Found while shooting item 104's before/after: at x=60.25, z=-103 — which is
// `standOf(DOOR, 0.75)`, the spot the [E] prompt is anchored to — the canvas is
// 100% near-black while the DOM HUD still paints. One step back (x=60.00) the
// frame is normal. Reproduced on MAINLINE with item 104's fix stashed, so it is
// not that fix.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const CZ = -103, EAST = Math.PI / 2;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

for (const x of [59.9, 60.0, 60.1, 60.2, 60.25, 60.3, 60.4]) {
  await p.evaluate(([a, c, y]) => window.__ct.warp(a, c, y, 0.14, 0), [x, CZ, EAST]);
  await p.evaluate(() => window.__ct.clock(13, 0));
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const ct = window.__ct;
    const c = document.querySelector('canvas');
    const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
    g.getContext('2d').drawImage(c, 0, 0);
    const d = g.getContext('2d').getImageData(0, 0, g.width, g.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 12 && d[i + 1] < 12 && d[i + 2] < 12) n++;
    // how many meshes does the renderer still consider visible?
    const s = ct.scene(); let vis = 0;
    s.traverse((o) => { if (o.isMesh && o.visible) vis++; });
    let info = null;
    try { info = ct.cullInfo ? ct.cullInfo() : null; } catch (e) { info = String(e); }
    return { pct: (100 * n) / (d.length / 4), vis, info };
  });
  console.log(`x=${x.toFixed(2)}  near-black ${r.pct.toFixed(1)}%  visible meshes ${r.vis}  cullInfo ${JSON.stringify(r.info)}`);
}
await b.close();
