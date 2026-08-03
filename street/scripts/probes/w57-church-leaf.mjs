// HOW BIG IS THE CHURCH'S DOOR, ON THE FACADE THAT ACTUALLY EXISTS?
//
// `ct/civic.ts` paints the west front's leaves inline — `#4a3524` between
// `yOf(4.4)` and `yOf(0.55)`, cut to a half-width that comes out of `archHW`
// after two roundings. I want the number the world DRAWS, not the number I get
// by re-running that arithmetic by hand: BUILDER-BRIEF §7, a script is a
// hypothesis and the source is the answer, and this reads the answer off the
// canvas the player is looking at.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w57-church-leaf.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const out = await page.evaluate(() => {
  const LEAF = [0x4a, 0x35, 0x24];            // ct/civic.ts:1181 — the leaf timber
  const seen = [];
  const scene = window.__ct.scene();
  // ASK THE SURFACE WHAT IT IS, rather than guessing from its pixel size.
  // `masonry()` stamps every wall it paints with `userData.masonry` — its own
  // ppm and the metres it was painted for (ct/tex-world.ts:192) — so the church
  // nave can be found by its dimensions instead of by a size threshold. The
  // first cut of this scanned every canvas over 200 px and found the leaf
  // timber on six OTHER facades' drainpipes.
  const stamped = new Map();
  scene.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const t = m?.map, ms = t?.userData?.masonry;
      if (t?.image && ms) stamped.set(t.image, ms);
    }
  });
  for (const [img, ms] of stamped) {
    // the west front: the only masonry face in the world over 14 m tall
    if (!(ms.hMeters >= 14 && ms.wMeters >= 9 && ms.wMeters <= 16)) continue;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const d = c.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (Math.abs(d[i] - LEAF[0]) < 3 && Math.abs(d[i + 1] - LEAF[1]) < 3 && Math.abs(d[i + 2] - LEAF[2]) < 3) {
        n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    // a solid block of it, not a stray pixel of grime
    if (n > 200) seen.push({ W: img.width, H: img.height, x0, x1, y0, y1, n, ms });
  }
  return seen;
});

console.log(`west-front candidates carrying a solid block of the leaf timber: ${out.length}`);
for (const s of out) {
  const ppm = s.ms.ppm;                       // the surface's OWN density, not a guess
  const w = (s.x1 - s.x0 + 1) / ppm, h = (s.y1 - s.y0 + 1) / ppm;
  console.log(`  ${s.W}x${s.H}px  ${s.ms.wMeters} x ${s.ms.hMeters} m at ${ppm} px/m`);
  console.log(`    leaf block x ${s.x0}..${s.x1} y ${s.y0}..${s.y1}  (${s.n} px)`);
  console.log(`    => ${w.toFixed(3)} m across (BOTH leaves), ${h.toFixed(3)} m tall`);
  console.log(`    => each leaf ${(w / 2).toFixed(3)} m`);
  console.log(`    => sill ${((s.H - 1 - s.y1) / ppm).toFixed(3)} m, head ${((s.H - 1 - s.y0) / ppm).toFixed(3)} m above the front's base`);
}
await browser.close();
