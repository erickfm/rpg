// THE TOP OF THE AD IS NOT CUT OFF — item 119, the user's *"make sure the top
// of the ad isnt getting cut off by the tv. we can reduce the bezel a little
// bit"* (2026-08-02).
//
// This is the guard the comment in apartment.ts points at. It asserts the two
// halves of the fix independently, because either one alone can rot:
//
//   1. GEOMETRY — from the REAL seated eye, march all 48 canvas rows down the
//      real screen and ask the real bezel meshes which rows they occlude. The
//      occluded band must fit inside the declared safe area. Deepen the rails,
//      move the seat, or raise the set and this goes red.
//   2. CONTENT — sit through the whole 27-spot pack and require every spot to
//      report `minRow >= safe.t`. apartment.ts publishes `minRow` (the topmost
//      row any GLYPH pixel was drawn at, per paint) and `safe`, so neither
//      number is retyped here.
//
// Backgrounds are ALLOWED to bleed past the safe area — a full-width accent
// bar loses nothing by being trimmed. Only ink is checked, which is why the
// witness lives in the glyph writer and not in a pixel scan.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/w48-tv-title-safe.mjs [--selftest]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4190/');
const SELFTEST = flags(['--selftest']).selftest;
const OUT = 'shots/w48-tv';
mkdirSync(OUT, { recursive: true });

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);

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
ok(!!seat, 'the world offers the seat the ads are watched from');
if (!seat) { await browser.close(); process.exit(3); }

// ── get seated, for real ─────────────────────────────────────────────────
// The bed carries a "sleep until morning" spot too and it wins the pick from
// about half the squares around it, so the standing square is SWEPT FOR
// rather than derived from the seat's own coordinates (see K-tv-off-unless-
// seated.mjs, which learned this the hard way).
let stand = null;
for (let dx = -1.4; dx <= 1.4 && !stand; dx += 0.35) {
  for (let dz = -1.4; dz <= 1.4 && !stand; dz += 0.35) {
    await at(seat.x + dx, seat.z + dz, Math.atan2(-dx, dz));
    await settled();
    const p = await prompt();
    if (p && /sit on the bed/i.test(p)) stand = { x: seat.x + dx, z: seat.z + dz };
  }
}
ok(!!stand, stand ? `a player can reach the seat (standing at ${stand.x.toFixed(2)}, ${stand.z.toFixed(2)})`
  : 'NO square around the bed offers the seat');
if (!stand) { await browser.close(); process.exit(1); }

await page.keyboard.down('e');
await page.waitForFunction(() => !!window.__ct.seated(), null, { timeout: 8000 }).catch(() => {});
await page.keyboard.up('e');
ok(!!(await page.evaluate(() => window.__ct.seated())), 'pressing E sits you down');
await page.waitForFunction(() => window.__ct.scene().userData?.tv?.on === true, null, { timeout: 8000 }).catch(() => {});
ok((await page.evaluate(() => window.__ct.scene().userData?.tv?.on)) === true, 'the set comes on');

const safe = await page.evaluate(() => window.__ct.scene().userData?.tv?.safe ?? null);
ok(!!safe, safe ? `the set declares its safe area: top ${safe.t}, bottom ${safe.b}, of ${safe.rows} rows`
  : 'the set does not publish a safe area — nothing to enforce');
if (!safe) { await browser.close(); process.exit(3); }

