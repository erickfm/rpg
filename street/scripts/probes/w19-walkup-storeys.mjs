// ONE QUESTION: where is the stacked-storey walk-up, and are jump-walk.mjs's
// three "storey" spots anywhere near it?
//
// The row claims the three spots at (104/112/120, -16) are in no room at all
// and that groundAt reads 0 at each. Measure it rather than believe it.
//
//   SHOT_URL=http://localhost:4184/ node scripts/probes/w19-walkup-storeys.mjs
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(600);

const out = await p.evaluate(() => {
  const rooms = window.__ct.roomDims();
  const inRoom = (x, z) => rooms.find((r) =>
    Math.abs(x - r.cx) <= r.w / 2 && Math.abs(z - r.cz) <= r.d / 2) ?? null;
  const probe = (x, z) => ({
    x, z, ground: window.__ct.groundAt(x, z),
    room: inRoom(x, z)?.id ?? null,
  });
  return {
    rooms: rooms.map((r) => ({ id: r.id, cx: +r.cx.toFixed(1), cz: +r.cz.toFixed(1),
      w: +r.w.toFixed(1), d: +r.d.toFixed(1) })),
    claimed: [[104, -16], [112, -16], [120, -16]].map(([x, z]) => probe(x, z)),
    // the spots jump-walk already trusts, as a control
    control: [[-6, -20], [-5.1, -20], [-2, -20], [6.2, -44]].map(([x, z]) => probe(x, z)),
  };
});
await b.close();

console.log('rooms roomDims() publishes:');
for (const r of out.rooms) console.log(`  ${r.id.padEnd(18)} cx ${String(r.cx).padStart(8)}  cz ${String(r.cz).padStart(7)}  ${r.w} x ${r.d}`);
console.log('\njump-walk\'s three "storey" spots:');
for (const s of out.claimed) console.log(`  (${s.x}, ${s.z})  groundAt ${s.ground}  room ${s.room ?? 'NONE'}`);
console.log('\nits outdoor spots, as a control:');
for (const s of out.control) console.log(`  (${s.x}, ${s.z})  groundAt ${s.ground}  room ${s.room ?? 'NONE'}`);
