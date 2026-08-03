// IDENTIFY AND PHOTOGRAPH THE PALE SLIVER ON 301's FLOOR. Item 169.
//
// `w86-pale-slivers-everywhere.mjs` swept all 13 rooms for the shape and colour
// the user described and returned exactly ONE candidate:
//
//   apt301  PlaneGeometry 0.11 x 0.16 m, horizontal, at (199.85, 5.412, -16.5)
//           mean texture colour 0.796/0.775/0.695, 11x16 px, no module stamp
//
// It also settled something the desk had wrong: 301's floor is at y = 5.41, a
// third storey. The player's spawn is at y = 1.62 and is NOT in 301, so the six
// downward shots taken from spawn were photographing a different room's boards.
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-identify-301-sliver.mjs
import { chromium } from 'playwright';
import { installMats } from '../lib/materials.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await installMats(p);
await p.waitForTimeout(600);

const info = await p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const room = window.__ct.roomDims().find((q) => q.id === 'apt301');
  const out = { room, found: [] };
  S.traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
    if (Math.hypot(x - 199.85, z + 16.5) > 0.6 || Math.abs(y - 5.412) > 0.25) return;
    const chain = []; let q = o.parent;
    while (q && chain.length < 6) { chain.push(`${q.name || q.type}${q.userData?.mod ? `(mod=${q.userData.mod})` : ''}`); q = q.parent; }
    const m = window.__mats(o)[0];
    const img = m?.map?.image;
    let rows = null;
    if (img?.getContext) {
      const g = img.getContext('2d');
      const d = g.getImageData(0, 0, img.width, img.height).data;
      rows = [];
      for (let yy = 0; yy < img.height; yy++) {
        let s = '';
        for (let xx = 0; xx < img.width; xx++) {
          const i = (yy * img.width + xx) * 4;
          s += d[i + 3] < 90 ? '.' : (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) > 150 ? '#' : '+';
        }
        rows.push(s);
      }
    }
    out.found.push({
      at: [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)],
      geo: o.geometry?.type, par: o.geometry?.parameters,
      rot: [+o.rotation.x.toFixed(3), +o.rotation.y.toFixed(3), +o.rotation.z.toFixed(3)],
      userData: o.userData, name: o.name, chain,
      mat: { col: m?.color ? '#' + m.color.getHexString() : null, side: m?.side, transparent: m?.transparent, alphaTest: m?.alphaTest, tex: img ? [img.width, img.height] : null },
      texArt: rows,
    });
  });
  return out;
});
console.log('\napt301 roomDims:', JSON.stringify(info.room));
for (const f of info.found) {
  console.log(`\n  ${f.geo} ${JSON.stringify(f.par)}`);
  console.log(`  at ${JSON.stringify(f.at)} rot ${JSON.stringify(f.rot)} userData ${JSON.stringify(f.userData)}`);
  console.log(`  parents: ${f.chain.join(' < ')}`);
  console.log(`  mat: ${JSON.stringify(f.mat)}`);
  if (f.texArt) { console.log('  texture (# bright, + dark, . clear):'); for (const rw of f.texArt) console.log('      ' + rw); }
}

// GO AND LOOK. Warping across a storey needs the settle GOTCHAS 51 names.
await p.evaluate(() => window.__ct.clock(12, 0));
await p.waitForTimeout(700);
const R = info.room;
for (const [tag, x, z, yaw, pitch] of [
  ['overhead', 199.85, -16.5, 0, -1.45],
  ['standing', R.cx, R.cz, Math.atan2(199.85 - R.cx, -(-16.5 - R.cz)), -0.85],
  ['roomwide', R.cx, R.cz, 0, -0.9],
]) {
  await p.evaluate(([x, z, y, pi, gy]) => window.__ct.warp(x, z, y, gy, pi), [x, z, yaw, pitch, R.y + 1.62]);
  await p.waitForTimeout(1800);                    // storey change, GOTCHAS 51
  await waitPainted(p, { quiet: true });
  await p.screenshot({ path: `shots/w86-301-sliver-${tag}.png` });
  const pr = await p.evaluate(() => window.__ct.pos());
  console.log(`  shot ${tag} -> shots/w86-301-sliver-${tag}.png   actually stood at ${JSON.stringify(pr)}`);
}
await b.close();
