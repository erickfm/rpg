// Item 98 — WHAT ACTUALLY BOUNDS THE DEAD RING? Measure before changing fp.ts.
//
// The row's diagnosis is that `lookTolerance` is a cone that "pinches shut as
// you arrive". Worker eightysix showed the predicate is already a constant-width
// corridor (notes/eightysix-item98-the-corridor-already-exists.md) and that the
// row's own evidence — an outer edge at 3.84-3.89 m that does NOT move with r —
// argues against the cone, since a corridor's width IS r.
//
// THE DECISIVE EXPERIMENT, and it is one line of reasoning:
//
//   `looked = d < reach && offAxis < lookTolerance(s.r, d)`
//
// At offAxis EXACTLY 0 the tolerance term cannot fail — 0 < atan2(r, ...) is
// true for every positive r. So if a spot goes dead at some distance while the
// player is aimed straight at it, THE CONE IS NOT WHAT KILLED IT, and no change
// to `lookTolerance` can bring it back.
//
// So: sweep distance x off-axis over a real spot and print the band.
//
//   SHOT_URL=http://localhost:4450/ node scripts/probes/w89-item98-what-bounds-the-ring.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4450/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(12, 30));

// ── THE ORACLE: what the player is actually offered. ──────────────────────
// `#ct-prompt` is hidden with display:none and KEEPS ITS LAST TEXT (77 readers,
// 18 of which never check). Every read here checks `display` first.
const offered = async (px, pz, yaw, gy) => {
  await p.evaluate(([x, z, y, g]) => window.__ct.warp(x, z, y, g, 0), [px, pz, yaw, gy]);
  // the aimer runs in the frame loop; 3 frames was not enough and produced a
  // non-monotonic band that was this probe blinking, not the world.
  for (let i = 0; i < 8; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  return p.evaluate(() => {
    // `canSee` refuses EVERYTHING while `landing` is set (crosstown.ts:1985),
    // and it is cleared only by a 1.2 m step. A probe that warps without
    // checking this measures a world that is refusing on purpose.
    if (window.__ct.landing?.()) return '<<LANDING>>';
    const el = document.getElementById('ct-prompt');
    if (!el || getComputedStyle(el).display === 'none') return null;
    const t = (el.textContent ?? '').trim();
    return t.length ? t : null;
  });
};

// ── pick a subject: a spot with a clean approach, chosen by MEASURING that it
// is offered at 1 m rather than by assuming a door is reachable. ───────────
const spots = await p.evaluate(() => window.__ct.spots()
  .map((s) => ({ x: s.x, z: s.z, r: s.r, label: s.label, gy: window.__ct.groundAt(s.x, s.z) }))
  .filter((s) => s.gy < 0.5 && s.x < 100));   // ground floor, street side
console.log(`ground-floor street spots: ${spots.length}`);

// ISOLATE THE SUBJECT. The first run of this picked the bank ATM, which sits
// on top of the bank DOOR — so most "dead" readings were the door winning the
// contest, not the ATM failing a predicate. The prompt reports which spot WON;
// it cannot, on a contested spot, tell "not a candidate" from "outranked".
// A spot with no neighbour inside 8 m makes the prompt a clean oracle for it.
const ISO = 8;
const isolated = spots.filter((s) => !spots.some((o) => o !== s
  && Math.hypot(o.x - s.x, o.z - s.z) < ISO));
console.log(`of those, isolated (no neighbour within ${ISO} m): ${isolated.length}`);
for (const s of isolated) console.log(`   "${s.label}" r=${s.r} at (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`);

const yawAt = (ux, uz) => Math.atan2(-ux, uz);
let subject = null, dir = null;
for (const s of (isolated.length ? isolated : spots).slice(0, 40)) {
  for (let k = 0; k < 8 && !subject; k++) {
    const a = (k * Math.PI) / 4;
    const ux = Math.sin(a), uz = Math.cos(a);
    const px = s.x + ux * 1.0, pz = s.z + uz * 1.0;
    const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [px, pz]);
    if (gy > 0.5) continue;
    const t = await offered(px, pz, yawAt(ux, uz), gy);
    if (t && s.label && t.includes(s.label.slice(0, 18))) { subject = s; dir = { ux, uz }; }
  }
  if (subject) break;
}
if (!subject) { console.log('ABORT: no spot with a clean 1 m approach.'); await b.close(); process.exit(3); }
console.log(`\nSUBJECT: "${subject.label}"  r=${subject.r}  at (${subject.x.toFixed(2)}, ${subject.z.toFixed(2)})`);
console.log(`approach unit (${dir.ux.toFixed(2)}, ${dir.uz.toFixed(2)})\n`);

const key = subject.label.slice(0, 18);
const hit = (t) => !!t && t.includes(key);

// ── 1. AIMED STRAIGHT AT IT. offAxis = 0, so the cone cannot be the cause. ──
console.log('── aimed straight at it (offAxis = 0) ──');
console.log(' dist   offered?   what');
const deadAt0 = [];
for (let d = 0.3; d <= 6.01; d += 0.1) {
  const px = subject.x + dir.ux * d, pz = subject.z + dir.uz * d;
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [px, pz]);
  const t = await offered(px, pz, yawAt(dir.ux, dir.uz), gy);
  const good = hit(t);
  if (!good) deadAt0.push(+d.toFixed(2));
  if (Math.abs(d * 10 % 5) < 1e-6) {
    console.log(`  ${d.toFixed(2)}   ${good ? 'YES' : 'no '}        ${JSON.stringify(t)}`);
  }
}
console.log(`\ndead distances at offAxis=0: ${deadAt0.length}` +
  (deadAt0.length ? ` -> ${deadAt0[0]} .. ${deadAt0[deadAt0.length - 1]} m` : ''));

// ── 2. THE SAME SWEEP OFF-AXIS, to see the corridor itself ────────────────
console.log('\n── the lateral edge, per distance: the largest off-axis still offered ──');
console.log(' dist   max off-axis (deg)   lateral (m)   predicted corridor half-width = r');
for (const d of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5]) {
  let last = null;
  for (let deg = 0; deg <= 89; deg += 1) {
    const off = (deg * Math.PI) / 180;
    const px = subject.x + dir.ux * d, pz = subject.z + dir.uz * d;
    const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [px, pz]);
    const t = await offered(px, pz, yawAt(dir.ux, dir.uz) + off, gy);
    if (hit(t)) last = deg; else if (last !== null) break;
  }
  const lat = last === null ? NaN : d * Math.tan((last * Math.PI) / 180);
  console.log(`  ${d.toFixed(2)}        ${last === null ? ' none' : String(last).padStart(4)}            `
    + `${Number.isNaN(lat) ? '  -  ' : lat.toFixed(3)}          ${subject.r}`);
}

console.log(`\nconsole errors: ${errs.length}`);
await b.close();
