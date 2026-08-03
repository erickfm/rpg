// w93 / item 92 — LOOK at the church's sanctuary wall, from where he stood.
//
// Item 167's lesson: the item said stop measuring and LOOK, and looking is what
// found the cause. Same here for the second half of 92 ("would love more detail
// here") — detail is not a number and there is nothing to assert about it.
//
// Shoots the altar wall from three stations down the nave, at the pitch a
// standing player actually looks at it from, and at two times of day.
//
//   SHOT_URL=http://localhost:4490/ node scripts/probes/w93-item92-look.mjs shots/w93-92
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4490/';
const OUT = process.argv[2] || 'shots/w93-92';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const ch = await p.evaluate(() => window.__ct.roomDims().find((d) => d.id === 'church'));
if (!ch) { console.error('no church'); await b.close(); process.exit(3); }
const zFar = ch.cz - ch.d / 2;
console.log(`church centre x ${ch.cx} z ${ch.cz}, altar wall z ${zFar.toFixed(2)}`);

// Down the nave on the centre line, looking at the altar wall. Yaw 0 looks
// along -z (GOTCHAS 33's camera convention), which is straight at it.
const stations = [
  ['far', ch.cx, ch.cz + ch.d / 2 - 2.5, 0, 0.10],
  ['mid', ch.cx, ch.cz + 2.0, 0, 0.16],
  ['near', ch.cx, zFar + 4.5, 0, 0.30],
  ['offaxis', ch.cx - 3.0, zFar + 6.0, 0.42, 0.22],
];
for (const [hh, mm, tag] of [[15, 0, 'day'], [21, 30, 'night']]) {
  await p.evaluate(([h, m]) => window.__ct.clock(h, m), [hh, mm]);
  for (const [name, x, z, yaw, pitch] of stations) {
    await p.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, undefined, pitch),
      [x, z, yaw, pitch]);
    await p.waitForTimeout(700);
    const f = `${OUT}-${tag}-${name}.png`;
    await p.screenshot({ path: f });
    console.log(`  ${f}`);
  }
}
await b.close();
