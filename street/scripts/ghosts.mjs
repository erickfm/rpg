// Is the 1.5 s mover filter's window long enough?
//
// lane3, lanewalk and corridor all decide "is this furniture" by MOTION: snapshot
// the collider list twice ~1.5 s apart and keep whatever did not move. A citizen
// who stands still for the whole window is byte-identical in both frames and is
// kept as furniture. That is exactly the failure behind 3f7b2623 (the mid-walk
// "post" was a stopped citizen), and G's 19e1e9f9 validated their own walk this
// way and handed the same hole back to me.
//
// This re-runs the corridor measurement under BOTH windows — the 1.5 s one my
// scripts use, and a ~22 s one — and reports:
//   * ghosts: boxes the short window called static but which moved later
//   * whether the corridor answer differs between the two sets
//
// Note the monotonicity, which is the real point: the long-window static set is a
// SUBSET of the short-window one, so dropping ghosts can only ever make a passage
// wider. A ghost can therefore only manufacture a falsely NARROW finding, never a
// falsely clear one.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';

const LONG_MS = Number(process.env.LONG_MS ?? 22000);
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.waitForTimeout(800);

const out = await p.evaluate(async (LONG_MS) => {
  const RAD = 0.36, S = 0.05;
  const key = c => `${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`;
  const snap = () => window.__ct.colliders()
    .filter(c => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
    .map(c => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));

  const a = snap();
  await new Promise(r => setTimeout(r, 1500));
  const shortKeys = new Set(snap().map(key));
  const shortStatic = a.filter(c => shortKeys.has(key(c)));

  // long window: sample repeatedly; a box is static only if present at EVERY sample
  const live = new Set(shortStatic.map(key));
  const t0 = performance.now();
  let samples = 0;
  while (performance.now() - t0 < LONG_MS) {
    await new Promise(r => setTimeout(r, 1000));
    const now = new Set(snap().map(key));
    for (const k of [...live]) if (!now.has(k)) live.delete(k);
    samples++;
  }
  const longStatic = shortStatic.filter(c => live.has(key(c)));
  const ghosts = shortStatic.filter(c => !live.has(key(c)))
    .map(c => ({ w: +(c.maxX - c.minX).toFixed(2), d: +(c.maxZ - c.minZ).toFixed(2),
                 x: +((c.minX + c.maxX) / 2).toFixed(2), z: +((c.minZ + c.maxZ) / 2).toFixed(2) }));

  // corridor across the walk, computed from an arbitrary collider set
  const corridor = (cols) => {
    const free = (x, z) => !cols.some(c => x > c.minX - RAD && x < c.maxX + RAD && z > c.minZ - RAD && z < c.maxZ + RAD);
    const BANDS = [{ lo: -6.7, hi: -5.0, id: 'west' }, { lo: 5.0, hi: 6.7, id: 'east' }];
    const tight = []; let worst = 99, worstAt = null;
    for (const W of BANDS) for (let v = 12; v >= -94; v -= 0.25) {
      let best = 0, run = 0;
      for (let c = W.lo; c <= W.hi; c += S) { run = free(c, v) ? run + S : 0; if (run > best) best = run; }
      const clear = +(best + 2 * RAD).toFixed(2);
      if (clear < worst) { worst = clear; worstAt = `${W.id} z ${v.toFixed(2)}`; }
      if (clear < 1.0) tight.push({ walk: W.id, z: +v.toFixed(2), clear });
    }
    return { nTight: tight.length, worst, worstAt };
  };

  return {
    total: a.length, nShort: shortStatic.length, nLong: longStatic.length,
    samples, ghosts,
    shortResult: corridor(shortStatic),
    longResult: corridor(longStatic),
  };
}, LONG_MS);

const w = process.env.LONG_MS ? Number(process.env.LONG_MS) / 1000 : 22;
console.log(`${out.total} colliders · static by 1.5 s ${out.nShort} · still static after a further ${w}s ${out.nLong}`);
console.log(`(${out.samples} long-window samples)\n`);
console.log(`GHOSTS — boxes the short window called static but which moved later: ${out.ghosts.length}`);
for (const g of out.ghosts) console.log(`    ${g.w}×${g.d} at (${g.x}, ${g.z})`);
console.log();
const f = r => `${r.nTight} stretches under 1.00 m · narrowest ${r.worst} m at ${r.worstAt}`;
console.log(`  short window (what corridor.mjs uses):  ${f(out.shortResult)}`);
console.log(`  long  window:                           ${f(out.longResult)}`);
console.log(`\ncorridor answer ${out.shortResult.nTight === out.longResult.nTight
  && out.shortResult.worst === out.longResult.worst ? 'IDENTICAL under both windows' : '** DIFFERS **'}`);
writeFileSync('shots/ghosts.json', JSON.stringify(out, null, 2));
await b.close();
