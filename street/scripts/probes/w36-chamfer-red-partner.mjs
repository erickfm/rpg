// WHAT is the chamfer trapped against, when w24-chamfer-walk.mjs §3 goes red?
//
// §3 of scripts/probes/w24-chamfer-walk.mjs asks `gap.ts`'s own `trapAgainst`
// whether the turned chamfer box forms a trap corridor with anything, and it
// already guards against the obvious false positive: citizens and vehicles live
// in the SAME collider array, so it keeps only colliders whose footprint is
// byte-identical in two samples one second apart, and calls those "static".
//
// It went red on a clean tree anyway — one box, `rot=0.785`, which is the
// chamfer itself. §3 prints the box that is red but NOT the box it is red
// AGAINST, so the output cannot distinguish "the wall is built wrong" from
// "something parked next to it". That distinction is the whole verdict.
//
// So this samples the same way §3 does and prints the PARTNER: its footprint,
// its corridor width, and whether it is one of the world's moving colliders
// that merely happened to hold still. `N` samples a few seconds apart, because
// a thing that is there in some samples and not others is the answer.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w36-chamfer-red-partner.mjs [N]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const N = Number(process.argv[2] ?? 5);
const URL = aim();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// THROTTLE IS THE SUSPECT, so it has to be reproducible here. §3 separates
// static colliders from moving ones by taking two samples ONE WALL-CLOCK SECOND
// apart and keeping the footprints that are byte-identical. Under throttle the
// page renders only a few frames a second, so two samples a second apart can
// straddle a single rendered frame — and a moving car that did not get a frame
// in between has a byte-identical footprint and is scored STATIC.
const THROTTLE = Number(process.env.CPU_THROTTLE ?? 1);
if (THROTTLE > 1) {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  console.log(`CPU throttled x${THROTTLE}`);
}
// How many frames actually render in the same 1 s window the filter uses — the
// number that decides whether the filter can work at all.
const fps = await p.evaluate(() => new Promise((done) => {
  let n = 0; const t0 = performance.now();
  const tick = () => (performance.now() - t0 >= 1000 ? done(n) : (n++, requestAnimationFrame(tick)));
  requestAnimationFrame(tick);
}));
console.log(`rendered frames in a 1 s wall-clock window: ${fps}`);

for (let i = 1; i <= N; i++) {
  // The same static filter §3 uses: identical footprint in two samples 1 s apart.
  const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;
  const snapA = await p.evaluate((k) => window.__ct.colliders().map(eval(`(${k})`)), key.toString());
  await p.waitForTimeout(1000);
  const snapB = await p.evaluate((k) => window.__ct.colliders().map(eval(`(${k})`)), key.toString());
  const keep = snapA.filter((k) => snapB.includes(k));

  const r = await p.evaluate(async ([keep, ks]) => {
    const { trapAgainst, corridor } = await import('/src/proto/ct/gap.ts');
    const kf = eval(`(${ks})`);
    const set = new Set(keep);
    const cols = window.__ct.colliders().filter((c) => set.has(kf(c)));
    const cham = cols.find((c) => c.rot !== undefined);
    if (!cham) return { none: 'no rotated chamfer box in the static set' };
    const w = trapAgainst(cham, cols);
    if (w === null) return { red: false };
    // Which box produced it — trapAgainst returns only the width, so re-walk
    // the same list in the same order and take the first that makes a corridor.
    const partners = cols
      .filter((o) => o !== cham && corridor(cham, o) !== null)
      .map((o) => ({
        box: `${o.minX.toFixed(2)}..${o.maxX.toFixed(2)} x ${o.minZ.toFixed(2)}..${o.maxZ.toFixed(2)}`,
        rot: o.rot ?? 0, tag: o.tag ?? null,
        w: +corridor(cham, o).toFixed(3),
        size: `${(o.maxX - o.minX).toFixed(2)} x ${(o.maxZ - o.minZ).toFixed(2)}`,
      }));
    return { red: true, w: +w.toFixed(3), partners };
  }, [keep, key.toString()]);

  if (r.none) console.log(`sample ${i}: ${r.none}`);
  else if (!r.red) console.log(`sample ${i}: chamfer NOT red  (static set ${keep.length}/${snapA.length})`);
  else {
    console.log(`sample ${i}: chamfer RED, corridor ${r.w} m  (static set ${keep.length}/${snapA.length})`);
    for (const q of r.partners) {
      console.log(`     partner ${q.box}  size ${q.size}  rot ${q.rot}  tag ${q.tag}  corridor ${q.w}`);
    }
  }
  await p.waitForTimeout(1500);
}
await b.close();
