// VERIFYING O's REBUILT JAIL ROW.
//
// I confirmed an earlier version of this row and my block is not on it — but
// the row is not damaged, it is REWRITTEN: 3112 chars of new claims about a
// booking hall, a desk sergeant, a gate and EIGHT CELLS, where the version I
// checked was about the site and the pavement. New claims want a new check, not
// my old paragraph pasted back on.
//
// So: count the cells, find the sergeant, and confirm the one thing from my
// earlier pass that still matters — the ring closing on foot, since I am the
// one who removed the crossing that used to close it.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto, settle } from '../lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));

// the jail interior, found by its own spots rather than by a coordinate — the
// interiors have moved once today already and every remembered x is suspect
const room = await p.evaluate(() => {
  const spots = (window.__ct.spots() || []).filter((q) => /detention|jail|cell|sergeant/i.test(q.label || ''));
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // the interior belt copy of the jail: meshes far out on +x near a floor
  const m = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.geometry.computeBoundingBox(); const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (w.min.x < 400) return;
    m.push({ x0: w.min.x, x1: w.max.x, y0: w.min.y, y1: w.max.y, z0: w.min.z, z1: w.max.z });
  });
  return { spots: spots.map((q) => ({ x: +q.x.toFixed(1), z: +q.z.toFixed(1), label: q.label })),
           belts: [...new Set(m.map((q) => Math.round((q.x0 + q.x1) / 2 / 80) * 80))].sort((a, c) => a - c) };
});
console.log('\n── jail spots in the world ──');
for (const q of room.spots) console.log(`  (${q.x}, ${q.z})  "${q.label}"`);
console.log(`  interior belts present: ${room.belts.join(', ')}`);

// ── walk in through the door and count what is there ─────────────────────
const way = room.spots.find((q) => /detention/i.test(q.label));
if (!way) { console.log('\n  no way in found'); await b.close(); process.exit(1); }
await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI / 2, 0.14, 0), [way.x - 0.8, way.z]);
await settle(p);
await p.keyboard.press('e');
await p.waitForTimeout(1400);
const inside = await p.evaluate(() => window.__ct.pos().slice(0, 3).map((v) => +v.toFixed(2)));
console.log(`\n  after E at the door: ${JSON.stringify(inside)}` +
  (inside[0] > 400 ? '   INSIDE' : '   <-- still outside'));

const cells = await p.evaluate(([X]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // A CELL IS A RUN OF BARS. Bars are tall thin uprights repeated at a regular
  // pitch; count the DOORS instead — a barred door is a distinct group. Simpler
  // and less inventive: count the seats and the figures, and measure the room.
  const m = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.geometry.computeBoundingBox(); const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    if (Math.abs((w.min.x + w.max.x) / 2 - X) > 40) return;
    m.push(w);
  });
  // upright bars: 1.6-2.4 m tall, under 0.14 m in both horizontal axes
  const bars = m.filter((q) => q.max.y - q.min.y > 1.4 && q.max.y - q.min.y < 2.6
    && (q.max.x - q.min.x) < 0.14 && (q.max.z - q.min.z) < 0.14 && q.min.y < 0.4);
  // group bars into runs by z, then by x, at 0.35 m spacing
  const byRun = new Map();
  for (const q of bars) {
    const k = `${Math.round((q.min.z + q.max.z) / 2 / 1.6)}|${Math.round((q.min.x + q.max.x) / 2 / 1.6)}`;
    byRun.set(k, (byRun.get(k) ?? 0) + 1);
  }
  const runs = [...byRun.values()].filter((n) => n >= 4);
  return { meshes: m.length, bars: bars.length, barRuns: runs.length,
           people: (window.__ct.walkers ? window.__ct.walkers() : []).filter((q) => Math.abs(q.x - X) < 40).length };
}, [inside[0]]);
console.log(`\n── inside ──`);
console.log(`  ${cells.meshes} meshes, ${cells.bars} upright bars in ${cells.barRuns} runs of 4+`);
console.log(`  the row claims EIGHT CELLS, four each side`);

for (const [name, dx, dz, yaw] of [['hall', 0, 0, 0], ['corridor', 0, -6, 0], ['cell', 0, -9, Math.PI / 2]]) {
  await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0, -0.02), [inside[0] + dx, inside[2] + dz, yaw]);
  const l = await settle(p);
  await p.screenshot({ path: `shots/B-verify-O/jail2-${name}.png` });
  console.log(`  shots/B-verify-O/jail2-${name}.png  mean ${l.toFixed(4)}`);
}
await b.close();
