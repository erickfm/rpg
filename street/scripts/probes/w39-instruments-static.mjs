// Item 83 acceptance: do the migrated instruments still move when the world
// moves, and do they still see a trap that is really there?
//
// The three verdicts below are the ones the migrated checks actually assert on,
// recomputed here from BOTH collider sets at the same instant:
//
//   builtlane.mjs   the narrowest clear width across either pavement
//   unstick-walk    how many trap candidates the world offers
//   gaps.mjs / V    how many boxes ct/gap.ts calls red (its own trapAgainst)
//
// Sampling both sets in the SAME frame is the whole design: two runs of this
// world differ, so a static number from one run and an unfiltered number from
// another prove nothing about each other. Paired samples do.
//
// Usage: SHOT_URL=http://localhost:4180/ node scripts/probes/w39-instruments-static.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { assertStaticColliders } from '../lib/collide.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4180/');
const SAMPLES = +(process.env.SAMPLES ?? 12);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
const counts = await assertStaticColliders(p);
console.log(`colliders ${counts.all} = ${counts.statics} static + ${counts.actors} that walk\n`);

// The three verdicts, over whichever array is handed in. Installed once so the
// static and unfiltered columns cannot drift into two different measurements.
await p.evaluate(async () => {
  const { trapAgainst } = await import('/src/proto/ct/gap.ts');
  const RAD = 0.36, S = 0.05;
  const WALKS = [
    { lo: -7.0, hi: -5.0, from: 12, to: -104 },
    { lo: 5.0, hi: 7.0, from: 12, to: -94 },
  ];
  window.__w39 = {
    /** builtlane.mjs's assertion: the narrowest clear width on either walk. */
    narrowest(cols) {
      const boxes = cols.filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 500);
      const free = (x, z) => !boxes.some((c) =>
        x > c.minX - RAD && x < c.maxX + RAD && z > c.minZ - RAD && z < c.maxZ + RAD);
      let worst = 99;
      for (const W of WALKS) for (let v = W.from; v >= W.to; v -= 0.5) {
        let best = 0, run = 0;
        for (let x = W.lo; x <= W.hi; x += S) { run = free(x, v) ? run + S : 0; if (run > best) best = run; }
        worst = Math.min(worst, best + 2 * RAD);
      }
      return +worst.toFixed(2);
    },
    /** unstick-walk.mjs's trap list: centres, plus every sub-0.97 m gap. */
    trapCount(cols) {
      const c8 = cols.filter((c) => (c.maxX - c.minX) < 8 && (c.maxZ - c.minZ) < 8);
      let n = c8.length;
      for (let i = 0; i < c8.length; i++) for (let j = i + 1; j < c8.length; j++) {
        const a = c8[i], d = c8[j];
        if (a.minZ < d.maxZ && d.minZ < a.maxZ) {
          const g = Math.max(d.minX - a.maxX, a.minX - d.maxX);
          if (g > 0 && g < 0.97) n++;
        }
        if (a.minX < d.maxX && d.minX < a.maxX) {
          const g = Math.max(d.minZ - a.maxZ, a.minZ - d.maxZ);
          if (g > 0 && g < 0.97) n++;
        }
      }
      return n;
    },
    /** ct/gap.ts's own verdict — the one the V overlay paints and gaps.mjs asserts. */
    red(cols) { return cols.filter((c) => trapAgainst(c, cols) !== null).length; },
    /** Did a citizen actually walk through a band we measure? GOTCHAS 71: a
     *  "nothing changed" result is worthless if nothing was moving in it. */
    walkersOnWalk() {
      return window.__ct.walkers().filter((w) => Math.abs(w.x) >= 4.6 && Math.abs(w.x) <= 7.4).length;
    },
  };
});

const sample = () => p.evaluate(() => {
  const stat = window.__ct.staticColliders(), all = window.__ct.colliders();
  return {
    sN: window.__w39.narrowest(stat), aN: window.__w39.narrowest(all),
    sT: window.__w39.trapCount(stat), aT: window.__w39.trapCount(all),
    sR: window.__w39.red(stat), aR: window.__w39.red(all),
    onWalk: window.__w39.walkersOnWalk(),
  };
});

const run = async (label) => {
  const rows = [];
  for (let i = 0; i < SAMPLES; i++) { rows.push(await sample()); await p.waitForTimeout(500); }
  const col = (k) => rows.map((r) => r[k]);
  const spread = (v) => `${Math.min(...v)}..${Math.max(...v)}`;
  const constant = (v) => Math.min(...v) === Math.max(...v);
  console.log(`── ${label}: ${SAMPLES} samples, 500 ms apart, while the crowd walks ──`);
  const out = {};
  for (const [name, sk, ak] of [['narrowest walk (builtlane)', 'sN', 'aN'],
    ['trap candidates (unstick-walk)', 'sT', 'aT'], ['red boxes (gap.ts)', 'sR', 'aR']]) {
    const s = col(sk), a = col(ak);
    out[sk] = { s, a, constant: constant(s) };
    console.log(`  ${name.padEnd(32)} static ${spread(s).padEnd(16)} ${constant(s) ? 'CONSTANT' : '** VARIES'}`
      + `   |  all ${spread(a).padEnd(16)} ${constant(a) ? 'constant' : 'VARIES'}`);
  }
  const w = col('onWalk');
  console.log(`  citizens on a measured pavement band: ${spread(w)} across the run\n`);
  return { out, walkers: w };
};

