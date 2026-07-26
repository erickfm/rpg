// HOW MANY THINGS OFFER THEMSELVES PER 10 m OF WALKING?
//
// The user: *"i think the selection options are a bit to wide. i feel like i
// select stuff without even looking at it."*
//
// That is a RATE, not a defect at a place, so it has to be measured as one. A
// walk that finds "the bench offers itself from here" proves nothing either
// way; what he is describing is that too much offers itself too often, so the
// prompt has stopped meaning *this is what you are looking at* and started
// meaning *something is near you*. With the outline behind the debug flag the
// prompt is his only selection feedback, so its precision is the whole feature.
//
// So: walk fixed routes, sample the prompt every step, and report DISTINCT
// spots offered per 10 m travelled. Same routes before and after any change,
// which is the only way a rate can be compared to itself.
//
// TWO NUMBERS, because they answer different questions:
//   offers/10 m   how often the prompt changes to something new — the "rate"
//   aimed %       of those offers, how many were within 15° of where he was
//                 actually pointing. This is the one that says whether an offer
//                 was EARNED. A rate that falls while the aimed share stays low
//                 has only made the world quieter, not more precise.
//
// It prints; it does not assert. Tuning wants a number, not a verdict.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4181/';
const AIMED = 15 * Math.PI / 180;      // what "actually looking at it" means here

const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);

const prompt = () => page.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '';
});
const hold = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };

// Where is the offered spot relative to where he is pointing? Read from the rig
// rather than recomputed, so the angle is the one the pick actually saw.
const offAxis = (label) => page.evaluate((l) => {
  const p = window.__ct.pos(), yaw = window.__ct.yaw ? window.__ct.yaw() : null;
  const sp = window.__ct.spots().filter((s) => s.label === l && s.ok)
    .sort((a, c) => Math.hypot(a.x - p[0], a.z - p[2]) - Math.hypot(c.x - p[0], c.z - p[2]))[0];
  if (!sp || yaw === null) return null;
  const dx = sp.x - p[0], dz = sp.z - p[2];
  const d = Math.hypot(dx, dz);
  const fx = Math.sin(yaw), fz = -Math.cos(yaw);
  const dot = (dx * fx + dz * fz) / (d || 1);
  return { off: Math.acos(Math.max(-1, Math.min(1, dot))), d };
}, label);

