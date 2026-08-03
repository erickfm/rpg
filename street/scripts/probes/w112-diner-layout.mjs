// ITEM 272 — WHERE IS EVERYTHING IN THE DINER? A plan dump, so the look-probe's
// vantages are derived from the room rather than guessed at.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3.'); process.exit(3); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });
const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /diner/i.test(r.id)));
console.log(JSON.stringify(room));
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [room.cx, room.cz]);
await waitPainted(p, { quiet: true });
const out = await p.evaluate(([cx, cz, w, d]) => {
  const inR = (x, z) => x >= cx - w / 2 && x <= cx + w / 2 && z >= cz - d / 2 && z <= cz + d / 2;
  const seats = window.__ct.seats().filter((s) => s.pose && inR(s.pose.x, s.pose.z))
    .map((s) => ({ label: s.label, x: +s.pose.x.toFixed(2), z: +s.pose.z.toFixed(2), yaw: +s.pose.yaw.toFixed(2), h: s.pose.h }));
  const ppl = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    if (inR(q.x, q.z)) ppl.push({ seated: !!o.userData.seated, x: +q.x.toFixed(2), y: +q.y.toFixed(2), z: +q.z.toFixed(2) });
  });
  return { seats, ppl };
}, [room.cx, room.cz, room.w, room.d]);
console.log('seats:');
for (const s of out.seats) console.log('  ', JSON.stringify(s));
console.log('people:');
for (const s of out.ppl) console.log('  ', JSON.stringify(s));
await b.close();
