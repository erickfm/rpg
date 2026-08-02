// B'S PARK LAMPS STAND AT A HARD-CODED KERB_H — and I moved the ground.
//
// ct/props.ts makeParkLamp opens `const y0 = KERB_H;` under the comment "it
// stands on the park's own ground, which is at KERB_H". That was true when it
// was written. Since then I have re-cut the loop the lamps were sited along
// (INSET 6.0 m, chamfered corners) and crowned the field by 0.10 m with a mound
// reaching 0.37. A lamp whose coordinate ended up on grass rather than path now
// has its base buried in the ground it is supposed to stand on.
//
// I gave B those coordinates. If any of them are wrong now, that is mine to
// report and B's to fix — so this measures rather than guesses.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

// tagged by name, not matched by dimensions — props.ts learned that the hard way
const lamps = await page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.isMesh && o.userData?.parkLantern) {
      o.updateWorldMatrix(true, false);
      out.push({ x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2) });
    }
  });
  return out.map((l) => ({ ...l, gy: window.__ct.groundAt(l.x, l.z) }));
});

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };
report('the park lamps are findable at all', lamps.length >= 8,
  `${lamps.length} lanterns tagged parkLantern`);

const KERB = 0.14;
// the lamp is drawn from y0 = KERB_H; anything standing where the floor is
// higher has that much of its base underground
const buried = lamps.filter((l) => l.gy > KERB + 0.02);
report('every park lamp stands on ground that is still at KERB_H', buried.length === 0,
  buried.length
    ? `${buried.length}/${lamps.length} stand on raised ground: ${JSON.stringify(buried)}`
    : `all ${lamps.length} on flat ground (highest floor under one: ${
      Math.max(...lamps.map((l) => l.gy)).toFixed(3)})`);

console.log(fails ? `\n${fails} FAILED` : '\nthe lamps and the ground still agree');
await b.close();
process.exit(fails ? 1 : 0);