// Start points only. THE HEADING IS FOUND, NOT DECLARED — my first cut named a
// yaw for each route and three of the five walked 0.0 m, straight into a wall
// or a collider, so the whole table read "almost nothing offers itself" when
// the truth was "almost nothing was walked". A rate over zero metres is not a
// low rate, it is no measurement, and it would have made any tightening look
// like an improvement (GOTCHAS §34).
// ...AND THE START POINTS ARE FOUND TOO. Hand-picked ones gave 3 offers over
// 38 m, which is not a measurement of his complaint — it is a measurement of
// five stretches that happen to have nothing in them. He is describing walking
// PAST things and having them offer themselves, so the walk has to go where the
// things are. These are the standable points with the most live spots within
// 8 m, which is the pick's own reach plus a margin.
const STARTS = await page.evaluate(() => {
  const groundAt = window.__ct.groundAt, cols = window.__ct.colliders(), all = window.__ct.spots();
  const standable = (x, z, gy) => {
    if (Math.abs(groundAt(x, z) - gy) > 0.30) return false;
    for (const c of cols) if (x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4) return false;
    return true;
  };
  // THE STREET, and only the street. Ranking by raw spot count sent the walk
  // into detached interior scenes — one "dense area" had 203 spots within 8 m
  // and produced ZERO offers, because a spot's ok() is false when you have
  // warped in rather than walked in through its door. Those are not places the
  // user walks, and a rate measured there is a rate measured nowhere. The block
  // is |x| < 60, |z| < 140; `ok` is required, so only live spots count.
  const onBlock = (x, z) => Math.abs(x) < 60 && Math.abs(z) < 140;
  const cand = [];
  for (const sp of all) {
    if (!onBlock(sp.x, sp.z)) continue;
    const gy = groundAt(sp.x, sp.z);
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
      const x = sp.x + dx, z = sp.z + dz;
      if (!standable(x, z, gy)) continue;
      const near = all.filter((o) => o.ok && onBlock(o.x, o.z) && Math.hypot(o.x - x, o.z - z) < 8).length;
      cand.push({ x: +x.toFixed(2), z: +z.toFixed(2), near });
      break;
    }
  }
  cand.sort((a, b) => b.near - a.near);
  // spread them out, so five routes are not five views of one bench
  const picked = [];
  for (const c of cand) {
    if (picked.length >= 14) break;
    if (picked.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < 7)) continue;
    picked.push(c);
  }
  return picked.map((c, i) => [`street, ${c.near} live spots within 8 m`, c.x, c.z, 30]);
});
// THE ROUTE MUST BE THE SAME WALK BEFORE AND AFTER, so nothing here may depend
// on walking. My first version scored each heading by actually holding W and
// measuring travel, which made the chosen route depend on collisions, citizen
// traffic and timing — so a "before" and an "after" were two different walks
// and the comparison was meaningless. One run picked a route that travelled
// 1.6 m; the next picked 15.2 m from the same start.
//
// Scoring is now purely geometric: how many live spots lie within 3.5 m of the
// heading over the next 12 m, with a standable-path floor so the route is not
// straight into a wall. Same world, same routes, every run.
const bestYaw = async (x, z, gy) => page.evaluate(([x, z, gy]) => {
  const groundAt = window.__ct.groundAt, cols = window.__ct.colliders();
  const standable = (px, pz) => {
    if (Math.abs(groundAt(px, pz) - gy) > 0.30) return false;
    for (const c of cols) if (px > c.minX - 0.4 && px < c.maxX + 0.4 && pz > c.minZ - 0.4 && pz < c.maxZ + 0.4) return false;
    return true;
  };
  let best = { yaw: 0, score: -1, reach: 0 };
  for (let i = 0; i < 16; i++) {
    const yaw = (i / 16) * Math.PI * 2;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    let reach = 0;
    for (let t = 0.5; t <= 12; t += 0.5) { if (!standable(x + fx * t, z + fz * t)) break; reach = t; }
    if (reach < 5) continue;                       // not a route
    let n = 0;
    for (const sp of window.__ct.spots()) {
      if (!sp.ok || Math.abs(sp.x) > 60 || Math.abs(sp.z) > 140) continue;
      const t = (sp.x - x) * fx + (sp.z - z) * fz;
      if (t < 0 || t > reach) continue;
      if (Math.hypot(sp.x - (x + fx * t), sp.z - (z + fz * t)) < 3.5) n++;
    }
    if (n > best.score || (n === best.score && reach > best.reach)) best = { yaw, score: n, reach };
  }
  return best;
}, [x, z, gy]);

