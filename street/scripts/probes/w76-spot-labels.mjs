// One-shot (item 213): what does every [E] spot actually call itself, and what
// does __ct.doors() publish as its building key? Answers "are the casino
// harnesses matching on a string the world still has?"
//   SHOT_URL=http://localhost:4320/ node scripts/probes/w76-spot-labels.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? (() => { throw new Error('SHOT_URL required — GOTCHAS 50'); })();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);
const out = await p.evaluate(() => ({
  spots: window.__ct.spots().map((q) => ({ label: q.label, x: +q.x.toFixed(2), z: +q.z.toFixed(2) })),
  doors: (window.__ct.doors ? window.__ct.doors() : []).map((d) => d.building),
  rooms: (window.__ct.roomDims ? window.__ct.roomDims() : []).map((r) => r.id),
}));
console.log(`doors(): ${out.doors.length} -> ${out.doors.join(', ')}`);
console.log(`roomDims(): ${out.rooms.length} -> ${out.rooms.join(', ')}`);
console.log(`spots(): ${out.spots.length}`);
for (const s of out.spots) if (/sevens|orpheus|casino/i.test(s.label ?? '')) console.log(`   "${s.label}"  (${s.x}, ${s.z})`);
console.log(`--- spots matching /SEVENS/:  ${out.spots.filter((s) => /SEVENS/.test(s.label ?? '')).length}`);
console.log(`--- spots matching /ORPHEUS/: ${out.spots.filter((s) => /ORPHEUS/.test(s.label ?? '')).length}`);
await b.close();
