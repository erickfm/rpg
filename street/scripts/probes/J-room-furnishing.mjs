// HOW FURNISHED IS EACH INTERIOR — meshes per square metre, ranked.
//
// F measured the library at 0.6 per m², "one of the three thinnest rooms in the
// world alongside the pawn shop and the hotel", and routed that to me. F's
// script is not in the tree, so this is my own and it says what it counts
// rather than inheriting a definition I cannot read. The RANK is what matters,
// not the absolute — a different rule would move every room by the same kind of
// amount, and the question is only ever "is this room thin for this world".
//
// Named per GOTCHAS §24 for the claim it makes, and owner-prefixed: `density`
// is taken, by A's TEXEL density, which is a completely different number about
// the same word.
//
// WHAT IT COUNTS, said out loud because a density with no rule is an opinion:
//
//   · every Mesh whose world position falls inside the room's own slab
//   · MINUS the shell — anything within 0.25 m of a wall plane, the floor or
//     the ceiling — because a room is not furnished by having walls, and
//     counting them rewards a big empty box
//   · so: things standing IN the room. A bookcase of 40 boxes counts 40, which
//     is the honest reading — that is 40 things you can see.
//
// GOTCHAS §29: this is the EMPTY world. Citizens and the player are excluded,
// and a room's keeper is one sprite either way.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { modes } from './lib/modes.mjs';

const mode = modes('J-room-furnishing', ['probe', 'all']);
void mode;
const URL = aim('http://localhost:4192/');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 700, height: 440 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.waitForTimeout(2500);

const rooms = await p.evaluate(() => window.__ct.roomDims());
if (!rooms.length) {
  console.error('ABORT  no rooms in __ct.roomDims() — nothing to measure');
  await b.close(); process.exit(3);                      // GOTCHAS §32
}

const rows = await p.evaluate((rs) => rs.map((r) => {
  const hw = r.w / 2, hd = r.d / 2, M = 0.25;
  let n = 0;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const q = o.getWorldPosition(o.position.clone());
    const lx = q.x - r.cx, lz = q.z - r.cz;
    if (Math.abs(lx) > hw || Math.abs(lz) > hd) return;   // not in this slab
    if (hw - Math.abs(lx) < M || hd - Math.abs(lz) < M) return;  // a wall
    if (q.y < M) return;                                  // the floor
    n++;
  });
  return { id: r.id, n, area: +(r.w * r.d).toFixed(0) };
}), rooms);

for (const r of rows) r.per = r.n / r.area;
rows.sort((a, b2) => a.per - b2.per);

console.log('\nroom        area   things   per m2');
for (const r of rows) {
  console.log(`${r.id.padEnd(10)} ${String(r.area).padStart(5)} ${String(r.n).padStart(8)}   ${r.per.toFixed(2)}`
    + (r.id === 'library' ? '   <- the library' : ''));
}
const lib = rows.find((r) => r.id === 'library');
const rank = rows.indexOf(lib) + 1;
console.log(`\nlibrary is ${rank} of ${rows.length} by things per m2 `
  + `(1 = thinnest). ${lib.n} things over ${lib.area} m2.`);
console.log('Density is a DIAGNOSIS, not a target — read it beside '
  + 'scripts/roomaisle.mjs, which measures the opposite pull.');
await b.close();
