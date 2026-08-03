// Reconnaissance for item 288: can a seated citizen's HIP be matched to the
// seat it is registered on, from `__ct` alone, on the built bundle?
//
// `ct/interior.ts:946` exports `takenSeats()` for exactly this and NOTHING
// consumes it — it is not on `__ct`, so on the bundle it has no runtime path at
// all (item 223's lesson, `await import('/src/proto/…')` 404s under `vite
// preview`). This asks whether the 219 registered PLAYER seats can stand in.
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w117-hip-vs-seat.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4190/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 60000 });
await reportWorld(p, URL);
await waitPainted(p, { quiet: true });

const rows = await p.evaluate(() => {
  const seats = window.__ct.seats() || [];
  const rooms = window.__ct.roomDims();
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.citizen || !o.userData?.seated) return;
    o.updateWorldMatrix(true, false);
    const q = o.getWorldPosition(new o.position.constructor());
    const r = rooms.find((m) => Math.abs(q.x - m.cx) <= m.w / 2 && Math.abs(q.z - m.cz) <= m.d / 2);
    let best = null, bd = Infinity, second = Infinity;
    for (const s of seats) {
      const d = Math.hypot(q.x - s.pose.x, q.z - s.pose.z);
      if (d < bd) { second = bd; bd = d; best = s; } else if (d < second) second = d;
    }
    out.push({
      room: r ? r.id : 'OUTSIDE', x: q.x, y: q.y, z: q.z,
      facing: o.userData.citizenFacing ?? null,
      seat: best ? best.label : null, d: bd, next: second,
      sx: best ? best.pose.x : null, sz: best ? best.pose.z : null,
    });
  });
  return out;
});

console.log(`\n${rows.length} seated citizens; nearest REGISTERED seat to each hip:\n`);
console.log('room       hip                    nearest seat                       d      2nd-nearest');
for (const r of rows) {
  console.log(`${r.room.padEnd(10)} (${r.x.toFixed(2)}, ${r.z.toFixed(2)})`.padEnd(34)
    + `${String(r.seat).padEnd(28)}  ${r.d.toFixed(3)}   ${Number.isFinite(r.next) ? r.next.toFixed(3) : '-'}`);
}
const SEATED_KNEE_M = 12 * 1.9 / 64;   // ct/citizens.ts SEATED_KNEE_TEXELS * SPRITE_H_M / FH
console.log(`\nSEATED_KNEE_M = ${SEATED_KNEE_M.toFixed(3)} m`);
console.log('the rule ct/citizens.ts:901 enforces is  seatFwd = askedFwd > SEATED_KNEE_M ? askedFwd : 0');
console.log('so a hip displacement in the OPEN BAND (0, 0.356] is the double-correction signature:\n');
for (const r of rows) {
  const band = r.d > 0.001 && r.d <= SEATED_KNEE_M ? '  <-- IN THE FORBIDDEN BAND' : '';
  console.log(`  ${r.room.padEnd(10)} d ${r.d.toFixed(3)}${band}`);
}
await b.close();
