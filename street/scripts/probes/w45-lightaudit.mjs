// w45 / item 95 — WHAT ACTUALLY CATCHES LAMPLIGHT, measured rather than read.
//
// The desk's diagnosis is that there are four private lamp registries and that
// anything which never signed up is never lit. Before building on that, measure
// the world: for every mesh standing near a street lamp, record its DAYLIGHT
// colour and its 23:00 colour, and report the ratio.
//
// A surface a lamp is holding up reads ~1.0. A surface that only gets the
// ambient night floor reads ~0.05. There is no middle ground to misread.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w45-lightaudit.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { setClock, setNight } from '../lib/clock.mjs';

const URL = aim('http://localhost:4189/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

// Every lamp head in the world, from the geometry rather than from a list I
// would otherwise have to retype (BUILDER-BRIEF §8).
const lamps = await page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData && o.userData.lampPart === 'lens') {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      out.push({ x: +e[12].toFixed(2), y: +e[13].toFixed(2), z: +e[14].toFixed(2) });
    }
  });
  return out;
});
console.log(`lamp lenses found: ${lamps.length}`);
console.log(lamps.slice(0, 12).map((l) => `  (${l.x}, ${l.z})`).join('\n'));

// SAMPLE: every mesh whose plan-box comes within RADIUS of the chosen lamp.
// Keyed by material uuid so day and night can be paired exactly.
const sample = async (label) => page.evaluate(({ lx, lz, R }) => {
  const rows = [];
  const seen = new Set();
  // A mesh's world plan-box, without THREE in scope: transform the 8 corners of
  // the geometry's own bounding box by matrixWorld by hand.
  const planBox = (o) => {
    const g = o.geometry;
    if (!g) return null;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox;
    if (!b || !isFinite(b.min.x)) return null;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const px = (i & 1) ? b.max.x : b.min.x;
      const py = (i & 2) ? b.max.y : b.min.y;
      const pz = (i & 4) ? b.max.z : b.min.z;
      const wx = e[0] * px + e[4] * py + e[8] * pz + e[12];
      const wy = e[1] * px + e[5] * py + e[9] * pz + e[13];
      const wz = e[2] * px + e[6] * py + e[10] * pz + e[14];
      if (wx < x0) x0 = wx; if (wx > x1) x1 = wx;
      if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
      if (wz < z0) z0 = wz; if (wz > z1) z1 = wz;
    }
    return { x0, x1, y0, y1, z0, z1 };
  };
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const box = planBox(o);
    if (!box) return;
    // nearest point of the mesh's plan box to the lamp
    const qx = Math.min(Math.max(lx, box.x0), box.x1);
    const qz = Math.min(Math.max(lz, box.z0), box.z1);
    const d = Math.hypot(qx - lx, qz - lz);
    if (d > R) return;
    const wp = { y: (box.y0 + box.y1) / 2 };
    for (const m of mats) {
      if (!m || !m.color) continue;
      if (seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      rows.push({
        uuid: m.uuid,
        name: o.name || o.parent?.name || o.type,
        d: +d.toFixed(2),
        y: +wp.y.toFixed(2),
        span: o.userData.poolSpan !== undefined ? +o.userData.poolSpan.toFixed(2) : null,
        sizeW: o.userData.sizeW !== undefined ? +o.userData.sizeW.toFixed(3) : null,
        graded: !!m.userData.graded,
        poolLit: !!m.userData.poolLit,
        selfLit: !!m.userData.selfLit,
        noLight: !!m.userData.noLight,
        additive: m.blending === 2,          // THREE.AdditiveBlending
        planW: +Math.max(box.x1 - box.x0, box.z1 - box.z0).toFixed(2),
        lum: +(0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b).toFixed(4),
      });
    }
  });
  return rows;
}, arg);

// Pick the main-street lamp nearest the origin — the stretch in the screenshot.
const lamp = lamps
  .filter((l) => Math.abs(l.x) < 12)
  .sort((a, b) => Math.abs(a.z + 20) - Math.abs(b.z + 20))[0] ?? lamps[0];
console.log(`\nusing lamp at (${lamp.x}, ${lamp.z})`);
const arg = { lx: lamp.x, lz: lamp.z, R: 4.5 };

await setClock(page, 13, 0);
await page.waitForTimeout(400);
const day = await sample('day');

await setNight(page, 23, 0);
const night = await sample('night');

const dayBy = new Map(day.map((r) => [r.uuid, r]));
const rows = night.map((n) => ({ ...n, dayLum: dayBy.get(n.uuid)?.lum ?? null }))
  .map((r) => ({ ...r, ratio: r.dayLum ? +(r.lum / r.dayLum).toFixed(4) : null }))
  .sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1));

const pad = (s, n) => String(s).slice(0, n).padEnd(n);
console.log(`\n${pad('mesh', 26)} ${pad('d', 6)} ${pad('y', 6)} ${pad('span', 7)} ${pad('sizeW', 7)} ${pad('night/day', 10)} flags`);
for (const r of rows) {
  const flags = [r.graded && 'graded', r.poolLit && 'POOLLIT', r.selfLit && 'selfLit',
                 r.noLight && 'noLight', r.additive && 'additive'].filter(Boolean).join(',');
  console.log(`${pad(r.name, 26)} ${pad(r.d, 6)} ${pad(r.y, 6)} ${pad(r.span ?? '-', 7)} ${pad(r.sizeW ?? '-', 7)} ${pad(r.ratio ?? '-', 10)} ${flags}`);
}

const lit = rows.filter((r) => r.ratio !== null && r.ratio > 0.5 && !r.additive);
const dark = rows.filter((r) => r.ratio !== null && r.ratio <= 0.2 && !r.additive);
console.log(`\nwithin ${arg.R} m of a lamp head, excluding additive light sheets:`);
console.log(`  held up by the lamp (night/day > 0.5): ${lit.length}`);
console.log(`  at the night floor  (night/day <= 0.2): ${dark.length}`);
console.log(`\ndark ones, which is the bug if any of them is ground or a car:`);
for (const r of dark) console.log(`  ${pad(r.name, 26)} d=${r.d} span=${r.span} sizeW=${r.sizeW} ratio=${r.ratio}`);

await browser.close();
