// HOW FAR AJAR IS EVERY INTERIOR FRONT DOOR LEAF — measured, per room.
//
// Item 159. The user, twice, in two buildings: *"jail interior front door also
// looks bad and doesnt match outside"*, *"inside door of the church is still
// mismatched from the doors outside."* Worker sixty read the SOURCE and listed
// five rooms hanging leaves ajar; this reads the WORLD, so the claim rests on
// what is built rather than on what five files say.
//
// It reports the leaf's world yaw, not its `rotation.y`, because two of the
// seven places that choose an angle use opposite sign conventions
// (`ct/interior.ts`'s kit swings -0.85, `ct/int-library.ts` swings +0.85) and a
// signed local number cannot be compared across them. The world normal can:
// a leaf standing shut in a wall on the room's +z face has normal +z, and
// |yaw| is how far it has swung whichever way it went.
//
// A SCAN THAT FINDS NOTHING IS NOT A PASS (GOTCHAS 34/71). The room count it
// actually measured is printed, and a room whose door it could not find is a
// MISS row rather than a silent absence.
//
// Run: SHOT_URL=http://localhost:4211/ node scripts/probes/w65-leaf-angles.mjs
// Exit: 0 measured · 2 the world could not be measured
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? (() => {
  throw new Error('SHOT_URL required — an instrument that defaults to a port is a silent wrong answer, GOTCHAS 50');
})();

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
// `__ct` publishes BEFORE the first frame is drawn (GOTCHAS 78), and the region
// cull needs a frame to have run for the belt to be populated.
await p.waitForTimeout(900);

const dims = await p.evaluate(() => window.__ct.roomDims()).catch(() => null);
if (!dims?.length) {
  console.error(`the world at ${URL} published no rooms — nothing was measured`);
  await b.close();
  process.exit(2);
}

// The same shape filter `scripts/doormatch12.mjs` uses, plus the world yaw.
const scan = async (cx, cz) => p.evaluate(([x, z]) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const P = o.geometry?.parameters ?? {};
    const h = P.height ?? 0, w = Math.max(P.width ?? 0, P.depth ?? 0);
    if (!(h >= 1.8 && h <= 4.2 && w >= 0.35 && w <= 3.0)) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    if (e[13] < 0.5 || e[13] > 2.6) return;
    if (Math.hypot(e[12] - x, e[14] - z) > 2.4) return;
    // the plane's own normal is its local +z, i.e. the third basis column of
    // the world matrix. `scale.x = -sx` (vice.ts's one mirror) does not touch
    // it, which is exactly why the normal and not the scale is read here.
    const nx = e[8], ny = e[9], nz = e[10];
    const L = Math.hypot(nx, ny, nz) || 1;
    const yaw = Math.atan2(nx / L, nz / L);
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const img = mat?.map?.image;
    out.push({
      deg: +((yaw * 180) / Math.PI).toFixed(1),
      w: +w.toFixed(2), h: +h.toFixed(2),
      tex: img ? `${img.width}x${img.height}` : 'none',
      kit: !!img && img.width === 32 && img.height === 64,
      x: +e[12].toFixed(2), z: +e[14].toFixed(2),
    });
  });
  return out;
}, [cx, cz]);

const rows = [];
for (const rd of dims) {
  const ix = rd.cx + (rd.door?.x ?? 0), iz = rd.cz + rd.d / 2;
  // Stand INSIDE the room, 3 m back from its own front wall: the region cull
  // removes a room you are not in (GOTCHAS 79), so a scan from anywhere else
  // measures an empty scene and calls it "no leaves".
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, 0), [ix, iz - 3.0]);
  await p.waitForTimeout(260);
  const leaves = await scan(ix, iz);
  rows.push({ id: rd.id, leaves });
}
await b.close();

let measured = 0;
console.log('room       leaves  |yaw| deg (0 = shut)         texture');
for (const r of rows) {
  if (!r.leaves.length) { console.log(`${r.id.padEnd(10)} MISS    — no leaf-shaped mesh at its door`); continue; }
  measured++;
  const degs = r.leaves.map((l) => Math.abs(l.deg).toFixed(1)).join(' ');
  const tex = [...new Set(r.leaves.map((l) => l.tex + (l.kit ? '(kit)' : '')))].join(' ');
  console.log(`${r.id.padEnd(10)} ${String(r.leaves.length).padEnd(7)} ${degs.padEnd(30)} ${tex}`);
}
console.log(`\nmeasured ${measured} of ${rows.length} rooms`);
if (!measured) { console.error('NOTHING MEASURED — every room came back empty'); process.exit(2); }
process.exit(0);
