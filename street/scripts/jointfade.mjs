// DO THE CROSS JOINTS SURVIVE INTO THE DISTANCE, AND HOW FAR?
//
// The user: "dont like how this curb is discontinuous and only 3 slabs, its
// unrealistic" (shots/user-kerb-discontinuous.png). "3 slabs" is a count
// ACROSS: what he is looking at is three long ribbons running to the vanishing
// point. The walk sheet draws a 1 m grid BOTH ways at 32 px/m — verified in
// source and measured in world — so if only the lengthways joints survive, the
// crossways ones are being FILTERED AWAY, not missing.
//
// So this measures rather than squints. Stand on the walk, look along it, and
// sample a column of pixels down the middle of the pavement. Each cross joint
// is a dark trough. Convert screen row -> ground distance and report the
// contrast of every trough against the flag either side of it, so the range at
// which the pattern dies is a NUMBER.
//
//   eye 1.62 m, pitch p, vertical fov f: a ground point d metres ahead sits at
//   depression atan(eye/d), and screen row = H/2 + (atan(eye/d) - p)/(f/2) * H/2
//
// Prints a table. An investigation, not a guard.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

// The user's own pose, reproduced: shots/_b-pose-e.png against
// shots/user-kerb-discontinuous.png. East walk by the car lot, facing south,
// looking down at his feet. Overridable so the same probe can be pointed
// anywhere.
const PITCH = +(process.env.PITCH ?? -0.80);
const AT = (process.env.AT ?? '6,8,0.2').split(',').map(Number);
const HOUR = +(process.env.HOUR ?? 22);
await p.evaluate(([h]) => window.__ct.clock(h, 30), [HOUR]);
await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0.14, P), [AT[0], AT[1], AT[2], PITCH]);
// WAIT FOR A LIT FRAME, DO NOT SLEEP A GUESS. The first screenshot after load
// comes back at mean R 4.6/255 whatever the clock says — the world has not
// drawn yet — and a probe that reads that frame reports "no joints anywhere",
// which is a finding it invented. GOTCHAS 30.
const meanOf = async (b64) => p.evaluate(async (s) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + s; });
  const t = document.createElement('canvas'); t.width = img.width; t.height = img.height;
  const g = t.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  let a = 0;
  for (let i = 0; i < d.length; i += 4) a += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  return a / (d.length / 4) / 255;
}, b64);
// A NIGHT frame is legitimately dark, so the warm-up cannot threshold on
// brightness alone — it waits for the frame to STOP CHANGING instead, which is
// true of a dead first frame only if the world never draws at all.
let warm = 0, wprev = -1, still = 0;
for (let i = 0; i < 40; i++) {
  warm = await meanOf((await p.screenshot()).toString('base64'));
  if (Math.abs(warm - wprev) < 0.0015 && warm > 0.025) { if (++still >= 2) break; } else still = 0;
  wprev = warm;
  await p.waitForTimeout(150);
}
if (warm <= 0.025) { console.error(`frame never lit (mean ${warm.toFixed(3)}) — nothing here is measurable`); process.exit(3); }
console.log(`frame settled at mean luminance ${warm.toFixed(4)}`);

