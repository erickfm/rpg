// TWO STATIONS H IS BLOCKED FOR WANT OF, PUBLISHED AS COORDINATES.
//
// H is blocked on two of my rows, and in both cases the missing thing is not a
// verdict but a PLACE TO STAND:
//
//   1. the door re-trigger — "pressing E where you land does nothing and the
//      regression cannot be observed from outside"
//   2. the outline row — "at 0.9 m a tight box and a large volume look
//      identical"; it needs 3–4 m back from a SMALL object with debug on
//
// This prints both, measured rather than guessed, so they can be walked
// straight from the output. An investigation: it prints, it does not assert.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { installSee } from './lib/D-see.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4181/';
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);
await installSee(page);

const prompt = () => page.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '';
});
const hold = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const state = () => page.evaluate(() => ({
  pos: window.__ct.pos(), landing: window.__ct.landing ? window.__ct.landing() : 'NO AFFORDANCE',
}));

// ── 1. the door re-trigger, walked end to end ───────────────────────────────
console.log('\n═══ STATION 1 — the door re-trigger, and why E does nothing where you land');
const door = await page.evaluate(() => {
  const s = window.__ct.spots().find((sp) => sp.label === 'enter No. 227');
  return s ? { x: s.x, z: s.z } : null;
});
if (!door) { console.log('  no "enter No. 227" spot — cannot build this station'); }
else {
  const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [door.x, door.z]);
  // FIND a station that actually offers the door, do not assume one.
  //
  // The first cut of this warped to (door.x - 1.0, door.z) facing +x and
  // printed the whole sequence against an EMPTY prompt: E did nothing, the
  // player moved 0.000 m, and it reported "held". That is not the fix holding,
  // it is nothing happening — a station that offers no prompt cannot show a
  // re-trigger being suppressed, because there was never a trigger. Publishing
  // it would have sent H to a spot where the door does not answer, which is
  // the exact failure I am supposed to be removing. GOTCHAS §34.
  let stand = null;
  for (const R of [1.0, 1.3, 1.6]) {
    for (let i = 0; i < 36 && !stand; i++) {
      const th = (i / 36) * Math.PI * 2;
      const x = door.x + Math.sin(th) * R, z = door.z + Math.cos(th) * R;
      const yaw = Math.atan2(door.x - x, -(door.z - z));
      await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [x, z, yaw, gy]);
      await page.waitForTimeout(200);
      if ((await prompt()) === '[E] enter No. 227') stand = { x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(3), R };
    }
    if (stand) break;
  }
  if (!stand) { console.log('  NO STATION FOUND that offers "[E] enter No. 227" — not publishing one'); await b.close(); process.exit(1); }
  await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [stand.x, stand.z, stand.yaw, gy]);
  await page.waitForTimeout(400);
  console.log(`  __ct.warp(${stand.x}, ${stand.z}, ${stand.yaw}, ${gy.toFixed(2)}, 0)   — ${stand.R} m from the door`);
  console.log(`    prompt: "${await prompt()}"`);
  let st = await state();
  console.log(`    landing: ${JSON.stringify(st.landing)}   (null = nothing suppressed)`);

  console.log('  press E — you go through');
  await page.keyboard.press('e');
  await page.waitForTimeout(700);
  st = await state();
  console.log(`    now at (${(+st.pos[0]).toFixed(2)}, ${(+st.pos[2]).toFixed(2)})`);
  console.log(`    prompt: "${await prompt()}"   <- EMPTY, and this is the fix, not a fault`);
  console.log(`    landing: ${JSON.stringify(st.landing)}`);
  console.log('    ^ THIS IS THE AFFORDANCE H ASKED FOR. `clearIn` is how much further');
  console.log('      you must walk before anything can be selected again.');

  console.log('  press E again where you landed — must do NOTHING (this is the regression F found)');
  const wasX = +st.pos[0], wasZ = +st.pos[2];
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  st = await state();
  const moved = Math.hypot(+st.pos[0] - wasX, +st.pos[2] - wasZ);
  console.log(`    moved ${moved.toFixed(3)} m   ${moved < 0.5 ? '<- held' : '<- BOUNCED, the regression is back'}`);

  console.log('  THE DOCUMENTED WAY OUT: walk until `clearIn` reaches 0, then E works again');
  for (let i = 0; i < 12; i++) {
    await hold('w', 200);
    st = await state();
    if (!st.landing) break;
  }
  st = await state();
  // Show the re-arm rather than assert it. This line used to read "E from here
  // leaves the room" over an EMPTY prompt — true of the world, but not shown by
  // the run, and an unshown claim in a station note is how a verifier ends up
  // standing somewhere that does not answer.
  const back = await page.evaluate(() => {
    const p = window.__ct.pos();
    let best = null;
    for (const sp of window.__ct.spots()) {
      if (!sp.ok) continue;
      const d = Math.hypot(sp.x - p[0], sp.z - p[2]);
      if (d < 6 && (!best || d < best.d)) best = { d, x: sp.x, z: sp.z, label: sp.label };
    }
    if (best) window.__ct.warp(p[0], p[2], Math.atan2(best.x - p[0], -(best.z - p[2])), undefined, 0);
    return best;
  });
  await page.waitForTimeout(300);
  console.log(`    after walking: landing ${JSON.stringify(st.landing)}  <- null, so selection is re-armed`);
  console.log(`    turned to the nearest live spot (${back ? `"${back.label}" ${back.d.toFixed(2)} m` : 'none within 6 m'}): "${await prompt()}"`);
}

