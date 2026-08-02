// THE PAWN ALLEY IS WALKABLE — in, along, back out, and side to side.
//
// *"a very narrow, long, and detailed alley in between the pawn shop and my apt
// building."* 2.5 m, which is NARROWER THAN THE SACRED 2 m WALK plus a 0.72 m
// player, so this is the tightest space in the world and the one place where a
// collision mistake wedges somebody rather than merely annoying them. The user
// has already reported being stuck once.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/D-pawnalley-walk.mjs
//
// The slot runs x 7…24.8 between z −53.0 and −55.5.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
const URL = aim('http://localhost:4181/');
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.mouse.click(400, 300);
await p.evaluate(() => window.__ct.warp(0, -40, 0, 0, 0));
await p.waitForTimeout(400);
const pos = () => p.evaluate(() => window.__ct.pos().map((n) => +n.toFixed(2)));
// WALK UNTIL PROGRESS STOPS, never for a fixed time. GOTCHAS §30: a walk on a
// fixed sleep passes on an idle machine and fails under load, and my first
// version of this test reported two FAILURES that were entirely its own 2600 ms
// budget — the player was walking in fine, just not as far as I had assumed.
const walk = async (key, axis = 0) => {
  await p.keyboard.down(key);
  let last = (await pos())[axis], still = 0;
  for (let i = 0; i < 60 && still < 3; i++) {
    await p.waitForTimeout(150);
    const now = (await pos())[axis];
    if (Math.abs(now - last) < 0.02) still++; else still = 0;
    last = now;
  }
  await p.keyboard.up(key);
  await p.waitForTimeout(150);
};
// the slot runs x 7..24.8 at z -53..-55.5; its mouth is at x 7, centre z -54.25
const MOUTH = [6.0, -54.25];
let fails = 0;
const say = (ok, t, d) => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${t}${d ? ': ' + d : ''}`); };

// 1. walk IN from the street, facing +x
await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI / 2, 0, 0), MOUTH);
await p.waitForTimeout(300);
await walk('w');
const inn = await pos();
say(inn[0] > 14, 'you can walk into the slot from the street', `reached x ${inn[0]}`);

// 2. keep going to the closed end
const end = await pos();
say(end[0] > 20, 'you can walk all the way down it', `reached x ${end[0]}`);
say(end[0] < 25.0, 'and the closed end stops you', `stopped at x ${end[0]}`);

// 3. turn round and come back out — the wedging test
await p.evaluate(() => window.__ct.warp(window.__ct.pos()[0], window.__ct.pos()[2], -Math.PI / 2, 0, 0));
await p.waitForTimeout(300);
await walk('w');
const out = await pos();
say(out[0] < 7.5, 'you can turn round and get back out', `back to x ${out[0]}`);

// 4. it is not so tight you are stuck against a wall — strafe both ways
await p.evaluate(() => window.__ct.warp(14, -54.25, Math.PI / 2, 0, 0));
await p.waitForTimeout(300);
await walk('a', 2); const l = await pos();
await walk('d', 2); const r2 = await pos();
say(Math.abs(l[2] - r2[2]) > 0.3, 'you can move side to side inside it', `z ${l[2]} → ${r2[2]}`);
console.log(fails ? `\n${fails} FAILURES` : '\nthe slot is walkable in, along, and back out');
await b.close();
process.exit(fails ? 1 : 0);
