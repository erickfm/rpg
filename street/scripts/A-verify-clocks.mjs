// SECOND VERIFIER (A) for F's row "make sure all the clocks throughout the world
// (library, diner, etc.) tell the same time".
//
// F claims: a `room.clock()` kit primitive so every clock reads game time from
// one source; 13:30 -> hour hand -0.790 (the hand CREEPS, sitting halfway
// between 1 and 2 rather than on 1); 16:00 -> -2.099; diner and library
// identical.
//
// STATION: not a standing one. Two clocks in two rooms cannot be seen at once,
// which is exactly why the user had to ask — you notice this by walking between
// them and remembering. So the reading is the hand angles, and the screenshots
// are for looking at afterwards.
//
// FOUND STRUCTURALLY: `interior.ts` builds the hands as PlaneGeometry of fixed
// WIDTH — 0.020 for the hour hand, 0.013 for the minute — with the length
// scaling off the dial radius. So the width is the identifier and the dial can
// be any size. Nothing is stamped in userData, so geometry is what there is.
//
// THE TEST IS AGREEMENT, then correctness. "All the clocks tell the same time"
// is the user's sentence, and two clocks can agree while both being wrong, so
// both halves are reported rather than one standing in for the other.
//
//   node scripts/A-verify-clocks.mjs [port]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const ARG = process.argv[2];
const URL = process.env.SHOT_URL
  ?? (ARG && /^\d+$/.test(ARG) ? `http://localhost:${ARG}/` : ARG)
  ?? 'http://localhost:4188/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2500);
await reportWorld(p, URL);

const read = (h, m) => p.evaluate(([h, m]) => new Promise((res) => {
  window.__ct.clock(h, m);
  // two frames: the hands are driven from a LATE frame hook, so a read in the
  // same tick as the clock set can catch the previous frame's angles
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const hands = [];
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
      const w = o.geometry.parameters.width;
      const kind = Math.abs(w - 0.020) < 1e-9 ? 'hour'
                 : Math.abs(w - 0.013) < 1e-9 ? 'minute' : null;
      if (!kind) return;
      const p = new o.position.constructor(); o.getWorldPosition(p);
      hands.push({ kind, rot: +o.rotation.z.toFixed(4),
        x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1) });
    });
    res({ hands, now: window.__ct.clockNow() });
  }));
}), [h, m]);

const show = (tag, r, wantH, wantM) => {
  const hour = r.hands.filter((x) => x.kind === 'hour');
  const min = r.hands.filter((x) => x.kind === 'minute');
  const uniq = (a) => [...new Set(a.map((x) => x.rot))];
  console.log(`\n${tag}  (game time ${r.now.hour}:${String(r.now.minute).padStart(2, '0')})`);
  console.log(`  ${hour.length} hour hands, ${min.length} minute hands`);
  console.log(`  hour   angles: ${uniq(hour).join(', ')}   want ${wantH.toFixed(4)}`);
  console.log(`  minute angles: ${uniq(min).join(', ')}   want ${wantM.toFixed(4)}`);
  for (const h of hour) console.log(`    clock at (${h.x}, ${h.y}, ${h.z})  hour ${h.rot}`);
  return { agreeH: uniq(hour).length <= 1, agreeM: uniq(min).length <= 1,
           n: hour.length, hour: uniq(hour)[0], minute: uniq(min)[0] };
};

const want = (h) => ({ hh: -(((h % 12) / 12) * Math.PI * 2), mm: -((h % 1) * Math.PI * 2) });

const w1 = want(13.5), r1 = await read(13, 30);
const a = show('13:30', r1, w1.hh, w1.mm);
const w2 = want(16), r2 = await read(16, 0);
const c = show('16:00', r2, w2.hh, w2.mm);

console.log(`\n${'='.repeat(64)}`);
if (!a.n) { console.error('CANNOT ANSWER — no clock hands found; nothing was measured.'); await b.close(); process.exit(3); }
const TOL = 0.02;                       // the hand creeps as game time runs on
const near = (got, wnt) => Math.abs(got - wnt) <= TOL;
const rows = [
  ['every clock agrees at 13:30', a.agreeH && a.agreeM],
  ['every clock agrees at 16:00', c.agreeH && c.agreeM],
  ['13:30 hour hand creeps to halfway', near(a.hour, w1.hh)],
  ['16:00 hour hand on the 4', near(c.hour, w2.hh)],
  ['the hands MOVED between the two times', a.hour !== c.hour],
];
for (const [what, ok] of rows) console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}`);
console.log(`\n${a.n} clocks use the kit primitive.`);
await b.close();
if (rows.some(([, ok]) => !ok)) { console.error('\nMEASURED WRONG.'); process.exit(1); }
console.log('\nMEASURED FINE — every clock reads one clock, and it is the right one.');
