// Item 198 — CROWD HEALTH, measured the same way before and after each stage.
//
// The user: *"pedestrians sometimes clip into the fruit in the sidewalk outside
// the bodega."* The fix hands the crowd hundreds of boxes it has never been
// told about, and worker sixtyeight's warning on the row is the reason this
// file exists: *"adding all of them at once is a STEERING change, not just
// plumbing, and may surface 173 rather than resolve it"* — 173 being the row
// where a citizen gets PINNED by a car and freezes.
//
// So the fix cannot be judged by "does the fruit get avoided" alone. It has to
// be judged by BOTH numbers at once:
//
//   CLIP    a citizen standing inside solid geometry      — must go DOWN
//   PIN     a citizen that stops walking and never resumes — must NOT go UP
//
// Either one alone is trivially satisfiable: a crowd that never moves clips
// nothing, and a crowd that ignores every obstacle is never pinned.
//
// HOW THE CROWD IS OBSERVED, given that ct/crowd.ts publishes no citizens.
// `actorColliders()` holds every box the two actor hooks registered — cars via
// `vehicleBox` (crosstown.ts:615, which ALSO pushes to citAvoid) and citizens
// via the crowd's own `solid` (:629, which does not). Citizens are therefore
// the 0.5 x 0.5 actor boxes, and those boxes ARE the walkers: crowd.ts:270
// builds one per person and moves it with them. Verified by
// scripts/probes/w71-actors.mjs before anything was built on it.
//
// SAMPLED PER FRAME, IN THE PAGE, not by polling from node. A citizen crossing
// a 0.62 m crate at 1.5 m/s is inside it for under half a second; a 5 Hz poll
// from outside would miss most of the clip frames this exists to count, and
// GOTCHAS 30 is the same argument — the sim advances in FRAMES, not in ms.
//
// Usage: SHOT_URL=http://localhost:4270/ node scripts/probes/w71-crowd-health.mjs [seconds] [label]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4270/');
const SECS = Number(process.argv[2] || 60);
const LABEL = process.argv[3] || 'run';

// The two boxes worker sixtyeight identified as the fruit the user reported,
// from its citAvoid dump. Quoted as a TARGET to look up, never as the source of
// truth: the assertion below finds them in the world's own collider list and
// fails if they are not there, so a moved crate breaks the check rather than
// silently making it vacuous.
const FRUIT = [{ x: 10.75, z: -96.41 }, { x: 11.45, z: -96.41 }];

