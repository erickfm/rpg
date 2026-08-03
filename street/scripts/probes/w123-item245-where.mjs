// Item 245 — where in the world are the tax-office seats, the jail lobby, and
// the 14 seated citizens? Read-only scoping probe for the row's premise.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(12, 30));

const want = ['sit down with the preparer', 'sit and wait', 'sit on the bench',
  'sit in the client chair', 'take a booth seat'];
const spots = await p.evaluate((w) => window.__ct.spots()
  .filter((s) => w.includes(s.label))
  .map((s) => ({ label: s.label, x: +s.x.toFixed(2), z: +s.z.toFixed(2), ok: !!s.ok })), want);
for (const s of spots) console.log(`${s.ok ? 'ok ' : '-- '} (${s.x}, ${s.z})  ${s.label}`);

console.log('\n--- every seated citizen, with the nearest registered seat ---');
const all = await p.evaluate(() => window.__ct.spots()
  .map((s) => ({ label: s.label ?? '', x: s.x, z: s.z })));
const sitters = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData?.citizen && o.userData?.seated) out.push({ x: o.position.x, z: o.position.z });
  });
  return out;
});
for (const s of sitters) {
  let best = null, bd = Infinity;
  for (const q of all) { const d = Math.hypot(q.x - s.x, q.z - s.z); if (d < bd) { bd = d; best = q; } }
  console.log(`  sitter (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  nearest spot ${bd.toFixed(2)} m  "${best?.label}"`);
}
await b.close();
