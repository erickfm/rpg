// w45 / item 95 — NAME the surfaces that stay dark under a lamp.
//
// w45-lightaudit.mjs showed 38 materials at the night floor within 4.5 m of a
// lamp head and 9 held up. This one says WHAT they are: geometry type and
// parameters, daylight colour, and which registration path they took.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w45-whatisdark.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { setClock, setNight } from '../lib/clock.mjs';

const URL = aim('http://localhost:4189/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const lamps = await page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData && o.userData.lampPart === 'lens') {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      out.push({ x: +e[12].toFixed(2), z: +e[14].toFixed(2) });
    }
  });
  return out;
});
const lamp = lamps.filter((l) => Math.abs(l.x) < 12)
  .sort((a, b) => Math.abs(a.z + 20) - Math.abs(b.z + 20))[0] ?? lamps[0];
console.log(`lamp at (${lamp.x}, ${lamp.z}), of ${lamps.length} in the world\n`);

const sample = () => page.evaluate(({ lx, lz, R }) => {
  const rows = []; const seen = new Set();
  const planBox = (o) => {
    const g = o.geometry; if (!g) return null;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox; if (!b || !isFinite(b.min.x)) return null;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const px = (i & 1) ? b.max.x : b.min.x, py = (i & 2) ? b.max.y : b.min.y, pz = (i & 4) ? b.max.z : b.min.z;
      const wx = e[0] * px + e[4] * py + e[8] * pz + e[12];
      const wy = e[1] * px + e[5] * py + e[9] * pz + e[13];
      const wz = e[2] * px + e[6] * py + e[10] * pz + e[14];
      if (wx < x0) x0 = wx; if (wx > x1) x1 = wx;
      if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
      if (wz < z0) z0 = wz; if (wz > z1) z1 = wz;
    }
    return { x0, x1, y0, y1, z0, z1 };
  };
  // walk up the parents for anything that names this thing
  const trail = (o) => {
    const parts = [];
    for (let p = o; p; p = p.parent) {
      if (p.name) parts.push(p.name);
      const u = p.userData || {};
      for (const k of ['lampPart', 'kind', 'carKind', 'probe', 'role', 'tag'])
        if (u[k] !== undefined) parts.push(`${k}=${u[k]}`);
    }
    return parts.slice(0, 4).join('<') || '(anonymous)';
  };
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const box = planBox(o); if (!box) return;
    const qx = Math.min(Math.max(lx, box.x0), box.x1), qz = Math.min(Math.max(lz, box.z0), box.z1);
    const d = Math.hypot(qx - lx, qz - lz);
    if (d > R) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g = o.geometry;
    const par = g.parameters
      ? Object.entries(g.parameters).filter(([, v]) => typeof v === 'number')
          .map(([k, v]) => `${k[0]}${(+v).toFixed(1)}`).join(' ')
      : '';
    for (const m of mats) {
      if (!m || !m.color || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      rows.push({
        uuid: m.uuid, who: trail(o), geo: `${g.type.replace('Geometry', '')}(${par})`,
        d: +d.toFixed(2), y: +((box.y0 + box.y1) / 2).toFixed(2),
        w: +(box.x1 - box.x0).toFixed(1), l: +(box.z1 - box.z0).toFixed(1),
        span: o.userData.poolSpan !== undefined ? +o.userData.poolSpan.toFixed(1) : null,
        sizeW: o.userData.sizeW !== undefined ? +o.userData.sizeW.toFixed(2) : null,
        graded: !!m.userData.graded, poolLit: !!m.userData.poolLit,
        selfLit: !!m.userData.selfLit, noLight: !!m.userData.noLight,
        additive: m.blending === 2,
        hex: '#' + m.color.getHexString(),
        lum: +(0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b).toFixed(4),
      });
    }
  });
  return rows;
}, { lx: lamp.x, lz: lamp.z, R: 4.5 });

await setClock(page, 13, 0); await page.waitForTimeout(400);
const day = await sample();
await setNight(page, 23, 0);
const night = await sample();

const dayBy = new Map(day.map((r) => [r.uuid, r]));
const rows = night.map((n) => {
  const d = dayBy.get(n.uuid);
  return { ...n, dayHex: d?.hex ?? '?', ratio: d?.lum ? +(n.lum / d.lum).toFixed(3) : null };
}).filter((r) => !r.additive).sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1));

const pad = (s, n) => String(s).slice(0, n).padEnd(n);
console.log(`${pad('what', 22)} ${pad('geometry', 26)} ${pad('d', 5)} ${pad('y', 6)} ${pad('WxL', 12)} ${pad('span', 6)} ${pad('sizeW', 6)} ${pad('day', 8)} ${pad('n/d', 7)} path`);
for (const r of rows) {
  const path = r.span === null ? 'lit() or unregistered' : 'dimWorld';
  const fl = [r.poolLit && 'POOLLIT', r.selfLit && 'selfLit', r.noLight && 'noLight'].filter(Boolean).join(',');
  console.log(`${pad(r.who, 22)} ${pad(r.geo, 26)} ${pad(r.d, 5)} ${pad(r.y, 6)} ${pad(`${r.w}x${r.l}`, 12)} ${pad(r.span ?? '-', 6)} ${pad(r.sizeW ?? '-', 6)} ${pad(r.dayHex, 8)} ${pad(r.ratio ?? '-', 7)} ${path} ${fl}`);
}
await browser.close();
