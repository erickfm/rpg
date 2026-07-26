// IS M's VAULT A ROOM YOU CAN WALK INTO? — the claim only walking settles.
//
// My first version of this walked at the room's back CORNERS, found an
// enclosure at (+x, −z), and nearly filed it as the vault. It is the working
// side of the teller line: three sides blocked with one way out describes both,
// so a corner walk cannot tell them apart. `notes/O-verify-M-bank.md` has that
// near-miss in full.
//
// This one aims at the DOOR instead, and finds the door by asking the floor
// rather than by knowing where it is: sweep the back wall and find the x where
// you can walk FURTHEST past the wall line. A doorway is exactly the place the
// wall lets you through, so the deepest penetration IS the opening — and it
// follows M if the vault ever moves.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-verify-M-vault.mjs
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1200);
await p.evaluate(() => window.__ct.clock(13, 0));
await afterFrames(p, 6);

let bad = 0, n = 0;
const ok = (c, m) => { n++; console.log(`${c ? 'OK  ' : 'NO  '} ${m}`); if (!c) bad++; };

const R = await p.evaluate(() => (window.__ct.roomDims() ?? []).find((r) => r.id === 'bank') ?? null);
if (!R) { console.error('ABORT: no room with id "bank"'); await b.close(); process.exit(3); }
const hw = R.w / 2, hd = R.d / 2;
console.log(`the bank: ${R.w} x ${R.d} centred (${R.cx}, ${R.cz})`);

const walk = async (key, maxSteps = 70) => {
  const s = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down(key);
  let last = null, still = 0;
  for (let i = 0; i < maxSteps && still < 5; i++) {
    await afterFrames(p, 3);
    const q = await p.evaluate(() => window.__ct.pos());
    if (last && Math.hypot(q[0] - last[0], q[2] - last[2]) < 0.01) still++; else still = 0;
    last = q;
  }
  await p.keyboard.up(key);
  const e = await p.evaluate(() => window.__ct.pos());
  return { start: s, end: e, moved: Math.hypot(e[0] - s[0], e[2] - s[2]) };
};

/** stand somewhere and PROVE you are there before doing anything (GOTCHAS 20:
 *  a check must verify it is where it thinks it is before it presses a key) */
const standAt = async (x, z, yaw) => {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [x, z, yaw]);
  await afterFrames(p, 5);
  const q = await p.evaluate(() => window.__ct.pos());
  return Math.hypot(q[0] - x, q[2] - z) < 0.6;
};

// ── sweep the back wall for the deepest penetration ───────────────────────
//
// Walk toward the back (−z) from 3.6 m in front of the wall, at 0.5 m intervals
// across the room. Where there is wall you stop at it; where there is a doorway
// you carry on past it. Yaw 0 looks down −z — the camera's forward is
// (sin t, −cos t), which is the convention GOTCHAS 33 says to state out loud.
console.log('\n── sweeping the back wall for an opening ──');
const sweep = [];
for (let lx = -hw + 0.8; lx <= hw - 0.8; lx += 0.5) {
  const x = R.cx + lx, z0 = R.cz - hd + 3.6;
  if (!(await standAt(x, z0, 0))) continue;
  const w = await walk('w', 40);
  sweep.push({ lx: +lx.toFixed(1), past: +(z0 - w.end[2]).toFixed(2), endZ: +w.end[2].toFixed(2) });
}
if (!sweep.length) { console.error('ABORT: could not stand anywhere along the back wall'); await b.close(); process.exit(3); }
const deepest = sweep.reduce((a, s) => (s.past > a.past ? s : a), sweep[0]);
const median = [...sweep].sort((a, z) => a.past - z.past)[Math.floor(sweep.length / 2)].past;
console.log(sweep.map((s) => `${s.lx}:${s.past}`).join('  '));
console.log(`deepest at lx ${deepest.lx} (${deepest.past} m) against a median of ${median} m`);

const hasOpening = deepest.past - median > 0.8;
ok(hasOpening,
  `there IS an opening in the back wall — ${deepest.past} m past the wall line at lx ` +
  `${deepest.lx}, against ${median} m at the median bay. A flat wall has no such column`);

// ── stand in it and test the enclosure, from the DOORWAY not a corner ─────
if (hasOpening) {
  const vx = R.cx + deepest.lx, vz = deepest.endZ + 0.4;
  console.log(`\n── inside, at (${vx.toFixed(2)}, ${vz.toFixed(2)}) ──`);
  const dirs = [];
  for (const [label, yaw] of [['+x', Math.PI / 2], ['-x', -Math.PI / 2],
                              ['-z deeper', 0], ['+z back out', Math.PI]]) {
    if (!(await standAt(vx, vz, yaw))) { console.log(`  could not stand to face ${label}`); continue; }
    const w = await walk('w', 30);
    dirs.push({ label, moved: +w.moved.toFixed(2) });
  }
  console.log(`  travel by direction: ${JSON.stringify(dirs)}`);
  const out = dirs.find((d) => d.label.startsWith('+z'));
  const sides = dirs.filter((d) => !d.label.startsWith('+z'));
  ok(sides.filter((d) => d.moved < 1.6).length >= 2,
    `ENCLOSED on the sides — ${sides.filter((d) => d.moved < 1.6).length} of ${sides.length} stop you inside 1.6 m`);
  ok(!!out && out.moved > 2.0,
    `and the way in is the way out — ${out?.moved} m back into the hall`);

  await standAt(vx, vz, Math.PI);
  await p.screenshot({ path: 'shots/O-verify-M-vault-inside-out.png' });
  await standAt(vx, vz, 0);
  await p.screenshot({ path: 'shots/O-verify-M-vault-inside-in.png' });
  console.log('  shots/O-verify-M-vault-inside-{in,out}.png');
}

console.log(`\n${n} checks, ${bad} disagreed`);
await b.close();
process.exit(bad ? 1 : 0);
