// Item 245 — MEASURE FIRST. What seats does the jail lobby and the tax office
// actually register, and which of them does the occupied-seat registry claim?
//
// The row asserts "the registry ALREADY CLAIMS their figures. Each needs only
// `ok: () => !seatTaken(x, z)` on its seat registration." This probe exists to
// test that sentence rather than believe it. Read-only.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(12, 30));

// every registered seat in the world, with its label and where it is
const spots = await p.evaluate(() => window.__ct.spots().map((s) => ({
  label: s.label ?? '', x: +s.x.toFixed(2), z: +s.z.toFixed(2), ok: !!s.ok,
})));
console.log(`\n${spots.length} spots registered world-wide`);
const byLabel = new Map();
for (const s of spots) byLabel.set(s.label, (byLabel.get(s.label) ?? 0) + 1);
for (const [l, n] of [...byLabel].sort((a, b2) => b2[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${l}`);

// every claimed (occupied) seat
const taken = await p.evaluate(() => (window.__ct.takenSeats?.() ?? []).map((t) => ({
  x: +t.x.toFixed(2), z: +t.z.toFixed(2) })));
console.log(`\n${taken.length} seats CLAIMED by the occupied-seat registry:`);
for (const t of taken) console.log(`   (${t.x}, ${t.z})`);

// where are the jail and the tax office?
const rooms = await p.evaluate(() => (window.__ct.rooms?.() ?? []).map((r) => ({
  name: r.name ?? r.id ?? '?', x: +(r.x ?? 0).toFixed(2), z: +(r.z ?? 0).toFixed(2),
  W: r.W, D: r.D })));
console.log(`\nrooms: ${JSON.stringify(rooms, null, 1)}`);

// every seated citizen in the world, by the kit's own tag
const sitters = await p.evaluate(() => {
  const out = [];
  window.__ct.scene?.().traverse?.((o) => {
    if (o.userData?.citizen && o.userData?.seated) {
      out.push({ x: +o.position.x.toFixed(2), y: +o.position.y.toFixed(2), z: +o.position.z.toFixed(2) });
    }
  });
  return out;
});
console.log(`\n${sitters.length} SEATED citizens found by userData tag:`);
for (const s of sitters) console.log(`   (${s.x}, ${s.y}, ${s.z})`);

console.log(`\nconsole errors: ${errs.length}`);
for (const e of errs.slice(0, 4)) console.log(`   ${e}`);
await b.close();
