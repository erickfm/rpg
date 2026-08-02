// LOOK AT ALL 27 SPOTS, from the seat, as the player sees them.
//
// The item says to check ALL of them and not one, because the formats put
// their content at different heights. So this sits down and photographs every
// spot in the pack.
//
// IT ZOOMS BY NARROWING THE FOV, NOT BY MOVING. The clipping under test is
// parallax from the eye's POSITION, so dollying in would destroy the very
// thing being photographed; dropping the field of view magnifies the picture
// and leaves the eye exactly where the seat put it.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/probes/w48-tvshots.mjs [--tag before]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4190/');
const TAG = (process.argv.find((a) => a.startsWith('--tag=')) || '--tag=after').split('=')[1];
const OUT = `shots/w48-tv/${TAG}`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
// RESOLUTION, NOT ZOOM. The set is 0.36 m of glass at 1.93 m through an 88deg
// lens, so it is about 10deg of picture — small. Narrowing the FOV would have
// been the obvious way to fill the frame and it DOES NOT WORK: the rig writes
// `cam.fov` every frame, so a probe's value is gone by the next render (the
// first pass here silently photographed an 88deg frame and then, once the
// crop was derived from the projected rect, threw "clipped area outside the
// image" because the set is 15.6deg below the eye line and a 14deg frame does
// not contain it at all). Rendering bigger costs nothing and moves nothing.
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 3 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const SPAWN = await page.evaluate(() => window.__ct.pos());
const ROOM_GY = SPAWN[3];
const at = (x, z, yaw = 0) => page.evaluate(([X, Z, Y, GY]) => window.__ct.warp(X, Z, Y, GY), [x, z, yaw, ROOM_GY]);
const prompt = () => page.evaluate(() => {
  const e = document.getElementById('ct-prompt');
  return e && e.style.display !== 'none' ? e.textContent : null;
});
const settled = async () => {
  let last = null;
  for (let i = 0; i < 25; i++) {
    const q = await page.evaluate(() => window.__ct.pos().map((n) => +n.toFixed(3)));
    if (last && q[0] === last[0] && q[2] === last[2] && q[3] === last[3]) return true;
    last = q; await page.waitForTimeout(90);
  }
  return false;
};

const seat = await page.evaluate(() => window.__ct.spots().find((s) => /sit on the bed/i.test(s.label)));
let stand = null;
for (let dx = -1.4; dx <= 1.4 && !stand; dx += 0.35) {
  for (let dz = -1.4; dz <= 1.4 && !stand; dz += 0.35) {
    await at(seat.x + dx, seat.z + dz, Math.atan2(-dx, dz));
    await settled();
    const p = await prompt();
    if (p && /sit on the bed/i.test(p)) stand = { x: seat.x + dx, z: seat.z + dz };
  }
}
await page.keyboard.down('e');
await page.waitForFunction(() => !!window.__ct.seated(), null, { timeout: 8000 }).catch(() => {});
await page.keyboard.up('e');
await page.waitForFunction(() => window.__ct.scene().userData?.tv?.on === true, null, { timeout: 8000 }).catch(() => {});

// Narrow the lens without moving the eye, and hand back WHERE THE GLASS LANDS
// in page pixels so the crop is derived rather than guessed. The camera's
// orientation is driven from the rig every frame, so `lookAt` does not stick —
// the projected rect does the aiming instead.
const aimAt = async () => page.evaluate((seatSpot) => {
  const sc = window.__ct.scene();
  const V = (o) => { const p = new o.position.constructor(); o.updateWorldMatrix(true, false); o.getWorldPosition(p); return p; };
  let screen = null, best = 1e9;
  sc.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'PlaneGeometry') return;
    const gp = o.geometry.parameters || {};
    if (Math.abs(gp.width - 0.36) > 1e-6 || Math.abs(gp.height - 0.26) > 1e-6) return;
    const p = V(o); const d = Math.hypot(p.x - seatSpot.x, p.z - seatSpot.z);
    if (d < best) { best = d; screen = o; }
  });
  const sp = V(screen);
  const cam = window.__ct.camera();
  cam.updateMatrixWorld(true);
  const { width: SW, height: SH } = screen.geometry.parameters;
  const W = window.innerWidth, H = window.innerHeight;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  // the CASE's corners, not the glass's — the point of the picture is to show
  // the surround and the picture together
  for (const dx of [-0.30, 0.30]) for (const dy of [-0.26, 0.26]) {
    const v = new sp.constructor(sp.x + dx, sp.y + dy, sp.z);
    v.project(cam);
    const px = (v.x * 0.5 + 0.5) * W, py = (-v.y * 0.5 + 0.5) * H;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px);
    y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0), W, H };
}, seat);

const pool = await page.evaluate(() => window.__ct.scene().userData.tv.pool);
const shot = new Set();
const deadline = Date.now() + 260000;
while (shot.size < pool && Date.now() < deadline) {
  const s = await page.evaluate(() => {
    const t = window.__ct.scene().userData.tv;
    return { i: t.i, seg: t.seg, fmt: t.fmt, warming: t.warming, minRow: t.minRow };
  });
  if (!s.warming && !shot.has(s.i)) {
    await page.waitForTimeout(450);            // let animated formats tick on
    const r = await aimAt();
    const clip = {
      x: Math.max(0, r.x), y: Math.max(0, r.y),
      width: Math.min(r.w, r.W - Math.max(0, r.x)),
      height: Math.min(r.h, r.H - Math.max(0, r.y)),
    };
    const name = `${String(s.i).padStart(2, '0')}-${s.fmt}-${s.seg.replace(/\W+/g, '-')}`;
    await page.screenshot({ path: `${OUT}/${name}.png`, clip });
    console.log(`${name}  minRow=${s.minRow}  clip ${clip.x},${clip.y} ${clip.width}x${clip.height}`);
    shot.add(s.i);
  }
  await page.waitForTimeout(110);
}
console.log(`\n${shot.size}/${pool} spots photographed into ${OUT}`);
await browser.close();