const fails = [], notes = [];
const ok = (c, m) => { (c ? notes : fails).push(`${c ? 'PASS' : 'FAIL'}  ${m}`); return c; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.waitForTimeout(800);

// ── install the per-frame sampler ─────────────────────────────────────────
const setup = await p.evaluate((fruit) => {
  const key = (c) => [c.minX, c.maxX, c.minZ, c.maxZ].map((v) => v.toFixed(3)).join('|');
  const av = window.__ct.citAvoid();
  const avoidKeys = new Set(av.filter((c) => !c.actor).map(key));
  // Static geometry is snapshotted ONCE: it does not move, and re-reading 508
  // boxes every frame would be the measurement changing the thing measured.
  const stat = window.__ct.staticColliders().map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));
  const seen = stat.filter((c) => avoidKeys.has(key(c)));      // crowd knows about these
  const blind = stat.filter((c) => !avoidKeys.has(key(c)));    // ...and not these

  // the fruit, found in the world rather than typed: nearest static box to each
  // quoted centre, and how far off it was.
  const fruitBoxes = fruit.map((f) => {
    let best = null, bd = Infinity;
    for (const c of stat) {
      const d = Math.hypot((c.minX + c.maxX) / 2 - f.x, (c.minZ + c.maxZ) / 2 - f.z);
      if (d < bd) { bd = d; best = c; }
    }
    return { box: best, off: bd, avoided: best ? avoidKeys.has(key(best)) : false };
  });

  const cits = () => window.__ct.actorColliders().filter((c) =>
    Math.abs((c.maxX - c.minX) - 0.5) < 1e-6 && Math.abs((c.maxZ - c.minZ) - 0.5) < 1e-6);
  const n0 = cits().length;

  // crowd.ts:285 tests a citizen's footprint at +/- 0.28, so that is the radius
  // an obstacle is "inside" at. Derived from the sim, not chosen here.
  const R = 0.28;
  const inAny = (list, x, z) => list.some((a) => x + R > a.minX && x - R < a.maxX && z + R > a.minZ && z - R < a.maxZ);

  const S = {
    n0, frames: 0, t0: performance.now(), tPrev: performance.now(),
    per: Array.from({ length: n0 }, () => ({
      path: 0, x: NaN, z: NaN, clipSeen: 0, clipBlind: 0, fruit: 0,
      stall: 0, worstStall: 0, samples: 0,
    })),
    // HOW CLOSE DID ANYBODY GET TO THE FRUIT? Without this, "0 frames inside
    // the crates" is indistinguishable from "nobody walked down that street" —
    // and a 60 s run on the UNFIXED world scores 0 for exactly that reason.
    // This is what makes the zero mean something.
    nearFruit: Infinity,
    countMismatch: 0,
    fruitBoxes: fruitBoxes.map((f) => f.box),
    // where the crowd actually GOES. A clip count of 0 means "no clips" only if
    // they walked the ground the clips are on; without this the number is
    // indistinguishable from "nobody went there", which is the vacuous-pass
    // failure this project keeps paying for.
    roam: { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
    where: [],   // the clip positions themselves, so a red says WHERE
  };
  window.__w71 = S;

  const step = () => {
    const c = cits();
    if (c.length !== S.n0) { S.countMismatch++; requestAnimationFrame(step); return; }
    const now = performance.now();
    const dt = Math.min(0.2, (now - S.tPrev) / 1000);
    S.tPrev = now; S.frames++;
    for (let i = 0; i < c.length; i++) {
      const x = (c[i].minX + c[i].maxX) / 2, z = (c[i].minZ + c[i].maxZ) / 2;
      const r = S.per[i];
      if (!Number.isNaN(r.x)) {
        const d = Math.hypot(x - r.x, z - r.z);
        r.path += d;
        // a walker doing under 0.05 m/s is not walking. PATIENCE in crowd.ts is
        // seconds, so stalls are timed in seconds too.
        if (d / Math.max(dt, 1e-4) < 0.05) { r.stall += dt; if (r.stall > r.worstStall) r.worstStall = r.stall; }
        else r.stall = 0;
      }
      r.x = x; r.z = z; r.samples++;
      const R2 = S.roam;
      if (x < R2.minX) R2.minX = x; if (x > R2.maxX) R2.maxX = x;
      if (z < R2.minZ) R2.minZ = z; if (z > R2.maxZ) R2.maxZ = z;
      const cs = inAny(seen, x, z), cb = inAny(blind, x, z);
      if (cs) r.clipSeen++;
      if (cb) r.clipBlind++;
      if (inAny(S.fruitBoxes, x, z)) r.fruit++;
      for (const f of S.fruitBoxes) {
        const d = Math.hypot(x - (f.minX + f.maxX) / 2, z - (f.minZ + f.maxZ) / 2);
        if (d < S.nearFruit) S.nearFruit = d;
      }
      if ((cs || cb) && S.where.length < 400) {
        S.where.push({ i, x: +x.toFixed(2), z: +z.toFixed(2), k: cs ? 'known' : 'blind' });
      }
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return {
    statics: stat.length, seen: seen.length, blind: blind.length, citizens: n0,
    fruit: fruitBoxes.map((f) => ({
      off: +f.off.toFixed(3), avoided: f.avoided,
      w: +(f.box.maxX - f.box.minX).toFixed(2), d: +(f.box.maxZ - f.box.minZ).toFixed(2),
      x: +((f.box.minX + f.box.maxX) / 2).toFixed(2), z: +((f.box.minZ + f.box.maxZ) / 2).toFixed(2),
    })),
  };
}, FRUIT);

console.log(`\n=== ${LABEL} — ${SECS} s of crowd, sampled per frame`);
console.log(`static geometry ${setup.statics}: crowd is told about ${setup.seen}, blind to ${setup.blind}`);
console.log(`citizens tracked: ${setup.citizens}`);
for (const f of setup.fruit) console.log(`  fruit box ${f.w} x ${f.d} at (${f.x}, ${f.z})  off-target ${f.off} m  inCitAvoid=${f.avoided}`);

// ── POPULATION FLOORS, before any of the numbers below mean anything ──────
ok(setup.citizens === 6, `FLOOR: 6 citizens are being tracked (${setup.citizens}) — a crowd of 0 clips nothing and pins nobody, so every number below would be vacuously green`);
ok(setup.fruit.every((f) => f.off < 0.25), `FLOOR: both fruit boxes located in the world's own collider list (off by ${setup.fruit.map((f) => f.off).join(', ')} m) — not typed in here`);

await p.waitForTimeout(SECS * 1000);

const r = await p.evaluate(() => {
  const S = window.__w71;
  return {
    frames: S.frames, secs: (performance.now() - S.t0) / 1000, countMismatch: S.countMismatch,
    roam: S.roam, where: S.where, nearFruit: S.nearFruit,
    per: S.per.map((q) => ({
      path: +q.path.toFixed(2), clipSeen: q.clipSeen, clipBlind: q.clipBlind,
      fruit: q.fruit, worstStall: +q.worstStall.toFixed(2), samples: q.samples,
    })),
  };
});

const tot = (f) => r.per.reduce((a, q) => a + f(q), 0);
const path = tot((q) => q.path), clipBlind = tot((q) => q.clipBlind), clipSeen = tot((q) => q.clipSeen);
const fruit = tot((q) => q.fruit);
const worstStall = Math.max(...r.per.map((q) => q.worstStall));
const pct = (n) => `${((100 * n) / Math.max(1, r.frames * setup.citizens)).toFixed(2)}%`;

console.log(`\n${r.frames} frames over ${r.secs.toFixed(1)} s (${(r.frames / r.secs).toFixed(1)} fps), citizen-count mismatches ${r.countMismatch}`);
console.log('  cit   path(m)  clip-BLIND  clip-known  fruit  worst stall(s)');
r.per.forEach((q, i) => console.log(
  `   ${i}   ${String(q.path).padStart(7)}  ${String(q.clipBlind).padStart(10)}  ${String(q.clipSeen).padStart(10)}  ${String(q.fruit).padStart(5)}  ${String(q.worstStall).padStart(13)}`));
console.log(`\n  TOTAL path ${path.toFixed(1)} m`);
console.log(`  CLIP frames inside geometry the crowd is BLIND to : ${clipBlind}  (${pct(clipBlind)} of citizen-frames)`);
console.log(`  CLIP frames inside geometry the crowd KNOWS about : ${clipSeen}  (${pct(clipSeen)} of citizen-frames)`);
console.log(`  FRUIT frames (the user's actual complaint)        : ${fruit}`);
console.log(`  WORST STALL by any citizen                       : ${worstStall.toFixed(2)} s  (WAIT[bench] is [12,25] s, so a long stall is NOT by itself a pin)`);
const rm = r.roam;
console.log(`  ROAM x ${rm.minX.toFixed(1)}..${rm.maxX.toFixed(1)}  z ${rm.minZ.toFixed(1)}..${rm.maxZ.toFixed(1)}`);
if (r.where.length) {
  const seenAt = new Map();
  for (const w of r.where) {
    const k = `${w.k} near (${(Math.round(w.x / 2) * 2)}, ${(Math.round(w.z / 2) * 2)})`;
    seenAt.set(k, (seenAt.get(k) || 0) + 1);
  }
  console.log('  clip locations (2 m bins):');
  for (const [k, n] of [...seenAt].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`      ${n.toString().padStart(5)}  ${k}`);
}

// ── FLOORS on the run itself ──────────────────────────────────────────────
ok(r.frames > SECS * 10, `FLOOR: the sim actually ran (${r.frames} frames over ${r.secs.toFixed(1)} s) — a frozen page reports zero clips`);
ok(r.countMismatch === 0, `the citizen population never changed under the sampler (${r.countMismatch} mismatched frames)`);
ok(path > SECS * 1.0, `FLOOR: the crowd COVERED GROUND (${path.toFixed(1)} m over ${r.secs.toFixed(1)} s) — a pinned crowd would clip nothing and pass every clip assertion below`);

// ── ITEM 198'S OWN VERDICT ────────────────────────────────────────────────
// The first of these is the load-bearing one and it is DETERMINISTIC: it does
// not depend on anybody walking anywhere, so reverting ct/street.ts:242 turns
// it red on the spot. The rest are the sim agreeing with it.
ok(setup.fruit.every((f) => f.avoided),
  `the produce crates outside the bodega are in citAvoid — the crowd is TOLD about them (${setup.fruit.map((f) => f.avoided).join(', ')})`);
console.log(`  closest any citizen came to a crate: ${r.nearFruit.toFixed(2)} m`);
ok(r.nearFruit < 3.0,
  `FLOOR: somebody actually walked past the crates (closest approach ${r.nearFruit.toFixed(2)} m) — without this, "0 frames inside them" only means nobody went there, which is how a 60 s run scores 0 on the BROKEN world`);
ok(fruit === 0, `nobody stood inside the crates (${fruit} frames) — the user's report: "pedestrians sometimes clip into the fruit in the sidewalk outside the bodega"`);

console.log('');
for (const n of notes) console.log('  ', n);
for (const f of fails) console.log('  ', f);
console.log(`\nconsole errors: ${errs.length}`);
console.log(JSON.stringify({ label: LABEL, secs: +r.secs.toFixed(1), frames: r.frames, citizens: setup.citizens,
  statics: setup.statics, seen: setup.seen, blind: setup.blind,
  path: +path.toFixed(1), clipBlind, clipSeen, fruit, worstStall: +worstStall.toFixed(2),
  roam: { minX: +rm.minX.toFixed(1), maxX: +rm.maxX.toFixed(1), minZ: +rm.minZ.toFixed(1), maxZ: +rm.maxZ.toFixed(1) },
  fruitAvoided: setup.fruit.map((f) => f.avoided) }));
console.log(fails.length === 0 ? `CROWD HEALTH MEASURED — ${notes.length} floors held` : `CROWD HEALTH INVALID — ${fails.length} floor(s) failed, the numbers above mean nothing`);
await b.close();
process.exit(fails.length === 0 ? 0 : 1);
