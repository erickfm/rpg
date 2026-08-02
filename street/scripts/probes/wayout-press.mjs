// I confirmed all nine way-outs FIRE and never pressed one. Getting back out
// matters as much as getting in, and pressing the key has already found four
// things this session that firing alone did not.
//
// For each room: warp to its way-out spot, press E, and check you land on the
// street rather than somewhere in the interior belt.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const ROOMS = ['bodega','burger','casino','diner','hotel','pawn','tax','thrift'];
const ways = await p.evaluate(() => window.__ct.spots()
  .filter(s => /out to the street/i.test(s.label||'') && s.x > 400)
  .map(s => ({ x:+s.x.toFixed(2), z:+s.z.toFixed(2) })).sort((a,b2)=>a.x-b2.x));
console.log(`${ways.length} interior way-outs\n`);
console.log('room       from                 → landed                 on the street?');
let bad = 0;
for (const w of ways) {
  const slab = Math.floor((w.x-400)/80);
  const room = slab>=0 && slab<8 ? ROOMS[slab] : `slab ${slab}`;
  await p.evaluate(([x,z]) => window.__ct.warp(x, z, 0, 0.14, 0), [w.x, w.z]);
  await p.waitForTimeout(320);
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  await p.waitForTimeout(700);
  const q = await p.evaluate(() => window.__ct.pos().map(v=>+v.toFixed(2)));
  const outside = q[0] < 400;
  if (!outside) bad++;
  console.log(`${room.padEnd(10)} (${String(w.x).padStart(7)},${String(w.z).padStart(6)})  →  (${String(q[0]).padStart(7)},${String(q[2]).padStart(7)})   ${outside?'yes':'** NO — still inside **'}`);
}
console.log(`\n${bad ? bad+' way-out(s) did not put you on the street' : 'every way-out puts you back on the street'}`);
await b.close();
