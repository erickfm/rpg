// THE RAILING SITS ON THE WALL — THE WHOLE RUN, BOTH SIDES.
//
// Second report on this edge: *"the railing and the low wall under it read as
// two separate objects"*, pickets not meeting anything at the bottom, and the
// railing offset from the wall along the whole length. The desk's instruction
// is the important half: **do not fix it by eye at the one z in the
// screenshot**, derive the base from the plinth's actual top surface and check
// every run, because a fence has two ends and a corner.
//
// So this reads the WALL out of the built world — it is `ct/street.ts`'s, not
// mine — and asks whether my railing agrees with it. If the two disagree on
// HEIGHT that is a seam bug and belongs to D; if they disagree on CENTRE, that
// is mine. The first version of this file assumed the wall stood on the
// pavement side of the boundary. It stands on the park side, and everything
// downstream of that assumption was 0.36 m out.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = aim('http://localhost:4182/');
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

const r = await page.evaluate(() => {
  const V3 = Object.getPrototypeOf(window.__ct.scene().position).constructor;
  const wall = [], rail = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateWorldMatrix(true, false);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = bb.getCenter(new V3()), s = bb.getSize(new V3());
    if (c.z < -99 || c.z > -67) return;
    const mod = (o.userData && o.userData.mod) || '?';
    if (mod === 'street' && s.z > 4 && s.y > 0.3 && s.y < 1.2 && c.x > -8 && c.x < -6)
      wall.push({ cx: c.x, top: bb.max.y, z0: bb.min.z, z1: bb.max.z, t: s.x });
    if (o.geometry.type === 'PlaneGeometry' && s.z > 4 && c.x > -8 && c.x < -6 && c.y > 0.6)
      rail.push({ cx: c.x, bot: bb.min.y, top: bb.max.y, z0: bb.min.z, z1: bb.max.z });
  });
  return { wall, rail };
});

if (r.wall.length < 2 || r.rail.length < 2) {
  console.log(`EXIT 3: found ${r.wall.length} wall run(s) and ${r.rail.length} rail run(s) — cannot judge the seam`);
  await b.close(); process.exit(3);
}
let fails = 0;
const fail = (m) => { fails++; console.log('FAIL  ' + m); };

// every rail run must have a wall run under it, and agree with it
for (const q of r.rail) {
  const under = r.wall.find((w) => w.z0 < q.z1 - 0.1 && w.z1 > q.z0 + 0.1);
  if (!under) { fail(`rail run z ${q.z0.toFixed(1)}..${q.z1.toFixed(1)} stands over NO wall`); continue; }
  const dx = Math.abs(q.cx - under.cx);
  const dy = Math.abs(q.bot - under.top);
  if (dx > 0.02) fail(`rail z ${q.z0.toFixed(1)}..${q.z1.toFixed(1)}: centre is ${(dx * 1000).toFixed(0)} mm off the wall's (rail ${q.cx.toFixed(2)}, wall ${under.cx.toFixed(2)}) — MINE`);
  if (dy > 0.02) fail(`rail z ${q.z0.toFixed(1)}..${q.z1.toFixed(1)}: base is ${(dy * 1000).toFixed(0)} mm off the wall top (rail ${q.bot.toFixed(2)}, wall ${under.top.toFixed(2)}) — a SEAM bug, route D`);
  // the sacred lane: nothing the park owns may reach past the boundary line
  if (q.cx > -7.0 + 1e-6) fail(`rail z ${q.z0.toFixed(1)}..${q.z1.toFixed(1)}: centre ${q.cx.toFixed(2)} is on the PAVEMENT side of x -7.00`);
}
console.log(`checked ${r.rail.length} rail runs against ${r.wall.length} wall runs`);
console.log(fails ? `\n${fails} fault(s) on the boundary` : `\nevery rail run sits centred on its wall, base on the coping, clear of the pavement`);
await b.close();
process.exit(fails ? 1 : 0);
