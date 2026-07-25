// PRESS E AT EVERY DOOR AND CHECK YOU ARRIVE. The whole entry path, end to end,
// for all eight shops -- prompt fires, key works, you land inside, and the room
// you land in is the one the sign promised.
//
// Doors come from the live spot registry, so nothing is typed in.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const ROOMS = ['bodega','burger','casino','diner','hotel','pawn','tax','thrift'];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const doors = await p.evaluate(() => window.__ct.spots()
  .filter(s => /^into /i.test(s.label||'') && s.x < 400)
  .map(s => ({ label:s.label, x:+s.x.toFixed(2), z:+s.z.toFixed(2) })));
console.log(`${doors.length} street "into …" spots in the registry\n`);
const prompt = () => p.evaluate(() => { const d=document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null; });
const pos = () => p.evaluate(() => window.__ct.pos().map(v=>+v.toFixed(2)));
const rows = [];
for (const d of doors) {
  await p.evaluate(() => window.__ct.warp(0, 0, 0, 0.14, 0));      // out first
  await p.waitForTimeout(250);
  await p.evaluate(([x,z]) => window.__ct.warp(x, z, 0, 0.14, 0), [d.x, d.z]);
  await p.waitForTimeout(320);
  const pr = await prompt();
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  await p.waitForTimeout(650);
  const after = await pos();
  const inside = after[0] > 400;
  const slab = inside ? Math.floor((after[0]-400)/80) : null;
  const room = slab !== null && slab >= 0 && slab < 8 ? ROOMS[slab] : null;
  // does the room you land in match the name on the prompt?
  const named = (d.label||'').toLowerCase();
  const match = room && (named.includes(room) ||
    (room==='casino' && /aces/.test(named)) || (room==='hotel' && /orpheus/.test(named)) ||
    (room==='tax' && /tax/.test(named)) || (room==='burger' && /burger/.test(named)));
  rows.push({ label:d.label, promptFired: !!pr, inside, slab, room, match });
  console.log(`${d.label.padEnd(24)} prompt ${pr?'yes':'NO '}  →  ` +
    (inside ? `slab ${slab} (${room})  ${match?'MATCHES the sign':'** WRONG ROOM **'}` : '** stayed on the street **'));
}
const ok = rows.filter(r => r.promptFired && r.inside && r.match).length;
console.log(`\n${ok} of ${rows.length} doors: prompt fires, E works, and you land in the room the sign names`);
writeFileSync('shots/enterall.json', JSON.stringify(rows,null,2));
await b.close();