const A = await run('CLEAN WORLD');

// ── WHERE DO THE ACTORS ACTUALLY GO? ──────────────────────────────────────
//
// This decides which instruments needed migrating at all. The interior belt is
// parked far out along +x and every interior check measures out there; if no
// actor box ever reaches it, those checks were never exposed to the defect and
// leaving them on `colliders()` is a finding rather than an omission. Measured
// rather than assumed — the assumption is exactly the kind this project keeps
// paying for.
const reach = await p.evaluate(async () => {
  let lo = Infinity, hi = -Infinity, n = 0;
  for (let i = 0; i < 40; i++) {
    for (const c of window.__ct.actorColliders()) {
      if (!isFinite(c.minX) || Math.abs(c.minX) > 900) continue;   // the traffic pool parks at 999
      lo = Math.min(lo, c.minX); hi = Math.max(hi, c.maxX); n++;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { lo: +lo.toFixed(2), hi: +hi.toFixed(2), n };
});
console.log(`actor boxes over 4 s: ${reach.n} observations, x ranges ${reach.lo} .. ${reach.hi}`);
console.log(`  the interior belt starts near x 600 — actors ${reach.hi < 100 ? 'never reach it' : 'DO REACH IT'}\n`);

// ── a REAL static trap, beside the citizens ───────────────────────────────
//
// Pushed onto the live `colliders()` array, which `__ct.colliders()` returns BY
// REFERENCE for exactly this purpose (interiors-walk --selftest does the same).
// It is NOT in `actorBoxes`, so `staticColliders()` includes it — which is the
// point: this is the "real static trap beside that citizen" the item asks for,
// and the migrated instruments must still see it. Mid-pavement on the east
// walk, where the crowd is walking, and 0.5 x 0.5 — a citizen's own footprint,
// made immovable, so it cannot be dismissed on size.
const planted = await p.evaluate(() => {
  const before = window.__ct.colliders().length;
  window.__ct.colliders().push({ minX: 5.75, maxX: 6.25, minZ: -50.25, maxZ: -49.75 });
  return { before, after: window.__ct.colliders().length,
    statics: window.__ct.staticColliders().length };
});
console.log(`planted one 0.50 x 0.50 static box mid-pavement at (6.00, -50.00):`
  + ` colliders ${planted.before} -> ${planted.after}, statics now ${planted.statics}\n`);

const B = await run('WITH A REAL STATIC TRAP PLANTED');

await p.evaluate(() => { window.__ct.colliders().pop(); });

// ── verdicts ──────────────────────────────────────────────────────────────
let bad = 0;
const say = (ok, msg) => { if (!ok) bad++; console.log(`${ok ? 'ok   ' : 'FAIL '} ${msg}`); };

say(reach.n > 0 && reach.hi < 100,
  `every actor box stayed on the street (x ${reach.lo}..${reach.hi}) — so the interior checks out at`
  + ' x ~600 were never exposed to this defect, and leaving them on colliders() is deliberate');
say(Math.max(...A.walkers) > 0,
  `citizens really did walk the measured bands (${Math.min(...A.walkers)}..${Math.max(...A.walkers)} on a walk)`
  + ' — without this, "nothing changed" would be a claim about an empty sample');
for (const [k, name] of [['sN', 'narrowest walk (builtlane)'], ['sT', 'trap candidates (unstick-walk)'],
  ['sR', 'red boxes (gap.ts)']]) {
  say(A.out[k].constant, `${name}: static verdict never moved while the crowd walked`);
}
say(['sN', 'sT', 'sR'].some((k) => !A.out[k].s.every((v, i) => v === A.out[k].a[i])),
  'and the UNFILTERED verdict did disagree with it — the defect, shown live rather than argued');
for (const [k, name] of [['sN', 'narrowest walk (builtlane)'], ['sT', 'trap candidates (unstick-walk)'],
  ['sR', 'red boxes (gap.ts)']]) {
  const before = A.out[k].s[0], after = B.out[k].s[0];
  say(before !== after, `${name}: the planted static trap MOVED the verdict (${before} -> ${after})`
    + ' — it did not simply stop looking');
  say(B.out[k].constant, `${name}: and it is still constant with the trap in place (${after})`);
}

console.log(bad ? `\n${bad} FAILED` : '\nPASS');
await b.close();
process.exit(bad ? 1 : 0);