// ── 2. a SMALL object, from 3–4 m, for the debug volume ─────────────────────
console.log('\n═══ STATION 2 — a small object at 3–4 m, so a tight box and a big volume differ');
const small = await page.evaluate(() => {
  const all = window.__ct.spots(), groundAt = window.__ct.groundAt, cols = window.__ct.colliders();
  const standable = (x, z, gy) => {
    if (Math.abs(groundAt(x, z) - gy) > 0.30) return false;
    for (const c of cols) if (x > c.minX - 0.36 && x < c.maxX + 0.36 && z > c.minZ - 0.36 && z < c.maxZ + 0.36) return false;
    return true;
  };
  const out = [];
  for (const sp of all) {
    if (sp.r > 0.9) continue;                       // SMALL — H's whole point
    const gy = groundAt(sp.x, sp.z);
    const aim = [sp.x, gy + 1.1, sp.z];
    for (let i = 0; i < 72; i++) {
      const th = (i / 72) * Math.PI * 2;
      const d = 3.5;
      const x = sp.x + Math.sin(th) * d, z = sp.z + Math.cos(th) * d;
      if (!standable(x, z, gy)) continue;
      if (window.__dSee([x, 1.6, z], aim).t >= 0) continue;
      out.push({ label: sp.label, r: sp.r, sx: +sp.x.toFixed(2), sz: +sp.z.toFixed(2),
                 gy: +gy.toFixed(2), x: +x.toFixed(2), z: +z.toFixed(2),
                 yaw: +Math.atan2(sp.x - x, -(sp.z - z)).toFixed(3) });
      break;
    }
    if (out.length >= 4) break;
  }
  return out;
});
if (!small.length) console.log('  none found — no spot with r <= 0.9 has a clear standable line at 3.5 m');
for (const s of small) {
  await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [s.x, s.z, s.yaw, s.gy]);
  await page.evaluate(() => window.__ct.debugSpots(true));
  await page.waitForTimeout(300);
  const p = await prompt();
  const lines = await page.evaluate(() => {
    const sc = window.__ct.scene(); let n = 0;
    sc.traverse((o) => { if ((o.isLine || o.isLineSegments || o.isLineLoop) && o.material?.color?.getHex() === 0xfff3c4) n++; });
    return n;
  });
  console.log(`  "${s.label}"  r ${s.r} (a ${(s.r * 2).toFixed(2)} m volume — small enough to tell from a box)`);
  console.log(`    __ct.warp(${s.x}, ${s.z}, ${s.yaw}, ${s.gy}, 0)  then  __ct.debugSpots(true)`);
  console.log(`    3.5 m back from (${s.sx}, ${s.sz}); prompt "${p}", ${lines} outline object drawn`);
}
await page.evaluate(() => window.__ct.debugSpots(false));
await b.close();
console.log('');
