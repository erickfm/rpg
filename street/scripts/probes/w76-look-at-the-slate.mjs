// One-shot (item 213): LOOK at the rebuilt casino ad. w48-tv-title-safe says the
// glyphs clear the bezel; it cannot say whether the copy READS. So sit on the
// bed in 301, wait for the orpheus slate to come round, and grab the 64x48 TV
// canvas at 8x so a human can read it.
//   SHOT_URL=http://localhost:4320/ node scripts/probes/w76-look-at-the-slate.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const URL = process.env.SHOT_URL ?? (() => { throw new Error('SHOT_URL required — GOTCHAS 50'); })();
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(600);

const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const at = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, 0), [x, z, yaw]);

const seat = await p.evaluate(() => window.__ct.spots().find((s) => /sit on the bed/i.test(s.label)) ?? null);
if (!seat) { console.error('no bed seat'); await b.close(); process.exit(2); }
// swept for, not derived — the bed also carries a "sleep" spot that wins about
// half the squares around it (w48-tv-title-safe learned this the hard way)
let stand = null;
for (let dx = -1.4; dx <= 1.4 && !stand; dx += 0.35) {
  for (let dz = -1.4; dz <= 1.4 && !stand; dz += 0.35) {
    await at(seat.x + dx, seat.z + dz, Math.atan2(-dx, dz));
    await p.waitForTimeout(120);
    const q = await prompt();
    if (q && /sit on the bed/i.test(q)) stand = true;
  }
}
if (!stand) { console.error('could not reach the seat'); await b.close(); process.exit(2); }
await p.keyboard.down('e');
await p.waitForFunction(() => !!window.__ct.seated(), null, { timeout: 8000 }).catch(() => {});
await p.keyboard.up('e');
await p.waitForFunction(() => window.__ct.scene().userData?.tv?.on === true, null, { timeout: 8000 }).catch(() => {});
console.log('seated:', await p.evaluate(() => !!window.__ct.seated()), ' set on:', await p.evaluate(() => window.__ct.scene().userData?.tv?.on));

// The screen is the ONE PlaneGeometry of 0.36 x 0.26 (w48-tv-title-safe:139).
// Grab its material map and blow it up 8x with smoothing off.
const grab = () => p.evaluate(() => {
  const sc = window.__ct.scene();
  let screen = null;
  sc.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'PlaneGeometry') return;
    const gp = o.geometry.parameters || {};
    if (Math.abs(gp.width - 0.36) > 1e-6 || Math.abs(gp.height - 0.26) > 1e-6) return;
    screen = o;
  });
  const m = screen && (Array.isArray(screen.material) ? screen.material[0] : screen.material);
  const img = m?.map?.image;
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = 64 * 8; c.height = 48 * 8;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, c.width, c.height);
  const seg = sc.userData?.tv?.seg ?? null;
  return { seg, url: c.toDataURL('image/png') };
});

const want = process.argv[2] ?? 'orpheus';
let saved = 0;
for (let i = 0; i < 260 && saved < 6; i++) {
  await p.waitForTimeout(300);
  const s = await grab();
  if (!s) continue;
  if (s.seg && String(s.seg).includes(want)) {
    writeFileSync(`shots/w76-tv-${want}-${saved}.png`, Buffer.from(s.url.split(',')[1], 'base64'));
    console.log(`  frame ${saved}: seg="${s.seg}"`);
    saved++;
    await p.waitForTimeout(900);
  }
}
console.log(saved ? `wrote ${saved} shots/w76-tv-${want}-*.png` : `never saw a spot matching "${want}"`);
await b.close();
process.exit(saved ? 0 : 1);
