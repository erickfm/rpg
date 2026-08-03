// ITEM 268 — DID THE ITEM-267 RAILS FOLLOW THE RE-HANDING?
//
// Both rooms draw a horizontal rail along each flank and BREAK the one that
// carries the party doorway (item 267 — the user: *"theres this here that cuts
// across the entry way."*). Each derives which flank that is from `PARTY`, so
// re-handing the wall should move both breaks for free. "Should" is not a
// measurement; this is the measurement.
//
// STRUCTURAL, not a screenshot: find each room's rail boxes, bucket them by
// which flank they sit on, and require
//   · the PARTY flank to be TWO segments with a gap covering the opening
//   · the OTHER flank to be ONE unbroken segment
// in BOTH rooms. Everything — which flank is the party one, where the opening
// is, where the rooms are — is read from `__ct`, never typed.
//
// NEGATIVE CASE: `--expect-broken-on-wrong-flank` asserts the exact opposite,
// so the check is known to be capable of failing on this world rather than
// merely observed to pass on it.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const INVERT = process.argv.includes('--expect-broken-on-wrong-flank');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

const data = await p.evaluate(() => {
  const rooms = window.__ct.roomDims().filter((r) => r.belt);
  const party = window.__ct.party();
  const scene = window.__ct.scene();
  // A rail is a THIN, TALL-ISH box that runs along z (the room's depth) and is
  // parked hard against a flank. Selected on SHAPE, never on `visible` —
  // GOTCHAS 79: the region cull hides every room you are not standing in, and a
  // filter on visibility would measure nothing and say so in green.
  const out = [];
  scene.traverse((o) => {
    const g = o.geometry;
    if (!g || !g.parameters || g.type !== 'BoxGeometry') return;
    const { width, height, depth } = g.parameters;
    if (width > 0.12 || height > 0.20 || depth < 0.5) return;   // thin in x, short in y, long in z
    o.updateWorldMatrix(true, false);
    const w = o.matrixWorld.elements;
    out.push({ x: w[12], y: w[13], z: w[14], depth });
  });
  return { rooms, party, rails: out };
});

let bad = 0;
const need = (ok, what) => {
  const pass = INVERT ? !ok : ok;
  if (!pass) { console.log(`  FAIL: ${what}`); bad++; } else console.log(`  ok:   ${what}`);
};

const pw = data.party[0];
console.log(`\nPARTY  west='${pw.west}'  east='${pw.east}'  opening at local z ${pw.at} ± ${pw.w / 2}\n`);

for (const id of [pw.west, pw.east]) {
  const r = data.rooms.find((q) => q.id === id);
  const hw = r.w / 2;
  // the party flank is the one facing the partner room
  const partySide = id === pw.west ? +1 : -1;
  for (const sideSign of [+1, -1]) {
    const flankX = r.cx + sideSign * (hw - 0.02);
    const seg = data.rails.filter((m) => Math.abs(m.x - flankX) < 0.10
      && Math.abs(m.z - r.cz) < r.d);
    const isParty = sideSign === partySide;
    const label = `${id} ${isParty ? 'PARTY' : 'other'} flank (local x ${(sideSign * (hw - 0.02)).toFixed(2)})`;
    if (isParty) {
      need(seg.length >= 2, `${label}: BROKEN into ${seg.length} segment(s)`);
      // and the gap must actually cover the opening
      const spans = seg.map((m) => [m.z - r.cz - m.depth / 2, m.z - r.cz + m.depth / 2])
        .sort((a, c) => a[0] - c[0]);
      const covers = spans.every(([lo, hi]) => hi <= pw.at - pw.w / 2 + 0.02
                                            || lo >= pw.at + pw.w / 2 - 0.02);
      need(covers, `${label}: no segment crosses the opening z ${pw.at - pw.w / 2}…${pw.at + pw.w / 2}`
        + `  [${spans.map(([a, c]) => `${a.toFixed(2)}…${c.toFixed(2)}`).join(', ')}]`);
    } else {
      need(seg.length >= 1 && seg.every((m) => m.depth > r.d - 0.5),
        `${label}: UNBROKEN — ${seg.length} segment(s), depth(s) `
        + `${seg.map((m) => m.depth.toFixed(2)).join(',')} against room depth ${r.d}`);
    }
  }
}
console.log(`\n${bad ? `${bad} FAILED` : 'the rails break on the party flank in both rooms'}`
  + `${INVERT ? '   (inverted run: every line is asserting the OPPOSITE)' : ''}\n`);
await b.close();
process.exit(bad ? 1 : 0);
