// A VIEW YOU CANNOT LEAVE IS THE WORST BUG THIS PROJECT SHIPS (BUILDER-BRIEF
// §11). The user has been trapped twice: *"no im telling you i can't get up
// anything i do once i sit down"*.
//
// So this proves the way out from EVERY screen this machine has, not just the
// one it opens on — and proves all four halves of "out" each time: the panel
// closes, the camera lock releases, the player is standing, and the feet
// actually move afterwards. A close that leaves the camera locked is still a
// trap, and it is the exact failure a `panel === null` check would pass.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/probes/w41-escape-every-screen.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4187/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const fails = [];
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'}  ${m}`); if (!c) fails.push(m); };

const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z }))[0]);

const home = async () => {
  await page.evaluate(([x, z]) => window.__ct.warp(x + 1.2, z, Math.atan2(-1.2, 0), window.__ct.groundAt(x + 1.2, z), 0), [spot.x, spot.z]);
  await page.waitForTimeout(250);
};
const openIt = async () => {
  await page.keyboard.down('e');
  await page.waitForFunction(() => window.__hud.panel() === 'ct-atm', null, { timeout: 8000 });
  await page.keyboard.up('e');
  await page.waitForTimeout(650);            // let the 0.40 s ease settle
};
const press = async (k, want) => {
  await page.keyboard.press(k);
  if (want) {
    await page.waitForFunction((w) => window.__atm.screen() === w, want, { timeout: 8000 }).catch(() => {});
  } else await page.waitForTimeout(120);
};
const toPin = async () => { await press('1', 'pin'); };
const toMenu = async () => {
  await toPin();
  for (const d of ['4', '9', '0', '2']) await press(d);
  await press('Enter', 'menu');
};

// how to reach each screen from a freshly opened machine
const ROUTES = {
  idle: async () => {},
  pin: toPin,
  menu: toMenu,
  balance: async () => { await toMenu(); await press('1', 'balance'); },
  withdraw: async () => { await toMenu(); await press('2', 'withdraw'); },
  // WAIT is transient — the machine counts notes for 1.4 s — so it is entered
  // and escaped without waiting for it to finish, which is the point: this is
  // the one screen where a timer is still armed when the player leaves.
  wait: async () => { await toMenu(); await press('2', 'withdraw'); await page.keyboard.press('1'); await page.waitForTimeout(120); },
  cash: async () => { await toMenu(); await press('2', 'withdraw'); await press('1', 'cash'); },
  receipt: async () => { await toMenu(); await press('2', 'withdraw'); await press('1', 'cash'); await press('1', 'receipt'); },
  card: async () => { await toMenu(); await press('2', 'withdraw'); await press('1', 'cash'); await press('1', 'receipt'); await press('5', 'card'); },
  thanks: async () => { await toMenu(); await press('2', 'withdraw'); await press('1', 'cash'); await press('1', 'receipt'); await press('5', 'card'); await press('1', 'thanks'); },
};

const view = () => page.evaluate(() => {
  const c = window.__ct.camera(); const p = window.__ct.pos();
  return { fov: c.fov, px: p[0], pz: p[2], panel: window.__hud.panel(), seated: !!window.__ct.seated(), cursor: document.body.style.cursor };
});

for (const [name, route] of Object.entries(ROUTES)) {
  await home();
  await openIt();
  await route();
  const at = await page.evaluate(() => window.__atm.screen());
  if (at !== name) { ok(false, `could not reach the ${name} screen (got ${at})`); continue; }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const out = await view();

  // 1. the panel is down  2. the player is standing  3. the lock let the fov go
  // 4. the page has its cursor back
  const clean = out.panel === null && !out.seated && Math.abs(out.fov - 88) < 0.5 && out.cursor === '';
  // 5. AND THE FEET ACTUALLY MOVE. Backwards, away from the bank wall the
  // release leaves you facing.
  const before = { x: out.px, z: out.pz };
  await page.keyboard.down('s');
  await page.waitForTimeout(700);
  await page.keyboard.up('s');
  const after = await view();
  const moved = Math.hypot(after.px - before.x, after.pz - before.z);

  ok(clean && moved > 0.5,
    `ESC out of "${name}": panel=${out.panel} seated=${out.seated} fov=${out.fov.toFixed(0)} `
    + `cursor=${out.cursor === '' ? 'released' : 'STUCK'} moved=${moved.toFixed(2)}m`);
  await page.waitForTimeout(550);            // clear the panel's dismiss lockout
}

for (const e of errors) console.log(e);
ok(errors.length === 0, `no console errors (${errors.length})`);
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