if (SELFTEST) {
  // THE MUTATION. Shove the surround 0.05 m further out from the glass — the
  // exact regression this guard exists to catch, and the shape the bug had
  // before it was fixed. Both halves must go red: the geometry directly, and
  // `minRow` via a pinned slot, since the module replaces userData.tv wholesale
  // every frame and a pinned PROPERTY would be thrown away within 16 ms.
  await page.evaluate(() => {
    const sc = window.__ct.scene();
    const seatSpot = window.__ct.spots().find((s) => /sit on the bed/i.test(s.label));
    let screen = null, best = 1e9;
    sc.traverse((o) => {
      if (!o.isMesh || o.geometry.type !== 'PlaneGeometry') return;
      const gp = o.geometry.parameters || {};
      if (Math.abs(gp.width - 0.36) > 1e-6 || Math.abs(gp.height - 0.26) > 1e-6) return;
      const p = new o.position.constructor(); o.getWorldPosition(p);
      const d = Math.hypot(p.x - seatSpot.x, p.z - seatSpot.z);
      if (d < best) { best = d; screen = o; }
    });
    const sp = new screen.position.constructor(); screen.getWorldPosition(sp);
    sc.traverse((o) => {
      if (!o.isMesh || o === screen || o.geometry.type !== 'BoxGeometry') return;
      const p = new o.position.constructor(); o.getWorldPosition(p);
      if (Math.hypot(p.x - sp.x, p.y - sp.y, p.z - sp.z) > 0.5) return;
      if (p.y > sp.y) o.position.z += 0.05;         // push the top rail out
    });
    const ud = sc.userData;
    let held = ud.tv;
    Object.defineProperty(ud, 'tv', {
      configurable: true,
      get: () => ({ ...held, minRow: 0 }),
      set: (v) => { held = v; },
    });
  });
  console.log('      --selftest: top rail pushed 0.05 m proud, minRow pinned to 0');
}

// ── 1. GEOMETRY: which canvas rows does the bezel actually eat? ──────────
const band = await page.evaluate((seatSpot) => {
  const sc = window.__ct.scene();
  const V = (o) => { const p = new o.position.constructor(); o.updateWorldMatrix(true, false); o.getWorldPosition(p); return p; };
  let screen = null, best = 1e9;
  sc.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'PlaneGeometry') return;
    const gp = o.geometry.parameters || {};
    if (Math.abs(gp.width - 0.36) > 1e-6 || Math.abs(gp.height - 0.26) > 1e-6) return;
    const p = V(o);
    const d = Math.hypot(p.x - seatSpot.x, p.z - seatSpot.z);
    if (d < best) { best = d; screen = o; }
  });
  if (!screen) return null;
  const sp = V(screen);
  const { width: SW, height: SH } = screen.geometry.parameters;

  // every box within half a metre of the glass, as a world AABB. They are all
  // axis-aligned (the box() helper builds them with rotation 0) except the two
  // rabbit-ear antennae, which are excluded by being above the case anyway —
  // and a rotated box's AABB only ever OVER-reports occlusion, so a pass here
  // is still a pass.
  const boxes = [];
  sc.traverse((o) => {
    if (!o.isMesh || o === screen || o.geometry.type !== 'BoxGeometry') return;
    const p = V(o);
    if (Math.hypot(p.x - sp.x, p.y - sp.y, p.z - sp.z) > 0.5) return;
    const gp = o.geometry.parameters;
    boxes.push([p.x - gp.width / 2, p.x + gp.width / 2,
                p.y - gp.height / 2, p.y + gp.height / 2,
                p.z - gp.depth / 2, p.z + gp.depth / 2]);
  });

  const cam = window.__ct.camera();
  cam.updateWorldMatrix(true, false);
  const e = new cam.position.constructor(); cam.getWorldPosition(e);

  // segment/AABB slab test. The segment stops just short of the glass so the
  // dark well sitting 8 mm BEHIND it can never count as an occluder.
  const blocked = (tx, ty, tz) => {
    const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z;
    for (const [x0, x1, y0, y1, z0, z1] of boxes) {
      let t0 = 0, t1 = 0.999;
      let bad = false;
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
  // canvas row 0 is the TOP of the plane: a CanvasTexture has flipY, so image
  // row 0 lands at v=1.
  const rowY = (r) => sp.y + SH / 2 - ((r + 0.5) / ROWS) * SH;
  const colX = (c) => sp.x - SW / 2 + ((c + 0.5) / COLS) * SW;
  const rowBlocked = (r) => {
    for (const c of [1, 16, 32, 48, 62]) if (blocked(colX(c), rowY(r), sp.z)) return true;
    return false;
  };
  let top = 0; while (top < ROWS && rowBlocked(top)) top++;
  let bot = 0; while (bot < ROWS && rowBlocked(ROWS - 1 - bot)) bot++;
  // sides, measured down the middle of the picture
  const colBlocked = (c) => blocked(colX(c), rowY(Math.floor(ROWS / 2)), sp.z);
  let left = 0; while (left < COLS && colBlocked(left)) left++;
  let right = 0; while (right < COLS && colBlocked(COLS - 1 - right)) right++;
  return {
    top, bot, left, right, boxes: boxes.length,
    eye: [+e.x.toFixed(3), +e.y.toFixed(3), +e.z.toFixed(3)],
    screen: [+sp.x.toFixed(3), +sp.y.toFixed(3), +sp.z.toFixed(3)],
    dy: +(e.y - sp.y).toFixed(4), dz: +(e.z - sp.z).toFixed(4),
  };
}, seat);

