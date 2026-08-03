// What does the SCENE actually hold at each of the twelve doors, inside and
// out? Asked of the world rather than of the source, because the source is
// twelve files and the question is "what did they all end up building".
//
// This exists to size up an ASSERTION before writing one: a check that can
// false-red is worse than no check (GOTCHAS 58), and half the "defects" on this
// project have been the instrument. So: look at all twelve first.
//
// Run: SHOT_URL=http://localhost:4184/ node scripts/probes/w56-leafscan.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? (() => { throw new Error('SHOT_URL required'); })();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1000);

const out = await p.evaluate(() => {
  const NAME = {
    bank: 'FIRST FEDERAL', bodega: 'BODEGA', burger: 'BURGER BARN', casino: 'SEVENS',
    church: 'ST BRIGID', diner: 'DINER', hotel: 'HOTEL ORPHEUS', jail: 'JAIL',
    library: 'LIBRARY', pawn: 'PAWN', tax: 'A-1 TAX', thrift: 'THRIFT',
  };
  const scene = window.__ct.scene();
  const dims = window.__ct.roomDims();
  const doors = window.__ct.doors();
  const all = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    // an ancestor hidden hides this too
    for (let a = o.parent; a; a = a.parent) if (!a.visible) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    const g = o.geometry;
    const P = g?.parameters ?? {};
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const img = mat?.map?.image;
    let base = null;
    if (img && img.getContext) {
      try {
        const d = img.getContext('2d', { willReadFrequently: true }).getImageData(1, 1, 1, 1).data;
        base = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      } catch { /* not readable */ }
    }
    all.push({
      type: g?.type ?? '?', x: e[12], y: e[13], z: e[14],
      w: P.width ?? null, h: P.height ?? null, d: P.depth ?? null,
      tex: img ? `${img.width}x${img.height}` : null, base,
    });
  });
  // A DOOR LEAF, as a shape: tall enough to walk through, narrow enough not to
  // be a facade, standing on the floor, and carrying a texture of its own.
  const leafish = (m) => {
    const tall = Math.max(m.h ?? 0, 0);
    const wide = Math.max(m.w ?? 0, m.d ?? 0);
    return m.tex && tall >= 1.8 && tall <= 4.0 && wide >= 0.35 && wide <= 3.0
      && m.y > 0.5 && m.y < 2.4;
  };
  const near = (cx, cz, r) => all.filter((m) => Math.hypot(m.x - cx, m.z - cz) < r && leafish(m));
  const rows = [];
  for (const [id, nm] of Object.entries(NAME)) {
    const rd = dims.find((d) => d.id === id);
    const dd = doors.find((d) => d.building === nm);
    const ins = rd ? near(rd.cx + (rd.door?.x ?? 0), rd.cz + rd.d / 2, 2.4) : [];
    const ext = dd ? near(dd.point.x, dd.point.z, 2.4) : [];
    rows.push({ id, nm, ins, ext });
  }
  return rows;
});

for (const r of out) {
  console.log(`\n── ${r.id.padEnd(8)} ${r.nm}`);
  const show = (label, list) => {
    if (!list.length) { console.log(`   ${label}  (none)`); return; }
    for (const m of list) {
      console.log(`   ${label}  ${m.type.padEnd(13)} `
        + `${(m.w ?? 0).toFixed(2)}w x ${(m.h ?? 0).toFixed(2)}h x ${(m.d ?? 0).toFixed(2)}d  `
        + `tex ${String(m.tex).padEnd(7)} base ${m.base ?? '-'}`);
    }
  };
  show('IN ', r.ins);
  show('OUT', r.ext);
}
await b.close();