let allOffers = 0, allMetres = 0, allAimed = 0;
console.log(`\n  route                                metres   offers   per 10 m   aimed (<${(AIMED * 180 / Math.PI).toFixed(0)}°)`);
for (const [name, x, z, steps] of STARTS) {
  const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
  const { yaw, score } = await bestYaw(x, z, gy);
  await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [x, z, yaw, gy]);
  await page.waitForTimeout(350);
  let prev = await page.evaluate(() => window.__ct.pos());
  let metres = 0, seen = '', offers = 0, aimed = 0;
  for (let i = 0; i < steps; i++) {
    await hold('w', 200);
    const now = await page.evaluate(() => window.__ct.pos());
    metres += Math.hypot(now[0] - prev[0], now[2] - prev[2]);
    prev = now;
    const p = await prompt();
    // count a CHANGE of offer, not a frame in which something was offered —
    // standing still inside one trigger is one offer, not forty
    if (p && p !== seen) {
      offers++;
      const a = await offAxis(p.replace(/^\[E\] /, ''));
      if (a && a.off <= AIMED) aimed++;
    }
    seen = p;
  }
  allOffers += offers; allMetres += metres; allAimed += aimed;
  const per10 = metres > 0.5 ? (offers / metres * 10) : 0;
  console.log(`  ${(name + ` / passes ${score}`).padEnd(34)} ${metres.toFixed(1).padStart(6)}  ${String(offers).padStart(6)}   ${per10.toFixed(2).padStart(8)}   ${offers ? (aimed / offers * 100).toFixed(0) + '%' : '—'}`);
}
// ── THE SECOND MEASUREMENT, AND THE ONE THE COMPLAINT IS ACTUALLY ABOUT ─────
//
// The walk above is what was asked for — offers per 10 m — and it is reported
// honestly, but at this world's spot density it yields only a handful of offers
// over 200 m, which is too sparse to tune against: a change of one offer moves
// the rate by 25%.
//
// His sentence is *"i select stuff without even looking at it"*, and that is a
// statement about an ANGLE, not about a distance. So this samples the thing he
// is describing directly: stand at many points near live spots, face many
// directions, and for every sample where something IS offered, record how far
// off his aim the winner was. Hundreds of readings instead of four, and it
// answers the question in the units of the question.
const samples = await page.evaluate(() => {
  const groundAt = window.__ct.groundAt, cols = window.__ct.colliders();
  const standable = (x, z, gy) => {
    if (Math.abs(groundAt(x, z) - gy) > 0.30) return false;
    for (const c of cols) if (x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4) return false;
    return true;
  };
  const live = window.__ct.spots().filter((s) => s.ok && Math.abs(s.x) < 60 && Math.abs(s.z) < 140);
  const out = [];
  for (const sp of live) {
    const gy = groundAt(sp.x, sp.z);
    for (const R of [1.5, 2.5, 4.0]) {
      for (let i = 0; i < 8; i++) {
        const th = (i / 8) * Math.PI * 2;
        const x = sp.x + Math.sin(th) * R, z = sp.z + Math.cos(th) * R;
        if (!standable(x, z, gy)) continue;
        for (let k = 0; k < 8; k++) out.push({ x: +x.toFixed(2), z: +z.toFixed(2), gy, yaw: (k / 8) * Math.PI * 2 });
      }
    }
  }
  return out;
});
const STRIDE = Math.max(1, Math.floor(samples.length / 260));
let took = 0, offered = 0;
const angles = [];
for (let i = 0; i < samples.length; i += STRIDE) {
  const s2 = samples[i];
  await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [s2.x, s2.z, s2.yaw, s2.gy]);
  await page.waitForTimeout(90);
  took++;
  const p = await prompt();
  if (!p) continue;
  offered++;
  const a = await offAxis(p.replace(/^\[E\] /, ''));
  if (a) angles.push(a.off * 180 / Math.PI);
}
angles.sort((a, c) => a - c);
const pct = (q) => angles.length ? angles[Math.min(angles.length - 1, Math.floor(angles.length * q))].toFixed(1) : '—';
const beyond = (deg) => angles.length ? (angles.filter((v) => v > deg).length / angles.length * 100).toFixed(0) + '%' : '—';
console.log(`\n  AIM SAMPLING — ${took} stations x headings near live spots`);
console.log(`  something was offered in ${offered} of ${took} (${(offered / took * 100).toFixed(0)}%)`);
console.log(`  off-axis angle of the winner:  median ${pct(0.5)}°   90th ${pct(0.9)}°   worst ${angles.length ? angles[angles.length - 1].toFixed(1) : '—'}°`);
console.log(`  offered while NOT really looking:  >15° ${beyond(15)}   >25° ${beyond(25)}`);

await b.close();
console.log(`\n  TOTAL  ${allMetres.toFixed(1)} m walked, ${allOffers} offers`);
console.log(`  offers per 10 m: ${(allOffers / allMetres * 10).toFixed(2)}`);
console.log(`  of those, aimed at (within ${(AIMED * 180 / Math.PI).toFixed(0)}°): ${allOffers ? (allAimed / allOffers * 100).toFixed(0) : 0}%`);
console.log('');
