// Item 59's world-level acceptance: put a SECOND turned collider in the real
// world, beside the first, and ask gap.ts about it.
//
// Two placements, both relative to the bodega chamfer's own angle so nothing
// here is a hand-typed coordinate:
//
//  CLEAR  — a parallel bar whose true clearance from the chamfer is 1.60 m,
//           comfortably passable. Its WORLD-X separation is far smaller and
//           lands in the 0.40-0.95 trap band, so a world-axis reading calls a
//           wide-open gap a trap. That is the phantom this item exists to stop.
//  TRAP   — the same bar slid in until the true clearance is 0.60 m. A real
//           slot between two real faces; it must still go red.
//
// Run against BOTH versions of gap.ts (git checkout the old one, re-run) — the
// probe imports the source through the dev server, so it measures whatever is
// on disk.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w27-second-turned-collider.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('SHOT_URL is required — a defaulted port measures someone else\'s world'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const out = await p.evaluate(async () => {
  const { trapAgainst, corridor, isTrap, PASSABLE, ENTERABLE } = await import('/src/proto/ct/gap.ts');
  const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;

  // the static set only — vehicle boxes move every frame (w24-red-dump's note)
  const s1 = window.__ct.colliders().map(key);
  await new Promise((r) => setTimeout(r, 900));
  const cols = window.__ct.colliders().filter((c) => s1.includes(key(c)));

  const turned = cols.filter((c) => c.rot);
  if (turned.length !== 1) return { error: `expected exactly 1 turned collider, found ${turned.length}` };
  const T = turned[0];

  // The chamfer's own frame, read off the collider rather than assumed.
  const s = Math.sin(T.rot), k = Math.cos(T.rot);
  const cross = { x: s, z: k };                      // its local +z, in world
  const cx = (T.minX + T.maxX) / 2, cz = (T.minZ + T.maxZ) / 2;
  const halfThick = (T.maxZ - T.minZ) / 2;

  /** a bar parallel to the chamfer, `gap` metres clear of it on its +z side */
  const parallelBar = (gap, hx, hz) => {
    const d = halfThick + gap + hz;                  // centre-to-centre across
    const bx = cx + cross.x * d, bz = cz + cross.z * d;
    return { minX: bx - hx, maxX: bx + hx, minZ: bz - hz, maxZ: bz + hz, rot: T.rot };
  };

  /** a bar parallel to the chamfer, offset purely along WORLD X. This is the
   *  arrangement that makes the two readings disagree: sliding along world X
   *  moves the bar diagonally away from a 45° wall, so the true clearance
   *  grows √2 faster than the world-X separation does. */
  const alongWorldX = (d, hx, hz) =>
    ({ minX: cx + d - hx, maxX: cx + d + hx, minZ: cz - hz, maxZ: cz + hz, rot: T.rot });

  const worldExtentX = (c) => (c.maxX - c.minX) / 2 * Math.abs(Math.cos(c.rot))
                            + (c.maxZ - c.minZ) / 2 * Math.abs(Math.sin(c.rot));

  /** Find an offset where a WORLD-AXIS reading calls it a trap and the real
   *  clearance is comfortably passable — the phantom, if one exists at all. */
  const findPhantom = (hx, hz) => {
    for (let d = 0.5; d < 12; d += 0.005) {
      const bar = alongWorldX(d, hx, hz);
      const w = corridor(T, bar);
      if (w === null || w <= PASSABLE) continue;               // must be genuinely clear
      const sepX = d - (worldExtentX(T) + worldExtentX(bar));
      if (sepX > ENTERABLE && sepX < PASSABLE) return { bar, d, sepX, w };
    }
    return null;
  };

  const report = (name, bar) => {
    const w = corridor(T, bar);
    // what a WORLD-AXIS reading would have said about the same pair
    const bcx = (bar.minX + bar.maxX) / 2;
    const worldX = Math.abs(bcx - cx) - (worldExtentX(T) + worldExtentX(bar));
    return {
      name,
      corridor: w === null ? null : +w.toFixed(4),
      trapAgainstBar: (() => { const t = trapAgainst(bar, [...cols, bar]); return t === null ? null : +t.toFixed(4); })(),
      trapAgainstChamfer: (() => { const t = trapAgainst(T, [...cols, bar]); return t === null ? null : +t.toFixed(4); })(),
      worldXSeparation: +worldX.toFixed(4),
      worldXWouldCallItATrap: worldX > ENTERABLE && worldX < PASSABLE,
      isTrapByCorridor: w !== null && isTrap(w),
    };
  };

  const found = findPhantom(1.2, 0.15);
  return {
    chamfer: { rot: T.rot, minX: T.minX, maxX: T.maxX, minZ: T.minZ, maxZ: T.maxZ },
    redWithoutBar: cols.filter((c) => trapAgainst(c, cols) !== null).length,
    phantomAt: found ? { d: +found.d.toFixed(3), sepX: +found.sepX.toFixed(4), w: +found.w.toFixed(4) } : null,
    clear: found ? report(`CLEAR (offset ${found.d.toFixed(2)} m along world X)`, found.bar) : null,
    trap: report('TRAP (0.60 m of real clearance)', parallelBar(0.60, 1.2, 0.15)),
  };
});

