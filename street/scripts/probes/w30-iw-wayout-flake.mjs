// Item 58: is the bodega flake a fixed wall-clock wait?
//
// w24 measured the failures as "0, 0, 6, 0" and "0, 0, 0, 6" — SIX checks
// failing TOGETHER in one run and none in the others. Six independent flakes do
// not cluster like that; one upstream failure cascading does. In
// scripts/interiors-walk.mjs the "way out" block (§5) is exactly that shape:
//
//   :801   await hold('w', 2600);            <- FIXED wall-clock walk to the door
//   :802   const dPrompt = await prompt();
//   :803   check('… raises the way-out prompt', /out to the street/…)
//   :806   await press();                    <- a no-op if the prompt is not up
//   :807   const back = await pos();          <- still INSIDE the room
//   … and then 'E puts you back on the street', 'you land on the raised walk',
//     the re-entry-trigger check, the second-E check and all three
//     'the landing is not boxed in' legs all read an interior position.
//
// So the hypothesis is: under load the player does not REACH the inside door in
// 2600 ms, the prompt is absent, and the whole block fails as one. This probe
// tests only that first step, at throttle x1 and x8, and reports how often the
// prompt is up — no fix, just the measurement the item asks for.
//
// It does NOT go through the coverage guard, which currently exits 2 for every
// room (apt301 landed in the registry today and is not in ROOMS), so it is the
// only way to measure the flake at all right now.
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w30-iw-wayout-flake.mjs [runs]
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4193/';
const RUNS = +(process.argv[2] ?? 10);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const pos = () => p.evaluate(() => window.__ct.pos());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
// A HELD keypress: press('e') can begin and end inside one animation frame and
// the [E] dispatch is an edge read once per rendered frame (BUILDER-BRIEF §5).
const press = async () => {
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  await p.waitForTimeout(260);
};
const hold = async (k, ms) => {
  await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k);
  await p.waitForTimeout(120);
};

// Everything geometric comes out of the live world, never typed here.
const stand = await p.evaluate(async () => {
  const dm = await import('/src/proto/ct/doors.ts');
  const s = dm.doorStandFor('BODEGA');
  return s ? { x: s.x, z: s.z } : null;
});
const built = await p.evaluate(() => window.__ct.roomDims().find((d) => d.id === 'bodega'));
if (!stand || !built || !built.door) {
  console.log('FAIL: could not read the bodega door stand / room dims from the world');
  await b.close(); process.exit(1);
}
const DOOR = built.door;
console.log(`bodega stand (${stand.x.toFixed(2)}, ${stand.z.toFixed(2)})  `
  + `room centre (${built.cx.toFixed(2)}, ${built.cz.toFixed(2)})  `
  + `door local (${DOOR.x.toFixed(2)}, ${DOOR.z.toFixed(2)}) n=(${DOOR.nx.toFixed(3)}, ${DOOR.nz.toFixed(3)})`);

// interiors-walk.mjs's own banner: walking AT the door means heading -n, and
// with yaw 0 = -z that is atan2(-nx, nz). Retyping this is what the banner says
// never to do, so it is imported from the same lib the suite uses.
const { approachHeading } = await import('../lib/viewof.mjs');

// The fix under test, byte-for-byte the shape now in interiors-walk.mjs.
const holdUntil = async (k, ready, capMs) => {
  await p.keyboard.down(k);
  const t0 = Date.now();
  let hit = false;
  while (Date.now() - t0 < capMs) {
    await p.waitForTimeout(80);
    if (await ready()) { hit = true; break; }
  }
  await p.keyboard.up(k);
  await p.waitForTimeout(120);
  return hit;
};

async function trial(cpu, mode = 'fixed', want = /out to the street/) {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  // get inside: stand on the street [E] spot and press E
  await warp(stand.x, stand.z, 0, 0);
  await p.waitForTimeout(200);
  await press();
  const inside = await pos();
  if (inside[0] < 100) { await cdp.detach(); return { entered: false }; }

  // …then §5's own approach: step off the door along BOTH axes and hold W.
  const cut = Math.abs(DOOR.nx) > 0.01 && Math.abs(DOOR.nz) > 0.01;
  const sx = built.cx + DOOR.x + DOOR.nx * 0.9;
  const sz = cut ? built.cz + DOOR.z + DOOR.nz * 0.9 : built.cz + DOOR.z;
  await warp(sx, sz, approachHeading(DOOR), built.y ?? 0);
  await p.waitForTimeout(150);
  const a = await pos();
  if (mode === 'fixed') await hold('w', 2600);            // THE FIXED WAIT UNDER TEST
  else await holdUntil('w', async () => want.test((await prompt()) ?? ''), 2600);
  const c = await pos();
  const pr = await prompt();
  await cdp.detach();
  return {
    entered: true,
    ok: /out to the street/.test(pr ?? ''),
    moved: Math.hypot(c[0] - a[0], c[2] - a[2]),
    prompt: pr,
  };
}

async function suite(label, mode, want) {
  for (const cpu of [1, 8]) {
    let ok = 0, bad = 0, notIn = 0;
    const moves = [];
    for (let i = 0; i < RUNS; i++) {
      const r = await trial(cpu, mode, want);
      if (!r.entered) { notIn++; continue; }
      moves.push(r.moved);
      if (r.ok) ok++;
      else { bad++; console.log(`   [${label}] x${cpu} run ${i}: NO PROMPT — walked ${r.moved.toFixed(2)} m, prompt=${JSON.stringify(r.prompt)}`); }
    }
    const mn = moves.length ? Math.min(...moves) : NaN;
    const mx = moves.length ? Math.max(...moves) : NaN;
    console.log(`[${label}] CPU x${cpu}: prompt up ${ok}/${ok + bad}`
      + `  (failed ${bad}, never got inside ${notIn})`
      + `  walked ${mn.toFixed(2)}…${mx.toFixed(2)} m`);
  }
}

console.log('\n=== the fixed 2600 ms wait, as it stood ===');
await suite('fixed', 'fixed');
console.log('\n=== settling on the prompt instead (the fix) ===');
await suite('settled', 'settle');
// MUTATION: the settled form must still be able to FAIL. Give it a condition
// the world can never satisfy — if it still reports the prompt up, the fix has
// turned the check into one that cannot go red, which is worse than the flake.
console.log('\n=== mutation: settle on a prompt that does not exist ===');
await suite('mutant', 'settle', /THIS PROMPT DOES NOT EXIST/);
await b.close();
