// DO THE PEOPLE TURN? Structural, not photographic.
//
// The citizen atlas is 160x128 with repeat [0.2, 0.5] -- 5 columns x 2 rows =
// 10 cells -- and at least one street citizen carries repeat.x = -0.2, i.e. the
// frame mirrored. Five unique views mirrored gives eight headings, which is the
// scheme the user asked for.
//
// Whether a given figure USES it is a different question, and it is answerable
// exactly: orbit the player around the figure and record its map offset and its
// own yaw at each heading. Eight angles means the offset (or the mirror sign)
// changes as you go round. A flat card that merely billboards will swing its
// yaw to face you and never change frame.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4184/'}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

// SELF-LOCATING as of notes/AUDIT-INSTRUMENTS.md: the old SUBJ table hardcoded
// citizen positions, and citizens WALK -- those coordinates were true for one
// frame of one session. Figures are now found by the atlas signature at run
// time, the same way scripts/people.mjs finds them.
const SUBJ_RETIRED = [
  ['street  (6, -12.76)',    6,    -12.76, false],
  ['street  (-6, -28.3)',   -6,    -28.3,  false],
  ['interior 442 (bank?)',  442.35, 1.6,   true],
  ['interior 517',          517.67, -3.72, true],
  ['interior 678',          678.6, -2.55,  true],
  ['interior 1002',        1002.2, -3.3,   true],
];
const SUBJ = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse(o => {
    if (!o.isMesh || !o.material || !o.material.map || !o.material.map.image) return;
    if (o.material.map.image.width !== 160) return;      // the citizen atlas
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox) return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const x=+((bb.min.x+bb.max.x)/2).toFixed(2), z=+((bb.min.z+bb.max.z)/2).toFixed(2);
    out.push([`${bb.min.x > 400 ? 'interior' : 'street  '} (${x}, ${z})`, x, z, bb.min.x > 400]);
  });
  return out;
});
console.log(`${SUBJ.length} figures found by atlas signature (no coordinate typed in)`);
const res = await p.evaluate(async (SUBJ) => {
  const s = window.__ct.scene();
  const find = (x, z) => {
    let best = null, bd = 9e9;
    s.updateMatrixWorld(true);
    s.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.map || !o.material.map.image) return;
      if (o.material.map.image.width !== 160) return;
      const wp = new (o.position.constructor)(); o.getWorldPosition(wp);
      const d = Math.hypot(wp.x - x, wp.z - z);
      if (d < bd) { bd = d; best = o; }
    });
    return { o: best, d: bd };
  };
  const out = [];
  for (const [label, x, z] of SUBJ) {
    const { o, d } = find(x, z);
    if (!o || d > 3) { out.push({ label, err: `no 160-atlas figure within 3 m (nearest ${d.toFixed(2)})` }); continue; }
    const frames = [];
    for (let a = 0; a < 360; a += 45) {
      const rad = a * Math.PI / 180, R = 3.0;
      const cx = x + Math.sin(rad) * R, cz = z + Math.cos(rad) * R;
      window.__ct.warp(cx, cz, Math.atan2(x - cx, -(z - cz)), 0.14, 0);
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => setTimeout(r, 90));
      const m = o.material;
      frames.push({ a, off: [+m.map.offset.x.toFixed(3), +m.map.offset.y.toFixed(3)],
        rep: +m.map.repeat.x.toFixed(3), yaw: +o.rotation.y.toFixed(3) });
    }
    const keys = new Set(frames.map(f => `${f.off[0]},${f.off[1]},${f.rep < 0 ? 'M' : 'N'}`));
    const yaws = new Set(frames.map(f => f.yaw));
    out.push({ label, dist: +d.toFixed(2), distinctFrames: keys.size, distinctYaws: yaws.size,
      frames: [...keys], yawSpread: +(Math.max(...frames.map(f=>f.yaw)) - Math.min(...frames.map(f=>f.yaw))).toFixed(2) });
  }
  return out;
}, SUBJ);
for (const r of res) {
  if (r.err) { console.log(`${r.label.padEnd(24)} ERROR ${r.err}`); continue; }
  const v = r.distinctFrames >= 4 ? 'TURNS' : r.distinctFrames > 1 ? 'partial' : 'ONE FRAME';
  console.log(`${r.label.padEnd(24)} ${v.padEnd(10)} ${r.distinctFrames} distinct frames over 8 headings · own yaw values ${r.distinctYaws} (spread ${r.yawSpread} rad)`);
  console.log(`   frames: ${r.frames.join('  ')}`);
}
writeFileSync('shots/turn.json', JSON.stringify(res, null, 2));
await b.close();
