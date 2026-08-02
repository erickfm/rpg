// w48 / item 119 — IS THE TOP OF THE AD CLIPPED, AND BY WHAT?
//
// The item offers two hypotheses and says to establish which before changing
// anything: (a) the bezel rails overlap the screen aperture, or (b) the ad
// canvas paints above a safe area and the bezel is innocent.
//
// This probe answers both from the world rather than from the source:
//   1. the rails' world AABBs vs the screen's world rect  -> (a) is arithmetic
//   2. from the SEATED eye, march every canvas row down the screen and ask
//      which rows the rails occlude -> the real, third answer
//
// NOTE the screen is found by SIZE AND PROXIMITY TO THE SEAT, not by "the
// 64x48 canvas": there is another 64x48 canvas in the world (a 1.9 x 1.25 m
// plane at x 1070) and the first version of this probe measured that instead.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/probes/w48-tvprobe.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4190/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

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

const seat = await page.evaluate(() => window.__ct.spots().find((s) => /sit on the bed/i.test(s.label)) ?? null);
console.log('SEAT', JSON.stringify(seat));

// ── everything within 1 m of the seat's line of sight to the wall ────────
const geo = await page.evaluate((seat) => {
  const sc = window.__ct.scene();
  const V = null;
  const out = { screen: null, near: [] };
  const mk = (o) => { const p = new o.position.constructor(); o.updateWorldMatrix(true, false); o.getWorldPosition(p); return p; };
  let screen = null, best = 1e9;
  sc.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    if (g.type !== 'PlaneGeometry') return;
    const gp = g.parameters || {};
    if (Math.abs(gp.width - 0.36) > 1e-6 || Math.abs(gp.height - 0.26) > 1e-6) return;
    const p = mk(o);
    const d = Math.hypot(p.x - seat.x, p.z - seat.z);
    if (d < best) { best = d; screen = o; }
  });
  if (!screen) return out;
  const sp = mk(screen);
  const map = screen.material && screen.material.map;
  out.screen = {
    params: screen.geometry.parameters,
    world: [+sp.x.toFixed(4), +sp.y.toFixed(4), +sp.z.toFixed(4)],
    rot: [+screen.rotation.x.toFixed(4), +screen.rotation.y.toFixed(4), +screen.rotation.z.toFixed(4)],
    canvas: map && map.image ? [map.image.width, map.image.height] : null,
    distToSeat: +best.toFixed(4),
  };
  sc.traverse((o) => {
    if (!o.isMesh || o === screen) return;
    const p = mk(o);
    const d = Math.hypot(p.x - sp.x, p.y - sp.y, p.z - sp.z);
    if (d > 0.5) return;
    const gp = o.geometry.parameters || {};
    out.near.push({
      type: o.geometry.type, w: gp.width, h: gp.height, dp: gp.depth,
      pos: [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)],
      rot: [+o.rotation.x.toFixed(3), +o.rotation.y.toFixed(3), +o.rotation.z.toFixed(3)],
      d: +d.toFixed(4),
    });
  });
  out.near.sort((a, b) => a.d - b.d);
  return out;
}, seat);
console.log('SCREEN', JSON.stringify(geo.screen));
console.log('NEAR MESHES (' + geo.near.length + '):');
for (const n of geo.near) console.log(' ', JSON.stringify(n));

// ── sit down, then read the eye ──────────────────────────────────────────
let stand = null;
for (let dx = -1.4; dx <= 1.4 && !stand; dx += 0.35) {
  for (let dz = -1.4; dz <= 1.4 && !stand; dz += 0.35) {
    await at(seat.x + dx, seat.z + dz, Math.atan2(-dx, dz));
    await settled();
    const p = await prompt();
    if (p && /sit on the bed/i.test(p)) stand = { x: seat.x + dx, z: seat.z + dz };
  }
}
console.log('STAND SQUARE', JSON.stringify(stand));
await page.keyboard.down('e');
await page.waitForFunction(() => !!window.__ct.seated(), null, { timeout: 6000 }).catch(() => {});
await page.keyboard.up('e');
console.log('seated?', await page.evaluate(() => !!window.__ct.seated()));
await page.waitForFunction(() => window.__ct.scene().userData?.tv?.on === true, null, { timeout: 6000 }).catch(() => {});

const eye = await page.evaluate(() => {
  const c = window.__ct.camera();
  c.updateWorldMatrix(true, false);
  const p = new c.position.constructor();
  c.getWorldPosition(p);
  return { pos: [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)], fov: c.fov };
});
console.log('SEATED EYE', JSON.stringify(eye));

// ── THE BAND, on ANY build ───────────────────────────────────────────────
// The same slab test the real check uses, but it does not need the world to
// publish a safe area — which is the whole point, because the BEFORE build
// does not publish one and this is how the before/after was measured.
const band = await page.evaluate((seatSpot) => {
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
  const { width: SW, height: SH } = screen.geometry.parameters;
  const boxes = [];
  sc.traverse((o) => {
    if (!o.isMesh || o === screen || o.geometry.type !== 'BoxGeometry') return;
    const p = V(o);
    if (Math.hypot(p.x - sp.x, p.y - sp.y, p.z - sp.z) > 0.5) return;
    const gp = o.geometry.parameters;
    boxes.push([p.x - gp.width / 2, p.x + gp.width / 2, p.y - gp.height / 2,
                p.y + gp.height / 2, p.z - gp.depth / 2, p.z + gp.depth / 2]);
  });
  const cam = window.__ct.camera(); cam.updateWorldMatrix(true, false);
  const e = new cam.position.constructor(); cam.getWorldPosition(e);
  const blocked = (tx, ty, tz) => {
    const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z;
    for (const [x0, x1, y0, y1, z0, z1] of boxes) {
      let t0 = 0, t1 = 0.999, bad = false;
      for (const [o, d, a, b] of [[e.x, dx, x0, x1], [e.y, dy, y0, y1], [e.z, dz, z0, z1]]) {
        if (Math.abs(d) < 1e-12) { if (o < a || o > b) { bad = true; break; } continue; }
        let ta = (a - o) / d, tb = (b - o) / d;
        if (ta > tb) { const s = ta; ta = tb; tb = s; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { bad = true; break; }
      }
      if (!bad) return true;
    }
    return false;
  };
  const ROWS = 48, COLS = 64;
  const rowY = (r) => sp.y + SH / 2 - ((r + 0.5) / ROWS) * SH;
  const colX = (c) => sp.x - SW / 2 + ((c + 0.5) / COLS) * SW;
  // sub-row resolution too, so the answer is not quantised to whole rows
  let fine = 0;
  while (fine < ROWS * 10 && blocked(colX(32), sp.y + SH / 2 - (fine / (ROWS * 10)) * SH, sp.z)) fine++;
  let top = 0;
  while (top < ROWS && [1, 16, 32, 48, 62].some((c) => blocked(colX(c), rowY(top), sp.z))) top++;
  let bot = 0;
  while (bot < ROWS && [1, 16, 32, 48, 62].some((c) => blocked(colX(c), rowY(ROWS - 1 - bot), sp.z))) bot++;
  return { top, bot, fineRows: +(fine / 10).toFixed(2), boxes: boxes.length };
}, seat);
console.log('OCCLUDED BAND', JSON.stringify(band));

await browser.close();