// READ THE PNG, NOT THE LIVE CANVAS. drawImage() on a WebGL canvas without
// preserveDrawingBuffer returns a cleared buffer — this probe reported a column
// of pure zeros and "0 joints found", which would have read as a finding.
// A screenshot is taken inside the compositor and cannot be empty that way.
const png = (await p.screenshot()).toString('base64');
const r = await p.evaluate(async ([pitch, b64]) => {
  const cam = window.__ct.camera ? window.__ct.camera() : null;
  const W = 1034, H = 757;
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const t = document.createElement('canvas'); t.width = W; t.height = H;
  const g = t.getContext('2d');
  g.drawImage(img, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const lum = (x, y) => {
    const i = (y * W + x) * 4;
    return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  };
  // average a narrow column in the middle of the pavement, away from the kerb
  // and the shopfront, so a doorway or a litter piece cannot make a false trough
  const col = [];
  for (let y = 0; y < H - 90; y++) {
    let s = 0, n = 0;
    for (let x = W / 2 - 40; x < W / 2 + 40; x++) { s += lum(x | 0, y); n++; }
    col.push(s / n);
  }
  // …and a BAND ACROSS, for the joints that run lengthways. The complaint is a
  // comparison between the two families — "only 3 slabs" is what you say when
  // one family survives into the distance and the other does not — so both have
  // to be measured in the same frame or the comparison is an impression.
  const band = (y0, y1) => {
    const out = [];
    for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let y = y0; y < y1; y++) { s += lum(x, y); n++; }
      out.push(s / n);
    }
    return out;
  };
  return { col, near: band(560, 600), far: band(180, 220),
           fov: cam ? cam.fov : 60, eye: window.__ct.pos()[1], pitch };
}, [PITCH, png]);

const H = 757, fov = r.fov * Math.PI / 180, eye = r.eye;
// screen row -> ground distance ahead
const rowToD = (y) => {
  const ang = -r.pitch + ((y - H / 2) / (H / 2)) * (fov / 2);
  return ang > 0.02 ? eye / Math.tan(ang) : Infinity;
};

// A joint is a local minimum. Its depth is reported as a FRACTION of the
// concrete either side of it, not in raw levels: a night frame is five times
// darker than a noon one and raw levels would say the joints had gone when only
// the exposure had. 0.06 is about where a joint stops being visible on screen.
const troughs = (a, minSep = 5) => {
  const out = [];
  for (let i = 6; i < a.length - 6; i++) {
    const sh = (a[i - 5] + a[i - 4] + a[i + 4] + a[i + 5]) / 4;
    if (sh <= 1) continue;
    if (a[i] > a[i - 1] || a[i] > a[i + 1]) continue;
    const rel = (sh - a[i]) / sh;
    if (rel <= 0) continue;
    out.push({ i, rel, sh });
  }
  out.sort((x, y) => y.rel - x.rel);
  const keep = [];
  for (const t of out) if (!keep.some((k) => Math.abs(k.i - t.i) < minSep)) keep.push(t);
  return keep.sort((x, y) => x.i - y.i);
};

console.log(`\ncamera eye ${eye.toFixed(2)} m, fov ${r.fov}, pitch ${r.pitch}, hour ${HOUR}`);
console.log(`ground band in frame: ${rowToD(H - 91).toFixed(2)} m to ${rowToD(0).toFixed(2)} m ahead`);

console.log('\n── joints ACROSS the walk (the ones that give a flag its LENGTH) ──');
console.log('  row   distance   contrast   gap to previous');
let prev = null, last = 0, seen = 0;
for (const t of troughs(r.col)) {
  const d = rowToD(t.i);
  if (!isFinite(d) || d > 14 || d < 0) continue;
  if (t.rel < 0.06) continue;                       // below this it is not on screen
  const gap = prev === null ? null : prev - d;
  console.log(`  ${String(t.i).padStart(4)}  ${d.toFixed(2).padStart(7)} m  ${(t.rel * 100).toFixed(1).padStart(6)}%` +
    (gap === null ? '' : `   ${gap.toFixed(2)} m`));
  prev = d; last = d; seen++;
}
console.log(`  ${seen} readable, furthest ${last.toFixed(2)} m ahead` +
  ` (a 1 m grid owes one every metre to ${rowToD(0).toFixed(1)} m)`);

for (const [name, arr, rows] of [['NEAR (rows 560-600)', r.near, ''], ['FAR (rows 180-220)', r.far, '']]) {
  const t = troughs(arr, 6).filter((q) => q.rel >= 0.06);
  console.log(`\n── joints ALONG the walk, sampled ${name} ──`);
  console.log('  ' + (t.length ? t.map((q) => `x=${q.i} ${(q.rel * 100).toFixed(0)}%`).join('   ') : '(none)'));
  console.log(`  ${t.length} readable`);
}
await b.close();