if (out.error) { console.error('ABORT: ' + out.error); await b.close(); process.exit(3); }

console.log(`the one turned collider: rot ${out.chamfer.rot.toFixed(4)} rad`);
console.log(`static red with no second turned box: ${out.redWithoutBar}`);
if (!out.phantomAt) {
  console.error('\nABORT: no placement found where a world-axis reading and the real'
    + ' clearance disagree — this probe would prove nothing, so it refuses to pass.');
  process.exit(3);
}
console.log(`phantom-provoking offset: ${out.phantomAt.d} m along world X`
  + ` (world-X separation ${out.phantomAt.sepX}, real clearance ${out.phantomAt.w})\n`);
const fails = [];
for (const r of [out.clear, out.trap]) {
  console.log(`${r.name}`);
  console.log(`  corridor            ${r.corridor}`);
  console.log(`  trapAgainst(bar)    ${r.trapAgainstBar}   (vs the WHOLE world — not the claim)`);
  console.log(`  trapAgainst(chamfer)${r.trapAgainstChamfer}`);
  console.log(`  world-X separation  ${r.worldXSeparation}  -> a world-axis reading calls it a trap: ${r.worldXWouldCallItATrap}`);
}
// THE CLAIM IS ABOUT THE PAIR, NOT ABOUT THE WHOLE WORLD. The phantom-provoking
// offset drops the bar into the middle of the bodega, where it forms real slots
// with real walls — `trapAgainst(bar)` is 0.755 m against one of them and that
// is CORRECT, not a phantom. Asserting it were null would have been a check
// that fails on a healthy world, so the pair is what is asserted: the chamfer
// against the second turned box.
if (out.clear.isTrapByCorridor) fails.push(`the CLEAR pair was called a trap at ${out.clear.corridor} m — phantom`);
if (out.clear.trapAgainstChamfer !== null) fails.push(`the chamfer gained red (${out.clear.trapAgainstChamfer}) from a bar ${out.clear.corridor} m clear of it — phantom`);
if (!out.trap.isTrapByCorridor) fails.push('the TRAP pair was NOT reported as a trap — a real slot missed');
if (out.trap.trapAgainstChamfer === null) fails.push('trapAgainst cleared the chamfer against the TRAP bar — a real slot missed');
if (!out.clear.worldXWouldCallItATrap) fails.push('the CLEAR case is not actually a phantom for a world-axis reading — the probe proves nothing');

console.log('');
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s)` : '\na second turned collider raises no phantom, and a genuine trap beside it is still caught');
await b.close();
process.exit(fails.length ? 1 : 0);
