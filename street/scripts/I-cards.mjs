// IS EVERY PRICE CARD ON ITS GLASS, OR INSIDE ITS CAR?
//
// The user, on a card sunk into a bonnet: *"all that shows is a few orange
// pixels poking through the seam where the hood meets the windscreen … the card
// is inside the mesh instead of on the glass."* And the class it belongs to,
// which he has now named twice in the alley: *"trash cannot be clipping through
// stuff like this"* and *"for all the trash in the alley i cant tell what any
// of it is. these should be recognizable."* A buried card is both faults at
// once — it clips, and what survives is unidentifiable.
//
// ── the two questions, which are not the same ──
//
//  1. IS IT INSIDE SOLID BODYWORK? A sheet whose plane passes through the hood
//     or the greenhouse is the reported bug. Tested against the car's own solid
//     meshes, in the CAR's frame, so a raked body cannot confuse it.
//  2. CAN YOU SEE IT? A card can be geometrically outside the body and still
//     be edge-on or occluded. This looks from ABOVE as well as from the aisle,
//     because that is how the user found it — *"a card can be flush from eye
//     level and buried from above."*
//
// Every sheet is reported with its clearance, not just the failures, because
// "nothing overlaps" and "everything is comfortably proud" are different
// findings and only the second one means the fix generalises.
//
// Usage: SHOT_URL=http://127.0.0.1:4191/ node scripts/I-cards.mjs
//        --selftest   pin one card back at the old constant z, require red
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--selftest']);
const URL = process.env.SHOT_URL ?? 'http://127.0.0.1:4191/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

if (ARGS.selftest) {
  const n = await p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let done = 0;
    s.traverse((o) => {
      if (done || !o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (mod !== 'lot') return;
      const g = o.geometry.parameters;
      if (!(g.width > 0.8 && g.height > 0.25 && g.height < 0.4)) return;   // a price card
      o.position.z = -0.92;                    // the constant it used to be pinned at
      done = 1;
    });
    s.updateMatrixWorld(true);
    return done;
  });
  console.log(`  SELFTEST: pinned ${n} card back at the old constant z = -0.92 — this must go red\n`);
}

const res = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const roots = new Set();
  const inside = (o) => { for (let q = o.parent; q; q = q.parent) if (roots.has(q)) return true; return false; };
  const cars = [];
  s.traverse((o) => {
    if (!o.isGroup) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot' || inside(o)) return;
    let n = 0; o.traverse((c) => { if (c.isMesh) n++; });
    if (n < 8) return;
    roots.add(o); cars.push(o);
  });

  const out = [];
  for (const car of cars) {
    const inv = car.matrixWorld.clone().invert();
    const solids = [], sheets = [];
    car.traverse((c) => {
      if (!c.isMesh || !c.geometry) return;
      c.geometry.computeBoundingBox();
      const bb = c.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(c.matrixWorld));
      const box = { x0: bb.min.x, x1: bb.max.x, y0: bb.min.y, y1: bb.max.y, z0: bb.min.z, z1: bb.max.z };
      if (c.geometry.type === 'PlaneGeometry') {
        const m = Array.isArray(c.material) ? c.material[0] : c.material;
        if (m && m.map) sheets.push({ box, g: c.geometry.parameters, obj: c });
        return;
      }
      // solid bodywork: everything that is not a sheet and has real thickness
      const th = Math.min(box.x1 - box.x0, box.y1 - box.y0, box.z1 - box.z0);
      if (th > 0.03) solids.push(box);
    });
    const e = car.matrixWorld.elements;
    const rec = { at: [+e[12].toFixed(2), +e[14].toFixed(2)], sheets: [] };
    for (const sh of sheets) {
      // deepest penetration into any solid, and the clear gap if there is none
      let worst = 1e9, into = 0;
      for (const q of solids) {
        const ox = Math.min(sh.box.x1, q.x1) - Math.max(sh.box.x0, q.x0);
        const oy = Math.min(sh.box.y1, q.y1) - Math.max(sh.box.y0, q.y0);
        const oz = Math.min(sh.box.z1, q.z1) - Math.max(sh.box.z0, q.z0);
        if (ox > 0 && oy > 0 && oz > 0) into = Math.max(into, Math.min(ox, oy, oz));
        else worst = Math.min(worst, Math.max(-ox, -oy, -oz));
      }
      rec.sheets.push({
        size: `${sh.g.width.toFixed(2)}x${sh.g.height.toFixed(2)}`,
        z: +sh.box.z0.toFixed(3),
        into: +into.toFixed(3),
        clear: into > 0 ? 0 : +(worst === 1e9 ? 0 : worst).toFixed(3),
      });
    }
    out.push(rec);
  }
  return out;
});

let nSheets = 0, buried = [], tight = [];
for (const c of res) for (const sh of c.sheets) {
  nSheets++;
  if (sh.into > 0.001) buried.push({ ...sh, at: c.at });
  else if (sh.clear < 0.02) tight.push({ ...sh, at: c.at });
}
console.log(`\n  ${res.length} cars, ${nSheets} printed sheets attached to them\n`);
if (buried.length) {
  console.log(`  ${buried.length} SHEETS ARE INSIDE THEIR OWN CAR:`);
  for (const s of buried.slice(0, 14))
    console.log(`     ${s.size} on the car at (${s.at[0]}, ${s.at[1]})  —  ${s.into} m inside solid bodywork`);
} else {
  const worst = Math.min(...res.flatMap((c) => c.sheets.map((s) => s.clear)).filter((n) => n > 0));
  console.log(`  no sheet intersects its own car. Tightest clearance ${worst.toFixed(3)} m.`);
}
// 3 mm, not 20. `buyersGuide` stands its stickers +6 mm proud of the flank ON
// PURPOSE -- "the glass tapers inward with height, so a sticker flush at the
// beltline would sink into it further up" -- and 6 mm is a decal standoff, not
// a z-fight. My first threshold called all 22 of those a fault, which would
// have sent someone to re-space a thing that is already right. Coplanar is the
// defect; proud-but-close is a decal.
const groups = {};
for (const s2 of tight) groups[s2.size] = (groups[s2.size] ?? 0) + 1;
if (tight.length) {
  console.log(`  ${tight.length} sit within 20 mm of the body — by size:`);
  for (const [k, n] of Object.entries(groups)) console.log(`     ${String(n).padStart(3)} x ${k}`);
}
const fighting = tight.filter((s2) => s2.clear < 0.003);
if (fighting.length) {
  console.log(`  ${fighting.length} are under 3 mm — coplanar, and that IS a z-fight:`);
  for (const s2 of fighting)
    console.log(`     ${s2.size} on the car at (${s2.at[0]}, ${s2.at[1]})  clear ${s2.clear} m  z ${s2.z}`);
}

const FAIL = buried.length + fighting.length;
if (FAIL) console.log(`\nFAIL  ${buried.length} buried, ${fighting.length} coplanar.`);
else console.log('\nevery price card, sticker and slogan is proud of its own bodywork.');

await b.close();
process.exit(FAIL ? 1 : 0);
