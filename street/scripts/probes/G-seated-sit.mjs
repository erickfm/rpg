import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4186/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
const cx = await p.evaluate(() => window.__ct.roomDims().find(r => r.id === 'casino').cx);
// find a slot seat and its approach
const seat = await p.evaluate(([cx]) => {
  const s = window.__ct.seats().filter(q => q.label === 'sit at the slot')
    .sort((a, c) => Math.hypot(a.pose.x - cx, a.pose.z - 8) - Math.hypot(c.pose.x - cx, c.pose.z - 8))[0];
  return { pose: s.pose, at: s.at, r: s.r };
}, [cx]);
console.log(`seat pose h=${seat.pose.h}  at (${seat.at.x.toFixed(2)}, ${seat.at.z.toFixed(2)}) r=${seat.r}`);
// stand at the approach, take the seat
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [seat.at.x, seat.at.z]);
await p.waitForTimeout(400);
const before = await p.evaluate(() => window.__ct.pos());
const pr = await p.evaluate(() => { const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null; });
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
await p.waitForTimeout(700);
const after = await p.evaluate(() => window.__ct.pos());
const pr2 = await p.evaluate(() => { const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null; });
// pos()[1] is a CONSTANT eye height by design, so it cannot answer "did I sit".
// The signal that CAN move is the prompt: the seat's own ok() is
// `!rig.seated && ...`, so once you are on it the offer must change.
console.log(`prompt before E: ${JSON.stringify(pr)}`);
console.log(`prompt after  E: ${JSON.stringify(pr2)}`);
console.log(`seated? ${pr2 !== pr ? 'YES — the offer changed, so rig.seated flipped' : 'NO — same offer, E did nothing'}`);
console.log(`(eye y ${before[1].toFixed(3)} -> ${after[1].toFixed(3)}; constant by design, reported only so nobody reads it as evidence)`);
console.log(`ground under the player: ${before[3].toFixed(3)} -> ${after[3].toFixed(3)}`);
await p.screenshot({ path: 'shots/G-casino-seated-pov.png' });
// now stand in the avenue and look at a sitter side-on, which is his station
await p.evaluate(() => window.__ct.warp(0, 0, 0, 0, 0));   // stand up
await p.waitForTimeout(300);
await p.evaluate(([x]) => window.__ct.warp(x + 1.0, 10.22, Math.PI / 2, 0, 0), [cx]);
await p.waitForTimeout(450);
await p.screenshot({ path: 'shots/G-casino-sitter-sideon.png' });
await b.close();
console.log('shots/G-casino-seated-pov.png  shots/G-casino-sitter-sideon.png');