ok(!!band, 'the glass and the surround can both be found in the world');
if (!band) { await browser.close(); process.exit(3); }
console.log(`      eye ${band.eye} -> glass ${band.screen}  (${band.dy} m above, ${band.dz} m out, ${band.boxes} boxes tested)`);
console.log(`      occluded rows: top ${band.top}, bottom ${band.bot}; columns: left ${band.left}, right ${band.right}`);
ok(band.top <= safe.t, `the bezel eats ${band.top} row(s) off the top; the safe area reserves ${safe.t}`);
ok(band.bot <= safe.b, `the bezel eats ${band.bot} row(s) off the bottom; the safe area reserves ${safe.b}`);
ok(band.left === 0 && band.right === 0,
  `the sides are clear (the seat is dead centre of the set, so there is no horizontal parallax) — left ${band.left}, right ${band.right}`);

// ── 2. CONTENT: sit through the whole pack ──────────────────────────────
// The bag deals all of them before it reshuffles, so watching until every
// index has been seen covers the pool exactly once. `secs * 1.4` each, so this
// is the slow part and it is bounded by the pack, not by a sleep.
const pool = await page.evaluate(() => window.__ct.scene().userData?.tv?.pool ?? 0);
const seen = new Map();
const deadline = Date.now() + 240000;
while (seen.size < pool && Date.now() < deadline) {
  const s = await page.evaluate(() => {
    const t = window.__ct.scene().userData?.tv;
    return t ? { i: t.i, seg: t.seg, fmt: t.fmt, minRow: t.minRow, warming: t.warming } : null;
  });
  if (s && !s.warming && s.minRow !== undefined) {
    const prev = seen.get(s.i);
    // keep the WORST row this spot ever drew at: a list ticks its bullets on
    // over time and a demo animates, so one sample is not the whole spot
    if (!prev || s.minRow < prev.minRow) seen.set(s.i, s);
  }
  await page.waitForTimeout(120);
}
ok(seen.size === pool, `watched all ${pool} spots (saw ${seen.size})`);
const cut = [...seen.values()].filter((s) => s.minRow < safe.t).sort((a, b) => a.minRow - b.minRow);
for (const s of cut) console.log(`      CUT  ${s.seg} (${s.fmt}) drew ink at row ${s.minRow}, safe top is ${safe.t}`);
ok(cut.length === 0, `no spot paints ink above the safe line (${cut.length} of ${seen.size} do)`);
const worst = [...seen.values()].sort((a, b) => a.minRow - b.minRow)[0];
if (worst) console.log(`      tightest spot: ${worst.seg} (${worst.fmt}) at row ${worst.minRow}`);

await page.screenshot({ path: `${OUT}/seated.png` });

if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); }
ok(errors.length === 0, 'no page errors');

await browser.close();
if (SELFTEST) {
  const caught = fails.length > 0;
  console.log(caught ? 'SELFTEST: caught the deepened bezel and the pinned witness'
                     : 'SELFTEST: NOT CAUGHT — this check is decoration');
  process.exit(caught ? 0 : 2);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
