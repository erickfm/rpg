// w49 / item 114 — WHERE IS EVERY TRANSLUCENT PLANE IN THIS WORLD?
//
// The user, five times now: "shadow fence still here. shadow geometry in
// general needs to be removed." Every previous pass fixed a SUBSET — the last
// one (2d3eba3f7) was scoped to flat GROUND quads, and the plane in his latest
// frame is VERTICAL, so that audit could not have seen it.
//
// So this does not look for ground quads, or for a name, or for a file. It
// walks the built scene and reports EVERY mesh carrying a transparent material,
// classified by the only thing that matters for "does it read as a ghost":
//
//   thin axis  — a plane is a box/plane with one near-zero dimension.
//                thin axis Y  -> it lies on the ground (a decal)
//                thin axis X/Z -> it STANDS UP (the user's "shadow fence")
//   opacity    — how ghostly
//   graded     — did props.ts's dimWorld actually touch it (userData.graded)
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w49-translucent-sweep.mjs [hour]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';

const URL = aim('http://localhost:4193/');
const hour = Number(process.argv[2] ?? 13);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 20000 });
await setClock(page, hour, 0);

const rows = await page.evaluate(() => {
  const scene = window.__ct.scene();
  const out = [];
  scene.updateMatrixWorld(true);

  // THREE is not exposed on the page, so the world bbox is computed here from
  // the geometry's own local box and the object's matrixWorld. Eight corners,
  // transformed, min/max — which is exactly what Box3.setFromObject does, and
  // doing it by hand costs nothing and needs no import.
  const worldBox = (o) => {
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox;
    if (!b || !isFinite(b.min.x)) return null;
    const e = o.matrixWorld.elements;
    const lo = { x: Infinity, y: Infinity, z: Infinity };
    const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (let i = 0; i < 8; i++) {
      const x = (i & 1) ? b.max.x : b.min.x;
      const y = (i & 2) ? b.max.y : b.min.y;
      const z = (i & 4) ? b.max.z : b.min.z;
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      lo.x = Math.min(lo.x, wx); hi.x = Math.max(hi.x, wx);
      lo.y = Math.min(lo.y, wy); hi.y = Math.max(hi.y, wy);
      lo.z = Math.min(lo.z, wz); hi.z = Math.max(hi.z, wz);
    }
    return { min: lo, max: hi };
  };

  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const tm = mats.filter((m) => m && m.transparent === true);
    if (!tm.length) return;

    // world-space bbox: the only orientation-truthful measure. A PlaneGeometry
    // rotated flat and a BoxGeometry 0.02 m thick are the same defect, and only
    // the world bbox says so.
    const box = worldBox(o);
    if (!box) return;
    const d = { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z };

    // name the chain — a bare mesh name is usually '' in this world
    const chain = [];
    for (let p = o; p; p = p.parent) if (p.name) chain.push(p.name);

    out.push({
      name: o.name || '',
      chain: chain.join('<'),
      geo: o.geometry.type,
      gp: o.geometry.parameters
        ? Object.entries(o.geometry.parameters)
            .filter(([k]) => /width|height|depth|radius/i.test(k))
            .map(([k, v]) => `${k}=${typeof v === 'number' ? +v.toFixed(3) : v}`).join(',')
        : '',
      dx: +d.x.toFixed(3), dy: +d.y.toFixed(3), dz: +d.z.toFixed(3),
      cx: +((box.min.x + box.max.x) / 2).toFixed(2),
      cy: +((box.min.y + box.max.y) / 2).toFixed(2),
      cz: +((box.min.z + box.max.z) / 2).toFixed(2),
      vis: o.visible,
      mats: tm.map((m) => ({
        op: +(m.opacity ?? 1).toFixed(3),
        col: '#' + m.color?.getHexString?.(),
        map: !!m.map,
        blend: m.blending,             // 1 = Normal, 2 = Additive
        depthWrite: m.depthWrite,
        side: m.side,
        graded: !!m.userData?.graded,
        noLight: !!m.userData?.noLight,
        mname: m.name || '',
      })),
    });
  });
  return out;
});

await browser.close();
if (errors.length) console.error('PAGE ERRORS:', errors.slice(0, 3));

// ── classify ──────────────────────────────────────────────────────────────
// "plane" = one dimension under 0.12 m against the other two over 0.25 m.
// Anything failing that is a solid (glass box, bulb sphere, foliage cluster).
const THIN = 0.12, BIG = 0.25;
const cls = (r) => {
  const d = [['x', r.dx], ['y', r.dy], ['z', r.dz]].sort((a, b) => a[1] - b[1]);
  const [ta, tv] = d[0];
  if (tv > THIN || d[1][1] < BIG || d[2][1] < BIG) return { kind: 'solid', axis: ta };
  return { kind: ta === 'y' ? 'FLAT (ground decal)' : 'STANDING (vertical sheet)', axis: ta };
};

const planes = [], solids = [];
for (const r of rows) (cls(r).kind === 'solid' ? solids : planes).push({ ...r, c: cls(r) });

// area of the sheet = product of the two big dims
const area = (r) => {
  const d = [r.dx, r.dy, r.dz].sort((a, b) => a - b);
  return +(d[1] * d[2]).toFixed(2);
};

planes.sort((a, b) => area(b) - area(a));

const fmt = (r) => {
  const m = r.mats[0];
  return [
    r.c.kind.padEnd(24),
    `A=${String(area(r)).padStart(7)}m2`,
    `${r.dx}x${r.dy}x${r.dz}`.padEnd(22),
    `@(${r.cx},${r.cy},${r.cz})`.padEnd(24),
    `op=${m.op}`.padEnd(9),
    m.map ? 'MAP ' : 'nomap',
    m.blend === 2 ? 'ADD ' : '    ',
    m.graded ? 'graded ' : 'UNGRADED',
    r.vis ? '' : ' [hidden]',
    ` ${r.geo}(${r.gp})`,
    ` ${r.chain || r.name}`,
  ].join(' ');
};

console.log(`\n=== ${rows.length} meshes carry a transparent material @${hour}:00 ===`);
console.log(`    ${planes.length} are PLANES (a sheet), ${solids.length} are solids\n`);

const standing = planes.filter((p) => p.c.kind.startsWith('STANDING'));
const flat = planes.filter((p) => p.c.kind.startsWith('FLAT'));

console.log(`--- ${standing.length} STANDING sheets — the user's "shadow fence" class ---`);
for (const r of standing) console.log(fmt(r));

console.log(`\n--- ${flat.length} FLAT sheets (ground decals) ---`);
for (const r of flat) console.log(fmt(r));

const ung = planes.filter((p) => !p.mats[0].graded && p.mats[0].blend !== 2);
console.log(`\n--- ${ung.length} planes NOT graded by dimWorld and NOT additive (stay bright at dusk) ---`);
for (const r of ung) console.log(fmt(r));
