// SURVEY, not a check: what does flat 301 actually offer, and from where?
//
// Item 85: *"i dont want sit on bed and watch tv to be the main option if im
// facing the door to leave"*. Before touching pickSpot I want the room's real
// numbers — where the bed seat is, where the door spot is, how far apart, and
// what the prompt reads from a grid of poses in between.
//
//   SHOT_URL=http://localhost:4188/ node scripts/probes/w40-301-survey.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);
await reportWorld(p, URL);

const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
console.log(`301 floor gy = ${gy}`);

// put the player in the room so the room's ok() predicates go live
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(600);

const all = await p.evaluate(() => window.__ct.spots().map((s) => ({
  x: +s.x.toFixed(3), z: +s.z.toFixed(3), r: s.r, label: s.label, ok: s.ok,
})));
const near301 = all.filter((s) => s.x > 190 && Math.abs(s.z + 15.5) < 25);
console.log(`\n${all.length} spots in the world; ${near301.length} in the 301 block:`);
for (const s of near301) {
  console.log(`  ${s.ok ? 'OK  ' : 'off '} (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) r${s.r}  ${s.label}`);
}

const bed = near301.find((s) => /bed/i.test(s.label));
const door = near301.find((s) => /the door/i.test(s.label));
console.log(`\nbed  = ${bed ? `(${bed.x}, ${bed.z}) r${bed.r} "${bed.label}"` : 'NOT FOUND'}`);
console.log(`door = ${door ? `(${door.x}, ${door.z}) r${door.r} "${door.label}"` : 'NOT FOUND'}`);
if (bed && door) {
  console.log(`bed<->door separation = ${Math.hypot(bed.x - door.x, bed.z - door.z).toFixed(2)} m`);
}
console.log(`REACH_MARGIN = ${await p.evaluate(() => window.__ct.reachMargin())}`);

// ── the grid: stand at N points along the bed->door line, face each way ──
const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});

const yawTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz));

console.log('\n  t     pos                 facing DOOR            facing BED');
console.log('  ----  ------------------  ---------------------  ---------------------');
for (let i = 0; i <= 10; i++) {
  const t = i / 10;
  const x = bed.x + (door.x - bed.x) * t, z = bed.z + (door.z - bed.z) * t;
  const dBed = Math.hypot(x - bed.x, z - bed.z), dDoor = Math.hypot(x - door.x, z - door.z);
  await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [x, z, yawTo(x, z, door.x, door.z), gy]);
  await p.waitForTimeout(220);
  const fd = await prompt();
  await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [x, z, yawTo(x, z, bed.x, bed.z), gy]);
  await p.waitForTimeout(220);
  const fb = await prompt();
  console.log(`  ${t.toFixed(1)}   (${x.toFixed(2)},${z.toFixed(2)}) b${dBed.toFixed(2)} d${dDoor.toFixed(2)}  ${String(fd ?? '-').padEnd(21)}  ${fb ?? '-'}`);
}

await b.close();
